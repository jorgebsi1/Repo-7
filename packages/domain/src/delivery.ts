import { haversineKm, type LngLat } from './geo.js';
import type { Cents } from './money.js';

export type { LngLat } from './geo.js';

/** Datos de reparto de una tienda: cubre un radio máximo y cobra una tarifa plana. */
export interface StoreDelivery {
  id: string;
  nombre: string;
  ubicacion: LngLat;
  /** Radio máximo de cobertura en km (hoy 4). */
  radioKm: number;
  tarifaCents: Cents;
  pedidoMinimoCents: Cents;
  /** Si el subtotal alcanza este monto, el envío es gratis. */
  envioGratisDesdeCents?: Cents;
}

export type DeliveryQuote =
  | { ok: true; ubicacionId: string; nombre: string; distanciaKm: number; tarifaCents: Cents }
  | {
      ok: false;
      reason: 'FUERA_DE_COBERTURA' | 'BAJO_PEDIDO_MINIMO';
      /** Para BAJO_PEDIDO_MINIMO: la tienda que atendería y su mínimo. */
      ubicacionId?: string;
      pedidoMinimoCents?: Cents;
      /** Para FUERA_DE_COBERTURA: la tienda más cercana (aunque no llegue) y a cuánto está. */
      masCercana?: { ubicacionId: string; nombre: string; distanciaKm: number };
    };

/** Tienda más cercana que cubre el punto, o null si ninguna llega. */
export function nearestCoveringStore(
  stores: readonly StoreDelivery[],
  point: LngLat,
): { store: StoreDelivery; distanciaKm: number } | null {
  let best: { store: StoreDelivery; distanciaKm: number } | null = null;
  for (const store of stores) {
    const d = haversineKm(store.ubicacion, point);
    if (d <= store.radioKm && (!best || d < best.distanciaKm)) best = { store, distanciaKm: d };
  }
  return best;
}

/**
 * Elige automáticamente la tienda que atiende una dirección (la más cercana dentro de su radio)
 * y calcula la tarifa. Los pedidos por mayor (planta) quedan fuera del piloto.
 */
export function resolveDelivery(stores: readonly StoreDelivery[], point: LngLat, subtotalCents: Cents): DeliveryQuote {
  const hit = nearestCoveringStore(stores, point);
  if (!hit) {
    const nearest = stores
      .map((s) => ({ s, d: haversineKm(s.ubicacion, point) }))
      .sort((x, y) => x.d - y.d)[0];
    return {
      ok: false,
      reason: 'FUERA_DE_COBERTURA',
      masCercana: nearest ? { ubicacionId: nearest.s.id, nombre: nearest.s.nombre, distanciaKm: nearest.d } : undefined,
    };
  }
  const { store, distanciaKm } = hit;
  if (subtotalCents < store.pedidoMinimoCents) {
    return { ok: false, reason: 'BAJO_PEDIDO_MINIMO', ubicacionId: store.id, pedidoMinimoCents: store.pedidoMinimoCents };
  }
  const gratis = store.envioGratisDesdeCents !== undefined && subtotalCents >= store.envioGratisDesdeCents;
  return { ok: true, ubicacionId: store.id, nombre: store.nombre, distanciaKm, tarifaCents: gratis ? 0 : store.tarifaCents };
}

export interface ColdChainStatus {
  limite: Date;
  /** Minutos que faltan (redondeados hacia arriba); negativo o 0 si ya se pasó. */
  minutosRestantes: number;
  excedido: boolean;
}

/** Hora límite para entregar un pedido que salió en cooler. El reloj arranca cuando el repartidor sale de la tienda. */
export function coldChainDeadline(salida: Date, maxMinutes: number): Date {
  return new Date(salida.getTime() + maxMinutes * 60_000);
}

export function coldChainStatus(salida: Date, ahora: Date, maxMinutes: number): ColdChainStatus {
  const limite = coldChainDeadline(salida, maxMinutes);
  const ms = limite.getTime() - ahora.getTime();
  return { limite, minutosRestantes: Math.ceil(ms / 60_000), excedido: ms < 0 };
}

export function isWithinColdChain(salida: Date, at: Date, maxMinutes: number): boolean {
  return !coldChainStatus(salida, at, maxMinutes).excedido;
}
