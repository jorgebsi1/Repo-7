export interface CourierLoad {
  id: string;
  /** Pedidos que lleva en ruta ahora mismo. */
  enRuta: number;
  /** Desde cuándo está libre (para desempatar: el que más lleva esperando). */
  libreDesde: Date;
}

/**
 * Repartidor con menos pedidos en ruta; a igualdad, el que lleva más tiempo libre y, al final, por id.
 * NO hay tope: si todos están ocupados igual se asigna al menos cargado (nunca se rechaza una entrega).
 */
export function pickCourier(couriers: readonly CourierLoad[]): CourierLoad | null {
  const sorted = [...couriers].sort((a, b) => a.enRuta - b.enRuta || a.libreDesde.getTime() - b.libreDesde.getTime() || a.id.localeCompare(b.id));
  return sorted[0] ?? null;
}
