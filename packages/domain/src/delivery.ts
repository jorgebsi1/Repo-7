import type { Cents } from './money.js';

/** [longitud, latitud] */
export type LngLat = readonly [number, number];
export type Polygon = readonly LngLat[];

/** Punto en polígono (ray casting). Suficiente para zonas de reparto simples sin PostGIS. */
export function pointInPolygon(point: LngLat, polygon: Polygon): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export interface DeliveryZone {
  id: string;
  ubicacionId: string;
  nombre: string;
  poligono: Polygon;
  tarifaCents: Cents;
  pedidoMinimoCents: Cents;
  /** Si el subtotal alcanza este monto, el envío es gratis. */
  envioGratisDesdeCents?: Cents;
}

export function findZone(zones: readonly DeliveryZone[], ubicacionId: string, point: LngLat): DeliveryZone | undefined {
  return zones.find((z) => z.ubicacionId === ubicacionId && pointInPolygon(point, z.poligono));
}

export type DeliveryQuote =
  | { ok: true; zonaId: string; tarifaCents: Cents }
  | { ok: false; reason: 'FUERA_DE_ZONA' | 'BAJO_PEDIDO_MINIMO'; pedidoMinimoCents?: Cents };

export function quoteDelivery(
  zones: readonly DeliveryZone[],
  ubicacionId: string,
  point: LngLat,
  subtotalCents: Cents,
): DeliveryQuote {
  const zone = findZone(zones, ubicacionId, point);
  if (!zone) return { ok: false, reason: 'FUERA_DE_ZONA' };
  if (subtotalCents < zone.pedidoMinimoCents) {
    return { ok: false, reason: 'BAJO_PEDIDO_MINIMO', pedidoMinimoCents: zone.pedidoMinimoCents };
  }
  const gratis = zone.envioGratisDesdeCents !== undefined && subtotalCents >= zone.envioGratisDesdeCents;
  return { ok: true, zonaId: zone.id, tarifaCents: gratis ? 0 : zone.tarifaCents };
}

/** Hora límite para que un pedido empacado llegue al cliente sin romper la cadena de frío. */
export function coldChainDeadline(packedAt: Date, maxMinutesOutOfFridge: number): Date {
  return new Date(packedAt.getTime() + maxMinutesOutOfFridge * 60_000);
}

export function isWithinColdChain(packedAt: Date, at: Date, maxMinutesOutOfFridge: number): boolean {
  return at.getTime() <= coldChainDeadline(packedAt, maxMinutesOutOfFridge).getTime();
}
