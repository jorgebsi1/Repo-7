import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import {
  PricingError,
  authorizedLineCents,
  computeTotals,
  estimateLineCents,
  type FulfillmentMode,
  type LineRequest,
  type SkuPricing,
} from '@prolac/domain';
import { z } from 'zod';
import type { Db } from '../../db/client';
import { carrito, producto, sku, ubicacion } from '../../db/schema';
import { BUSINESS_CONFIG, CLOCK, DB, type BusinessConfig, type Clock } from '../../common/tokens';
import { notFound } from '../../common/errors';
import { DeliveryService, type DeliveryResolution } from '../delivery/delivery.service';
import { InventoryService } from '../inventory/inventory.service';

export const lineInputSchema = z
  .object({
    skuId: z.string().uuid(),
    cantidad: z.number().int().optional(),
    gramos: z.number().int().optional(),
  })
  .strict();
export type LineInput = z.infer<typeof lineInputSchema>;

export const quoteSchema = z.object({
  /** Obligatoria para recojo. En entrega la tienda se resuelve sola por la dirección. */
  ubicacionId: z.string().uuid().optional(),
  modo: z.enum(['RECOJO', 'ENTREGA']),
  lineas: z.array(lineInputSchema).min(1).max(60),
  direccion: z.object({ lat: z.number(), lng: z.number() }).optional(),
  propinaCents: z.number().int().min(0).max(100_000).default(0),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export interface PricedLine {
  skuId: string;
  productoId: string;
  nombre: string;
  presentacion: string;
  modalidad: 'PACK' | 'PESO';
  cantidad: number | null;
  gramos: number | null;
  precioCents: number | null;
  precioKgCents: number | null;
  estimadoCents: number;
  autorizadoCents: number;
  imagenUrl: string | null;
}

@Injectable()
export class CartService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BUSINESS_CONFIG) private readonly cfg: BusinessConfig,
    private readonly delivery: DeliveryService,
    private readonly inventory: InventoryService,
  ) {}

  /** Precios SIEMPRE calculados en el servidor a partir del SKU; el cliente solo envía ids y cantidades. */
  async priceLines(inputs: LineInput[]): Promise<PricedLine[]> {
    const ids = [...new Set(inputs.map((i) => i.skuId))];
    const rows = await this.db
      .select({ s: sku, p: producto })
      .from(sku)
      .innerJoin(producto, eq(sku.productoId, producto.id))
      .where(inArray(sku.id, ids));
    const byId = new Map(rows.map((r) => [r.s.id, r]));
    return inputs.map((input) => {
      const r = byId.get(input.skuId);
      if (!r || !r.s.activo || !r.p.activo) throw notFound('El producto');
      const s = r.s;
      const pricing: SkuPricing =
        s.modalidad === 'PACK'
          ? { modalidad: 'PACK', precioCents: s.precioCents! }
          : {
              modalidad: 'PESO',
              precioKgCents: s.precioKgCents!,
              pasoGramos: s.pasoGramos!,
              minGramos: s.minGramos!,
              maxGramos: s.maxGramos ?? undefined,
            };
      const req: LineRequest =
        s.modalidad === 'PACK' ? { modalidad: 'PACK', cantidad: input.cantidad ?? NaN } : { modalidad: 'PESO', gramos: input.gramos ?? NaN };
      try {
        return {
          skuId: s.id,
          productoId: r.p.id,
          nombre: r.p.nombre,
          presentacion: s.presentacion,
          modalidad: s.modalidad,
          cantidad: s.modalidad === 'PACK' ? input.cantidad! : null,
          gramos: s.modalidad === 'PESO' ? input.gramos! : null,
          precioCents: s.precioCents,
          precioKgCents: s.precioKgCents,
          estimadoCents: estimateLineCents(pricing, req),
          autorizadoCents: authorizedLineCents(pricing, req, this.cfg.weightMargin),
          imagenUrl: r.p.imagenUrl,
        };
      } catch (e) {
        if (e instanceof PricingError) {
          throw new BadRequestException({ code: e.code, message: `${r.p.nombre} (${s.presentacion}): ${e.message}`, skuId: s.id });
        }
        throw e;
      }
    });
  }

  async quote(input: QuoteInput) {
    const lineas = await this.priceLines(input.lineas);
    const subtotal = lineas.reduce((a, l) => a + l.estimadoCents, 0);

    // En entrega, la tienda la decide la dirección (la más cercana dentro de su radio); en recojo, la elige el cliente.
    let ubicacionId = input.ubicacionId;
    let entrega: DeliveryResolution | { ok: false; reason: 'DIRECCION_REQUERIDA' } | null = null;
    let tarifa = 0;
    if (input.modo === 'ENTREGA') {
      entrega = input.direccion
        ? await this.delivery.resolver([input.direccion.lng, input.direccion.lat], subtotal)
        : { ok: false, reason: 'DIRECCION_REQUERIDA' };
      if (entrega.ok) {
        ubicacionId = entrega.ubicacionId;
        tarifa = entrega.tarifaCents;
      } else if ('ubicacionId' in entrega && entrega.ubicacionId) {
        ubicacionId = entrega.ubicacionId;
      } else if ('masCercana' in entrega && entrega.masCercana) {
        ubicacionId = ubicacionId ?? entrega.masCercana.ubicacionId; // solo para mostrar disponibilidad
      }
    }
    if (!ubicacionId) throw new BadRequestException({ code: 'TIENDA_REQUERIDA', message: 'Elige una tienda para continuar' });

    const [u] = await this.db.select().from(ubicacion).where(eq(ubicacion.id, ubicacionId));
    if (!u || u.tipo !== 'TIENDA' || !u.aceptaOnline) throw notFound('La tienda');

    const disp = await this.inventory.availability(ubicacionId, lineas.map((l) => l.skuId), this.clock.now());
    const problemas = lineas
      .filter((l) => !(disp.get(l.skuId)?.disponible ?? false))
      .map((l) => ({ skuId: l.skuId, motivo: 'NO_DISPONIBLE' as const }));

    const estimado = computeTotals({ lineCents: lineas.map((l) => l.estimadoCents), deliveryFeeCents: tarifa, tipCents: input.propinaCents });
    const autorizado = computeTotals({ lineCents: lineas.map((l) => l.autorizadoCents), deliveryFeeCents: tarifa, tipCents: input.propinaCents });
    return {
      /** Tienda efectiva: la elegida (recojo) o la que cubre la dirección (entrega). */
      ubicacionId,
      tienda: { id: u.id, nombre: u.nombre, ciudad: u.ciudad },
      distanciaKm: entrega && entrega.ok ? Math.round(entrega.distanciaKm * 10) / 10 : null,
      modo: input.modo as FulfillmentMode,
      lineas,
      subtotalCents: estimado.subtotalCents,
      tarifaEntregaCents: tarifa,
      propinaCents: input.propinaCents,
      totalEstimadoCents: estimado.totalCents,
      totalAutorizadoCents: autorizado.totalCents,
      entrega,
      problemas,
      puedePedir: problemas.length === 0 && (input.modo === 'RECOJO' || entrega?.ok === true),
    };
  }

  async getSaved(clienteId: string) {
    const [c] = await this.db.select().from(carrito).where(eq(carrito.clienteId, clienteId));
    return c ? { ubicacionId: c.ubicacionId, items: c.items, actualizadoEn: c.actualizadoEn } : { ubicacionId: null, items: [], actualizadoEn: null };
  }

  async save(clienteId: string, ubicacionId: string | null, items: LineInput[]) {
    const now = this.clock.now();
    await this.db
      .insert(carrito)
      .values({ clienteId, ubicacionId, items, actualizadoEn: now })
      .onConflictDoUpdate({ target: carrito.clienteId, set: { ubicacionId, items, actualizadoEn: now } });
    return this.getSaved(clienteId);
  }
}
