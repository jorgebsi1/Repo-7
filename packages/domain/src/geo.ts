/** [longitud, latitud] en grados. */
export type LngLat = readonly [number, number];

const EARTH_RADIUS_KM = 6371.0088;
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Distancia en línea recta (círculo máximo) entre dos puntos, en km.
 * OJO: es menor que la distancia real por calle; sirve como regla simple de cobertura hasta tener mapas.
 */
export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
