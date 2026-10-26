export interface CourierLoad {
  id: string;
  /** Pedidos que lleva en ruta ahora mismo. */
  enRuta: number;
  /** Desde cuándo está libre (para desempatar: el que más lleva esperando). */
  libreDesde: Date;
}

export interface DeliveryCapacity {
  repartidoresEnTurno: number;
  /** Pedidos de entrega activos de la tienda (confirmados, en alistado, empacados o en camino). */
  pedidosActivos: number;
  maxPorRepartidor: number;
}

export type CapacityResult = { ok: true } | { ok: false; reason: 'SIN_REPARTIDORES' | 'REPARTO_SATURADO' };

/**
 * ¿Se puede aceptar otro pedido de entrega? Con pocos repartidores y 20 minutos de frío,
 * es mejor ofrecer recojo que prometer algo que no se puede cumplir.
 */
export function deliveryCapacity(c: DeliveryCapacity): CapacityResult {
  if (c.repartidoresEnTurno <= 0) return { ok: false, reason: 'SIN_REPARTIDORES' };
  if (c.pedidosActivos >= c.repartidoresEnTurno * c.maxPorRepartidor) return { ok: false, reason: 'REPARTO_SATURADO' };
  return { ok: true };
}

/** Repartidor con menos pedidos en ruta (sin superar el máximo); a igualdad, el que lleva más tiempo libre. */
export function pickCourier(couriers: readonly CourierLoad[], maxPorRepartidor: number): CourierLoad | null {
  const available = couriers.filter((c) => c.enRuta < maxPorRepartidor);
  // Desempate final por id para que la asignación sea siempre la misma ante igualdad total.
  available.sort((a, b) => a.enRuta - b.enRuta || a.libreDesde.getTime() - b.libreDesde.getTime() || a.id.localeCompare(b.id));
  return available[0] ?? null;
}
