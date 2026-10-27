import { haversineKm, type LngLat } from './geo.js';
import type { Cents } from './money.js';

export type { LngLat } from './geo.js';

/** Datos de reparto de una tienda: cubre un radio máximo y cobra una tarifa plana. Sin pedido mínimo. */
export interface StoreDelivery {
  id: string;
  nombre: string;
  ubicacion: LngLat;
  /** Radio máximo de cobertura en km (hoy 4). */
  radioKm: number;
  tarifaCents: Cents;
  /** Si el subtotal alcanza este monto, el envío es gratis. */
  envioGratisDesdeCents?: Cents;
}

/**
 * La única razón para no repartir es la cobertura (radio de la tienda). No hay pedido mínimo
 * ni rechazo por carga: si el pedido es chico, se suma el costo de reparto y listo.
 */
export type DeliveryQuote =
  | { ok: true; ubicacionId: string; nombre: string; distanciaKm: number; tarifaCents: Cents }
  | {
      ok: false;
      reason: 'FUERA_DE_COBERTURA';
      /** La tienda más cercana (aunque no llegue) y a cuánto está. */
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
  const gratis = store.envioGratisDesdeCents !== undefined && subtotalCents >= store.envioGratisDesdeCents;
  return { ok: true, ubicacionId: store.id, nombre: store.nombre, distanciaKm, tarifaCents: gratis ? 0 : store.tarifaCents };
}

export type ColdChainLevel = 'EN_TIEMPO' | 'DEMORADO';

export interface ColdChainStatus {
  /** Hora en que se cumple la meta de viaje (salida + 20 min). */
  limite: Date;
  /** Minutos que faltan para la meta (redondeados hacia arriba); negativo si ya se pasó. */
  minutosRestantes: number;
  /** Pasó de la meta. NO es un fallo ni bloquea nada: solo se avisa y se registra. */
  demorado: boolean;
  /** Semáforo: verde dentro de la meta, ámbar después. No hay nivel crítico (decisión del propietario). */
  nivel: ColdChainLevel;
}

/** Hora meta de llegada de un pedido que va en cooler. El reloj arranca cuando el repartidor sale de la tienda. */
export function coldChainDeadline(salida: Date, idealMinutes: number): Date {
  return new Date(salida.getTime() + idealMinutes * 60_000);
}

export function coldChainStatus(salida: Date, ahora: Date, idealMinutes: number): ColdChainStatus {
  const limite = coldChainDeadline(salida, idealMinutes);
  const ms = limite.getTime() - ahora.getTime();
  const demorado = ms < 0;
  return { limite, minutosRestantes: Math.ceil(ms / 60_000), demorado, nivel: demorado ? 'DEMORADO' : 'EN_TIEMPO' };
}

export function isWithinIdealTrip(salida: Date, at: Date, idealMinutes: number): boolean {
  return !coldChainStatus(salida, at, idealMinutes).demorado;
}
