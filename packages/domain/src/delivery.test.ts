import { describe, expect, it } from 'vitest';
import { deliveryCapacity, pickCourier } from './couriers.js';
import { coldChainDeadline, coldChainStatus, isWithinColdChain, nearestCoveringStore, resolveDelivery, type StoreDelivery } from './delivery.js';
import { haversineKm } from './geo.js';

// Tiendas ficticias en Trujillo (el reparto se calcula en línea recta, no por calle).
const CAS: StoreDelivery = { id: 'cas', nombre: 'Las Casuarinas', ubicacion: [-79.0268, -8.1342], radioKm: 4, tarifaCents: 600, pedidoMinimoCents: 2500, envioGratisDesdeCents: 9000 };
const T02: StoreDelivery = { id: 't02', nombre: 'Trujillo 2', ubicacion: [-79.0287, -8.1118], radioKm: 4, tarifaCents: 500, pedidoMinimoCents: 2000 };

/** Punto a `km` al este de un origen (a esa latitud 1° de longitud ≈ 110,2 km). */
const eastOf = (o: readonly [number, number], km: number): [number, number] => [o[0] + km / 110.2, o[1]];

describe('distancia', () => {
  it('haversine conocida: 1° de latitud ≈ 111,2 km y distancia cero', () => {
    expect(haversineKm([0, 0], [0, 1])).toBeCloseTo(111.19, 1);
    expect(haversineKm([-79, -8], [-79, -8])).toBe(0);
  });
});

describe('tienda más cercana dentro del radio de 4 km', () => {
  it('elige la más cercana de las que cubren', () => {
    const cerca2: [number, number] = [-79.028, -8.113];
    expect(nearestCoveringStore([CAS, T02], cerca2)?.store.id).toBe('t02');
    expect(nearestCoveringStore([CAS, T02], [-79.03, -8.133])?.store.id).toBe('cas');
  });

  it('3,9 km entra y 4,1 km queda fuera', () => {
    expect(nearestCoveringStore([CAS], eastOf(CAS.ubicacion, 3.9))).not.toBeNull();
    expect(nearestCoveringStore([CAS], eastOf(CAS.ubicacion, 4.1))).toBeNull();
  });

  it('una tienda que no llega no se elige aunque sea la más cercana de otra que sí llega', () => {
    const corta: StoreDelivery = { ...T02, radioKm: 0.1 };
    expect(nearestCoveringStore([corta, CAS], [-79.0285, -8.114])?.store.id).toBe('cas');
  });
});

describe('cotización de entrega', () => {
  const dentro: [number, number] = [-79.03, -8.133];

  it('tarifa de la tienda que atiende, con la distancia', () => {
    const q = resolveDelivery([CAS, T02], dentro, 5000);
    expect(q).toMatchObject({ ok: true, ubicacionId: 'cas', tarifaCents: 600 });
    expect(q.ok && q.distanciaKm).toBeLessThan(1);
  });

  it('envío gratis sobre el monto y pedido mínimo por tienda', () => {
    expect(resolveDelivery([CAS], dentro, 9000)).toMatchObject({ ok: true, tarifaCents: 0 });
    expect(resolveDelivery([CAS], dentro, 2000)).toEqual({ ok: false, reason: 'BAJO_PEDIDO_MINIMO', ubicacionId: 'cas', pedidoMinimoCents: 2500 });
  });

  it('fuera de cobertura informa cuál es la tienda más cercana y a cuánto', () => {
    const q = resolveDelivery([CAS, T02], eastOf(CAS.ubicacion, 6), 5000);
    expect(q.ok).toBe(false);
    expect(q).toMatchObject({ reason: 'FUERA_DE_COBERTURA', masCercana: { ubicacionId: 'cas' } });
    expect(!q.ok && q.masCercana!.distanciaKm).toBeGreaterThan(5.9);
  });

  it('sin tiendas con reparto, siempre fuera de cobertura', () => {
    expect(resolveDelivery([], dentro, 5000)).toEqual({ ok: false, reason: 'FUERA_DE_COBERTURA', masCercana: undefined });
  });
});

describe('ventana de frío (20 min desde que el repartidor sale)', () => {
  const salida = new Date('2026-03-10T15:00:00Z');

  it('límite y cuenta regresiva', () => {
    expect(coldChainDeadline(salida, 20).toISOString()).toBe('2026-03-10T15:20:00.000Z');
    expect(coldChainStatus(salida, new Date('2026-03-10T15:05:00Z'), 20)).toMatchObject({ minutosRestantes: 15, excedido: false });
    expect(coldChainStatus(salida, new Date('2026-03-10T15:19:30Z'), 20)).toMatchObject({ minutosRestantes: 1, excedido: false });
  });

  it('justo en el límite aún cumple; un segundo después se excede', () => {
    expect(isWithinColdChain(salida, new Date('2026-03-10T15:20:00Z'), 20)).toBe(true);
    expect(isWithinColdChain(salida, new Date('2026-03-10T15:20:01Z'), 20)).toBe(false);
    expect(coldChainStatus(salida, new Date('2026-03-10T15:23:00Z'), 20)).toMatchObject({ minutosRestantes: -3, excedido: true });
  });
});

describe('capacidad de reparto', () => {
  it('sin repartidores en turno no se acepta entrega', () => {
    expect(deliveryCapacity({ repartidoresEnTurno: 0, pedidosActivos: 0, maxPorRepartidor: 2 })).toEqual({ ok: false, reason: 'SIN_REPARTIDORES' });
  });

  it('con 2 repartidores y máximo 2 cada uno, el pedido 5 se rechaza', () => {
    expect(deliveryCapacity({ repartidoresEnTurno: 2, pedidosActivos: 3, maxPorRepartidor: 2 })).toEqual({ ok: true });
    expect(deliveryCapacity({ repartidoresEnTurno: 2, pedidosActivos: 4, maxPorRepartidor: 2 })).toEqual({ ok: false, reason: 'REPARTO_SATURADO' });
  });

  it('asigna al repartidor con menos pedidos; a igualdad, al que lleva más tiempo libre', () => {
    const t = (m: number) => new Date(2026, 2, 10, 15, m);
    expect(pickCourier([{ id: 'a', enRuta: 1, libreDesde: t(0) }, { id: 'b', enRuta: 0, libreDesde: t(10) }], 2)?.id).toBe('b');
    expect(pickCourier([{ id: 'a', enRuta: 0, libreDesde: t(10) }, { id: 'b', enRuta: 0, libreDesde: t(2) }], 2)?.id).toBe('b');
  });

  it('ante igualdad total el resultado es siempre el mismo (por id)', () => {
    const t = new Date(2026, 2, 10, 15, 0);
    expect(pickCourier([{ id: 'b', enRuta: 0, libreDesde: t }, { id: 'a', enRuta: 0, libreDesde: t }], 2)?.id).toBe('a');
    expect(pickCourier([{ id: 'a', enRuta: 0, libreDesde: t }, { id: 'b', enRuta: 0, libreDesde: t }], 2)?.id).toBe('a');
  });

  it('nadie disponible si todos llegaron al máximo', () => {
    expect(pickCourier([{ id: 'a', enRuta: 2, libreDesde: new Date() }], 2)).toBeNull();
    expect(pickCourier([], 2)).toBeNull();
  });
});
