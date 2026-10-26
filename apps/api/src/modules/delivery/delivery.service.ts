import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, desc } from 'drizzle-orm';
import {
  coldChainStatus,
  deliveryCapacity,
  resolveDelivery,
  type CourierLoad,
  type DeliveryQuote,
  type LngLat,
  type StoreDelivery,
} from '@prolac/domain';
import type { Db, Tx } from '../../db/client';
import { cliente, entrega, pedido, repartidorTurno, ubicacion } from '../../db/schema';
import { BUSINESS_CONFIG, CLOCK, DB, type BusinessConfig, type Clock } from '../../common/tokens';

type Q = Db | Tx;

/** Pedidos de entrega que ya ocupan capacidad de reparto de la tienda. */
export const ESTADOS_REPARTO_ACTIVO = ['CONFIRMADO', 'ALISTANDO', 'FALTANTE', 'EMPACADO', 'EN_CAMINO'] as const;

export type DeliveryResolution =
  | DeliveryQuote
  | { ok: false; reason: 'SIN_REPARTIDORES' | 'REPARTO_SATURADO'; ubicacionId: string };

export interface CourierRow extends CourierLoad {
  nombre: string;
}

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BUSINESS_CONFIG) private readonly cfg: BusinessConfig,
  ) {}

  /** Tiendas con venta en línea y coordenadas: las únicas que pueden atender una entrega. */
  async tiendasConReparto(): Promise<StoreDelivery[]> {
    const rows = await this.db
      .select()
      .from(ubicacion)
      .where(and(eq(ubicacion.tipo, 'TIENDA'), eq(ubicacion.activo, true), eq(ubicacion.aceptaOnline, true)));
    return rows
      .filter((u) => u.lat != null && u.lng != null)
      .map((u) => ({
        id: u.id,
        nombre: u.nombre,
        ubicacion: [u.lng!, u.lat!] as LngLat,
        radioKm: u.radioEntregaKm,
        tarifaCents: u.tarifaEntregaCents,
        pedidoMinimoCents: u.pedidoMinimoEntregaCents,
        envioGratisDesdeCents: u.envioGratisDesdeCents ?? undefined,
      }));
  }

  /** Repartidores en turno en la tienda, con los pedidos que llevan en ruta. */
  async courierLoads(q: Q, ubicacionId: string): Promise<CourierRow[]> {
    const turnos = await q
      .select({ id: repartidorTurno.repartidorId, desde: repartidorTurno.desde, nombre: cliente.nombre })
      .from(repartidorTurno)
      .innerJoin(cliente, eq(cliente.id, repartidorTurno.repartidorId))
      .where(and(eq(repartidorTurno.ubicacionId, ubicacionId), eq(repartidorTurno.enTurno, true)));
    if (turnos.length === 0) return [];
    const ids = turnos.map((t) => t.id);
    const rutas = await q
      .select({ repartidorId: entrega.repartidorId, estado: pedido.estado, entregadoEn: entrega.entregadoEn })
      .from(entrega)
      .innerJoin(pedido, eq(pedido.id, entrega.pedidoId))
      .where(inArray(entrega.repartidorId, ids));
    return turnos.map((t) => {
      const mias = rutas.filter((r) => r.repartidorId === t.id);
      const ultimaEntrega = mias.map((r) => r.entregadoEn?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
      return {
        id: t.id,
        nombre: t.nombre,
        enRuta: mias.filter((r) => r.estado === 'EN_CAMINO').length,
        libreDesde: new Date(Math.max(ultimaEntrega, t.desde.getTime())),
      };
    });
  }

  async pedidosActivos(q: Q, ubicacionId: string): Promise<number> {
    const rows = await q
      .select({ id: pedido.id })
      .from(pedido)
      .where(and(eq(pedido.ubicacionId, ubicacionId), eq(pedido.modo, 'ENTREGA'), inArray(pedido.estado, [...ESTADOS_REPARTO_ACTIVO])));
    return rows.length;
  }

  async capacidad(ubicacionId: string) {
    const [couriers, activos] = await Promise.all([this.courierLoads(this.db, ubicacionId), this.pedidosActivos(this.db, ubicacionId)]);
    return {
      couriers,
      pedidosActivos: activos,
      maxPorRepartidor: this.cfg.maxPedidosPorRepartidor,
      resultado: deliveryCapacity({ repartidoresEnTurno: couriers.length, pedidosActivos: activos, maxPorRepartidor: this.cfg.maxPedidosPorRepartidor }),
    };
  }

  /**
   * Qué tienda atiende una dirección: la más cercana dentro de su radio, con pedido mínimo y capacidad de reparto.
   * Los pedidos por mayor (desde planta) no entran al piloto.
   */
  async resolver(punto: LngLat, subtotalCents: number): Promise<DeliveryResolution> {
    const q = resolveDelivery(await this.tiendasConReparto(), punto, subtotalCents);
    if (!q.ok) return q;
    const cap = await this.capacidad(q.ubicacionId);
    if (!cap.resultado.ok) return { ok: false, reason: cap.resultado.reason, ubicacionId: q.ubicacionId };
    return q;
  }

  /** Resumen para el panel de la tienda: repartidores en turno y pedidos en ruta con su cuenta de frío. */
  async resumen(ubicacionId: string) {
    const now = this.clock.now();
    const cap = await this.capacidad(ubicacionId);
    const enRuta = await this.db
      .select({ p: pedido, e: entrega, repartidor: cliente.nombre })
      .from(pedido)
      .innerJoin(entrega, eq(entrega.pedidoId, pedido.id))
      .leftJoin(cliente, eq(cliente.id, entrega.repartidorId))
      .where(and(eq(pedido.ubicacionId, ubicacionId), eq(pedido.estado, 'EN_CAMINO')))
      .orderBy(desc(entrega.despachadoEn));
    return {
      repartidores: cap.couriers.map((c) => ({ id: c.id, nombre: c.nombre, enRuta: c.enRuta })),
      pedidosActivos: cap.pedidosActivos,
      capacidadMaxima: cap.couriers.length * cap.maxPorRepartidor,
      aceptaEntregas: cap.resultado.ok,
      motivoNoAcepta: cap.resultado.ok ? null : cap.resultado.reason,
      maxMinutosFrio: this.cfg.maxMinutesOutOfFridge,
      enRuta: enRuta.map((r) => {
        const st = r.e.despachadoEn ? coldChainStatus(r.e.despachadoEn, now, this.cfg.maxMinutesOutOfFridge) : null;
        return {
          pedidoId: r.p.id,
          numero: r.p.numero,
          repartidor: r.repartidor,
          limiteFrioEn: st?.limite ?? null,
          minutosRestantes: st?.minutosRestantes ?? null,
          excedido: st?.excedido ?? false,
        };
      }),
    };
  }

  async setTurno(repartidorId: string, ubicacionId: string, enTurno: boolean): Promise<void> {
    const now = this.clock.now();
    await this.db
      .insert(repartidorTurno)
      .values({ repartidorId, ubicacionId, enTurno, desde: now })
      .onConflictDoUpdate({ target: repartidorTurno.repartidorId, set: { ubicacionId, enTurno, desde: now } });
  }

  async enTurno(repartidorId: string): Promise<boolean> {
    const [t] = await this.db.select().from(repartidorTurno).where(eq(repartidorTurno.repartidorId, repartidorId));
    return !!t?.enTurno;
  }
}
