import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import {
  coldChainStatus,
  deliveryEstimate,
  resolveDelivery,
  type CourierLoad,
  type DeliveryEstimate,
  type DeliveryQuote,
  type EstimateParams,
  type LngLat,
  type StoreDelivery,
} from '@prolac/domain';
import type { Db, Tx } from '../../db/client';
import { cliente, entrega, pedido, repartidorTurno, ubicacion } from '../../db/schema';
import { BUSINESS_CONFIG, CLOCK, DB, type BusinessConfig, type Clock } from '../../common/tokens';

type Q = Db | Tx;

/** Pedidos de entrega que aún no han salido de la tienda: son los que están "delante" de uno nuevo. */
const ESTADOS_POR_ALISTAR = ['CONFIRMADO', 'ALISTANDO', 'FALTANTE'] as const;
const ESTADOS_POR_SALIR = ['EMPACADO'] as const;

/** Entregar nunca se rechaza por carga: la cotización solo trae el tiempo estimado que verá el cliente. */
export type DeliveryResolution = DeliveryQuote & { estimado?: DeliveryEstimate };

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

  private estimateParams(): EstimateParams {
    return {
      idealTripMinutes: this.cfg.idealTripMinutes,
      prepMinutesPerOrder: this.cfg.prepMinutesPerOrder,
      courierCycleMinutes: this.cfg.courierCycleMinutes,
      ordersPerTrip: this.cfg.pedidosPorViaje,
      noCourierBufferMinutes: this.cfg.noCourierBufferMinutes,
      roundingMinutes: this.cfg.etaRoundingMinutes,
    };
  }

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

  private async contarEntregas(q: Q, ubicacionId: string, estados: readonly (typeof pedido.$inferSelect.estado)[]): Promise<number> {
    const rows = await q
      .select({ id: pedido.id })
      .from(pedido)
      .where(and(eq(pedido.ubicacionId, ubicacionId), eq(pedido.modo, 'ENTREGA'), inArray(pedido.estado, [...estados])));
    return rows.length;
  }

  /** Carga actual de la tienda y el tiempo estimado que se le mostraría a un cliente nuevo. */
  async carga(ubicacionId: string) {
    const [couriers, porAlistar, porSalir] = await Promise.all([
      this.courierLoads(this.db, ubicacionId),
      this.contarEntregas(this.db, ubicacionId, ESTADOS_POR_ALISTAR),
      this.contarEntregas(this.db, ubicacionId, ESTADOS_POR_SALIR),
    ]);
    const estimado = deliveryEstimate(
      { pedidosPorAlistar: porAlistar, pedidosEsperandoSalir: porSalir, repartidoresEnTurno: couriers.length },
      this.estimateParams(),
    );
    return { couriers, porAlistar, porSalir, estimado };
  }

  /**
   * Qué tienda atiende una dirección y cuánto tardaría. La única razón para no repartir es estar
   * fuera del radio de cobertura: ni la carga ni el tamaño del pedido rechazan una entrega.
   */
  async resolver(punto: LngLat, subtotalCents: number): Promise<DeliveryResolution> {
    const q = resolveDelivery(await this.tiendasConReparto(), punto, subtotalCents);
    if (!q.ok) return q;
    return { ...q, estimado: (await this.carga(q.ubicacionId)).estimado };
  }

  /** Resumen para el panel de la tienda: carga, repartidores, pedidos en ruta con semáforo y promesas vencidas. */
  async resumen(ubicacionId: string) {
    const now = this.clock.now();
    const c = await this.carga(ubicacionId);
    const enRuta = await this.db
      .select({ p: pedido, e: entrega, repartidor: cliente.nombre })
      .from(pedido)
      .innerJoin(entrega, eq(entrega.pedidoId, pedido.id))
      .leftJoin(cliente, eq(cliente.id, entrega.repartidorId))
      .where(and(eq(pedido.ubicacionId, ubicacionId), eq(pedido.estado, 'EN_CAMINO')))
      .orderBy(desc(entrega.despachadoEn));
    const atrasados = await this.db
      .select({ id: pedido.id, numero: pedido.numero, prometido: pedido.entregaEstimadaEn })
      .from(pedido)
      .where(
        and(
          eq(pedido.ubicacionId, ubicacionId),
          eq(pedido.modo, 'ENTREGA'),
          inArray(pedido.estado, ['CONFIRMADO', 'ALISTANDO', 'FALTANTE', 'EMPACADO', 'EN_CAMINO']),
          lt(pedido.entregaEstimadaEn, now),
        ),
      );
    return {
      repartidores: c.couriers.map((r) => ({ id: r.id, nombre: r.nombre, enRuta: r.enRuta })),
      sinRepartidores: c.couriers.length === 0,
      pedidosPorAlistar: c.porAlistar,
      pedidosEsperandoSalir: c.porSalir,
      nivelCarga: c.estimado.nivelCarga,
      /** Lo que vería hoy un cliente nuevo. */
      estimadoNuevo: { minMin: c.estimado.minMin, maxMin: c.estimado.maxMin },
      metaViajeMin: this.cfg.idealTripMinutes,
      enRuta: enRuta.map((r) => {
        const st = r.e.despachadoEn ? coldChainStatus(r.e.despachadoEn, now, this.cfg.idealTripMinutes) : null;
        return {
          pedidoId: r.p.id,
          numero: r.p.numero,
          repartidor: r.repartidor,
          limiteFrioEn: st?.limite ?? null,
          minutosRestantes: st?.minutosRestantes ?? null,
          demorado: st?.demorado ?? false,
        };
      }),
      /** Pedidos cuya hora prometida al cliente ya pasó y siguen sin entregarse. */
      conPromesaVencida: atrasados.map((a) => ({ pedidoId: a.id, numero: a.numero, prometidoEn: a.prometido })),
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
