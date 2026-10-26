import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, lt, or } from 'drizzle-orm';
import { allocateFEFO, reservationExpiry, type BatchStock } from '@prolac/domain';
import type { Db, Tx } from '../../db/client';
import { disponibilidadTienda, lote, reservaStock } from '../../db/schema';
import { BUSINESS_CONFIG, DB, type BusinessConfig } from '../../common/tokens';

export interface ReserveLine {
  lineaId: string;
  skuId: string;
  /** Unidades (PACK) o gramos (PESO). */
  cantidad: number;
}

export interface ShortLine {
  lineaId: string;
  skuId: string;
  motivo: 'NO_DISPONIBLE' | 'STOCK_INSUFICIENTE';
}

export class StockShortage extends Error {
  constructor(public readonly lineas: ShortLine[]) {
    super('Stock insuficiente');
  }
}

type Q = Db | Tx;

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(BUSINESS_CONFIG) private readonly cfg: BusinessConfig,
  ) {}

  private activeReservations(q: Q, ubicacionId: string, skuIds: string[], now: Date) {
    return q
      .select()
      .from(reservaStock)
      .where(
        and(
          eq(reservaStock.ubicacionId, ubicacionId),
          inArray(reservaStock.skuId, skuIds),
          eq(reservaStock.liberada, false),
          eq(reservaStock.consumida, false),
          or(eq(reservaStock.confirmada, true), gt(reservaStock.expiraEn, now)),
        ),
      );
  }

  /** Disponibilidad pública de varios SKU en una tienda (para el catálogo y el carrito). */
  async availability(
    ubicacionId: string,
    skuIds: string[],
    now: Date,
  ): Promise<Map<string, { disponible: boolean; vendible: number | null; venceEn: Date | null }>> {
    const out = new Map<string, { disponible: boolean; vendible: number | null; venceEn: Date | null }>();
    if (skuIds.length === 0) return out;
    const [disp, reservas, lotes] = await Promise.all([
      this.db
        .select()
        .from(disponibilidadTienda)
        .where(and(eq(disponibilidadTienda.ubicacionId, ubicacionId), inArray(disponibilidadTienda.skuId, skuIds))),
      this.activeReservations(this.db, ubicacionId, skuIds, now),
      this.db
        .select()
        .from(lote)
        .where(and(eq(lote.ubicacionId, ubicacionId), inArray(lote.skuId, skuIds), gt(lote.cantidadDisponible, 0)))
        .orderBy(asc(lote.venceEn)),
    ]);
    for (const skuId of skuIds) {
      const d = disp.find((x) => x.skuId === skuId);
      const reservado = reservas.filter((r) => r.skuId === skuId).reduce((a, r) => a + r.cantidad, 0);
      const vendible = d?.cantidad == null ? null : Math.max(d.cantidad - d.stockSeguridadOnline - reservado, 0);
      const minVence = new Date(now.getTime() + this.cfg.minRemainingShelfLifeDays * 86_400_000);
      const firstUsable = lotes.find((l) => l.skuId === skuId && l.venceEn >= minVence);
      const hayLotes = lotes.some((l) => l.skuId === skuId);
      out.set(skuId, {
        disponible: !!d?.disponible && vendible !== 0 && (!hayLotes || !!firstUsable),
        vendible,
        venceEn: firstUsable?.venceEn ?? null,
      });
    }
    return out;
  }

  /**
   * Reserva stock para un pedido dentro de la transacción del pedido.
   * Usa lotes con vencimiento más próximo primero (FEFO) si el SKU tiene lotes; si no, solo el indicador de disponibilidad.
   */
  async reserve(
    tx: Tx,
    input: { pedidoId: string; ubicacionId: string; lines: ReserveLine[]; deliverAt: Date; now: Date },
  ): Promise<void> {
    const { pedidoId, ubicacionId, lines, deliverAt, now } = input;
    const skuIds = [...new Set(lines.map((l) => l.skuId))];
    // Bloquea las filas de disponibilidad para que dos pedidos simultáneos no vendan el mismo stock.
    const disp = await tx
      .select()
      .from(disponibilidadTienda)
      .where(and(eq(disponibilidadTienda.ubicacionId, ubicacionId), inArray(disponibilidadTienda.skuId, skuIds)))
      .for('update');
    const reservas = await this.activeReservations(tx, ubicacionId, skuIds, now);
    const lotes = await tx
      .select()
      .from(lote)
      .where(and(eq(lote.ubicacionId, ubicacionId), inArray(lote.skuId, skuIds), gt(lote.cantidadDisponible, 0)));

    const faltantes: ShortLine[] = [];
    const nuevas: (typeof reservaStock.$inferInsert)[] = [];
    // Lo que este mismo pedido ya aparta (dos líneas del mismo SKU).
    const apartadoLote = new Map<string, number>();
    const apartadoSku = new Map<string, number>();

    for (const l of lines) {
      const d = disp.find((x) => x.skuId === l.skuId);
      if (!d || !d.disponible) {
        faltantes.push({ lineaId: l.lineaId, skuId: l.skuId, motivo: 'NO_DISPONIBLE' });
        continue;
      }
      if (d.cantidad != null) {
        const reservado = reservas.filter((r) => r.skuId === l.skuId).reduce((a, r) => a + r.cantidad, 0);
        const yaMio = apartadoSku.get(l.skuId) ?? 0;
        if (l.cantidad > d.cantidad - d.stockSeguridadOnline - reservado - yaMio) {
          faltantes.push({ lineaId: l.lineaId, skuId: l.skuId, motivo: 'STOCK_INSUFICIENTE' });
          continue;
        }
      }
      const lotesSku = lotes.filter((x) => x.skuId === l.skuId);
      if (lotesSku.length === 0) {
        apartadoSku.set(l.skuId, (apartadoSku.get(l.skuId) ?? 0) + l.cantidad);
        nuevas.push({
          pedidoId,
          lineaId: l.lineaId,
          ubicacionId,
          skuId: l.skuId,
          loteId: null,
          cantidad: l.cantidad,
          expiraEn: reservationExpiry(now, this.cfg.reservationTtlMinutes),
        });
        continue;
      }
      const stocks: BatchStock[] = lotesSku.map((x) => ({
        loteId: x.id,
        expiresAt: x.venceEn,
        disponible:
          x.cantidadDisponible -
          reservas.filter((r) => r.loteId === x.id).reduce((a, r) => a + r.cantidad, 0) -
          (apartadoLote.get(x.id) ?? 0),
      }));
      const r = allocateFEFO(stocks, l.cantidad, deliverAt, this.cfg.minRemainingShelfLifeDays);
      if (r.faltante > 0) {
        faltantes.push({ lineaId: l.lineaId, skuId: l.skuId, motivo: 'STOCK_INSUFICIENTE' });
        continue;
      }
      for (const a of r.allocations) {
        apartadoLote.set(a.loteId, (apartadoLote.get(a.loteId) ?? 0) + a.cantidad);
        apartadoSku.set(l.skuId, (apartadoSku.get(l.skuId) ?? 0) + a.cantidad);
        nuevas.push({
          pedidoId,
          lineaId: l.lineaId,
          ubicacionId,
          skuId: l.skuId,
          loteId: a.loteId,
          cantidad: a.cantidad,
          expiraEn: reservationExpiry(now, this.cfg.reservationTtlMinutes),
        });
      }
    }
    if (faltantes.length) throw new StockShortage(faltantes);
    if (nuevas.length) await tx.insert(reservaStock).values(nuevas);
  }

  /** El pago se autorizó: la reserva deja de caducar. */
  async confirm(tx: Tx, pedidoId: string): Promise<void> {
    await tx
      .update(reservaStock)
      .set({ confirmada: true })
      .where(and(eq(reservaStock.pedidoId, pedidoId), eq(reservaStock.liberada, false)));
  }

  /** Libera lo que no se consumió (cancelación, pago abandonado, reembolso, faltante). */
  async release(tx: Tx, pedidoId: string, lineaId?: string): Promise<void> {
    await tx
      .update(reservaStock)
      .set({ liberada: true })
      .where(
        and(
          eq(reservaStock.pedidoId, pedidoId),
          eq(reservaStock.consumida, false),
          lineaId ? eq(reservaStock.lineaId, lineaId) : undefined,
        ),
      );
  }

  /**
   * La tienda alistó la línea: se descuenta lo realmente usado (unidades o gramos finales)
   * de los lotes y, si se controla cantidad, de la disponibilidad de la tienda.
   */
  async consumeLine(tx: Tx, pedidoId: string, lineaId: string, cantidadReal: number): Promise<void> {
    const reservas = await tx
      .select()
      .from(reservaStock)
      .where(and(eq(reservaStock.pedidoId, pedidoId), eq(reservaStock.lineaId, lineaId), eq(reservaStock.liberada, false)));
    let restante = cantidadReal;
    let total = 0;
    let ubicacionId: string | null = null;
    let skuId: string | null = null;
    for (const r of reservas) {
      const take = Math.min(restante, r.cantidad);
      restante -= take;
      total += take;
      ubicacionId = r.ubicacionId;
      skuId = r.skuId;
      if (r.loteId && take > 0) {
        const [l] = await tx.select().from(lote).where(eq(lote.id, r.loteId)).for('update');
        if (l) await tx.update(lote).set({ cantidadDisponible: Math.max(l.cantidadDisponible - take, 0) }).where(eq(lote.id, l.id));
      }
      await tx.update(reservaStock).set({ consumida: true }).where(eq(reservaStock.id, r.id));
    }
    if (ubicacionId && skuId && total > 0) {
      const [d] = await tx
        .select()
        .from(disponibilidadTienda)
        .where(and(eq(disponibilidadTienda.ubicacionId, ubicacionId), eq(disponibilidadTienda.skuId, skuId)))
        .for('update');
      if (d?.cantidad != null) {
        await tx
          .update(disponibilidadTienda)
          .set({ cantidad: Math.max(d.cantidad - total, 0) })
          .where(and(eq(disponibilidadTienda.ubicacionId, ubicacionId), eq(disponibilidadTienda.skuId, skuId)));
      }
    }
  }

  /** La tienda marca un producto como agotado (o disponible de nuevo). */
  async setDisponible(ubicacionId: string, skuId: string, disponible: boolean): Promise<void> {
    await this.db
      .update(disponibilidadTienda)
      .set({ disponible })
      .where(and(eq(disponibilidadTienda.ubicacionId, ubicacionId), eq(disponibilidadTienda.skuId, skuId)));
  }

  /** Marca como liberadas las reservas sin confirmar cuyo plazo venció (limpieza periódica). */
  async releaseExpired(now: Date): Promise<number> {
    const rows = await this.db
      .update(reservaStock)
      .set({ liberada: true })
      .where(and(eq(reservaStock.confirmada, false), eq(reservaStock.liberada, false), eq(reservaStock.consumida, false), lt(reservaStock.expiraEn, now)))
      .returning({ id: reservaStock.id });
    return rows.length;
  }
}
