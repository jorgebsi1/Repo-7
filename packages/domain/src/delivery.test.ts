import { describe, expect, it } from 'vitest';
import { pickCourier } from './couriers.js';
import { coldChainDeadline, coldChainStatus, isWithinIdealTrip, nearestCoveringStore, resolveDelivery, type StoreDelivery } from './delivery.js';
import { deliveryEstimate, type EstimateParams } from './estimate.js';
import { haversineKm } from './geo.js';

// Tiendas ficticias en Trujillo (el reparto se calcula en línea recta, no por calle).
const CAS: StoreDelivery = { id: 'cas', nombre: 'Las Casuarinas', ubicacion: [-79.0268, -8.1342], radioKm: 4, tarifaCents: 600, envioGratisDesdeCents: 9000 };
const T02: StoreDelivery = { id: 't02', nombre: 'Trujillo 2', ubicacion: [-79.0287, -8.1118], radioKm: 4, tarifaCents: 500 };

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

describe('cotización de entrega (sin pedido mínimo)', () => {
  const dentro: [number, number] = [-79.03, -8.133];

  it('tarifa de la tienda que atiende, con la distancia', () => {
    const q = resolveDelivery([CAS, T02], dentro, 5000);
    expect(q).toMatchObject({ ok: true, ubicacionId: 'cas', tarifaCents: 600 });
    expect(q.ok && q.distanciaKm).toBeLessThan(1);
  });

  it('un pedido chico (250 g de mantequilla) se acepta y se le suma el reparto', () => {
    expect(resolveDelivery([CAS], dentro, 1190)).toMatchObject({ ok: true, tarifaCents: 600 });
    expect(resolveDelivery([CAS], dentro, 1)).toMatchObject({ ok: true, tarifaCents: 600 });
  });

  it('envío gratis solo si la tienda lo define y se alcanza el monto', () => {
    expect(resolveDelivery([CAS], dentro, 9000)).toMatchObject({ ok: true, tarifaCents: 0 });
    expect(resolveDelivery([T02], dentro, 90_000)).toMatchObject({ ok: true, tarifaCents: 500 });
  });

  it('fuera de cobertura informa cuál es la tienda más cercana y a cuánto (única razón para no repartir)', () => {
    const q = resolveDelivery([CAS, T02], eastOf(CAS.ubicacion, 6), 5000);
    expect(q.ok).toBe(false);
    expect(q).toMatchObject({ reason: 'FUERA_DE_COBERTURA', masCercana: { ubicacionId: 'cas' } });
    expect(!q.ok && q.masCercana!.distanciaKm).toBeGreaterThan(5.9);
  });

  it('sin tiendas con reparto, fuera de cobertura', () => {
    expect(resolveDelivery([], dentro, 5000)).toEqual({ ok: false, reason: 'FUERA_DE_COBERTURA', masCercana: undefined });
  });
});

describe('meta de viaje de 20 min desde que el repartidor sale (semáforo, no bloqueo)', () => {
  const salida = new Date('2026-03-10T15:00:00Z');

  it('hora meta y cuenta regresiva', () => {
    expect(coldChainDeadline(salida, 20).toISOString()).toBe('2026-03-10T15:20:00.000Z');
    expect(coldChainStatus(salida, new Date('2026-03-10T15:05:00Z'), 20)).toMatchObject({ minutosRestantes: 15, demorado: false, nivel: 'EN_TIEMPO' });
    expect(coldChainStatus(salida, new Date('2026-03-10T15:19:30Z'), 20)).toMatchObject({ minutosRestantes: 1, demorado: false });
  });

  it('justo en la meta sigue en verde; después pasa a ámbar "demorado" (sin nivel crítico)', () => {
    expect(isWithinIdealTrip(salida, new Date('2026-03-10T15:20:00Z'), 20)).toBe(true);
    expect(isWithinIdealTrip(salida, new Date('2026-03-10T15:20:01Z'), 20)).toBe(false);
    expect(coldChainStatus(salida, new Date('2026-03-10T15:23:00Z'), 20)).toMatchObject({ minutosRestantes: -3, demorado: true, nivel: 'DEMORADO' });
    // 3 horas después sigue siendo solo "demorado": no existe un nivel crítico
    expect(coldChainStatus(salida, new Date('2026-03-10T18:00:00Z'), 20).nivel).toBe('DEMORADO');
  });
});

describe('asignación de repartidor (nunca rechaza)', () => {
  const t = (m: number) => new Date(2026, 2, 10, 15, m);

  it('asigna al repartidor con menos pedidos; a igualdad, al que lleva más tiempo libre', () => {
    expect(pickCourier([{ id: 'a', enRuta: 1, libreDesde: t(0) }, { id: 'b', enRuta: 0, libreDesde: t(10) }])?.id).toBe('b');
    expect(pickCourier([{ id: 'a', enRuta: 0, libreDesde: t(10) }, { id: 'b', enRuta: 0, libreDesde: t(2) }])?.id).toBe('b');
  });

  it('ante igualdad total el resultado es siempre el mismo (por id)', () => {
    expect(pickCourier([{ id: 'b', enRuta: 0, libreDesde: t(0) }, { id: 'a', enRuta: 0, libreDesde: t(0) }])?.id).toBe('a');
    expect(pickCourier([{ id: 'a', enRuta: 0, libreDesde: t(0) }, { id: 'b', enRuta: 0, libreDesde: t(0) }])?.id).toBe('a');
  });

  it('aunque todos estén muy cargados se asigna al menos cargado; solo es null si no hay nadie de turno', () => {
    expect(pickCourier([{ id: 'a', enRuta: 5, libreDesde: t(0) }, { id: 'b', enRuta: 3, libreDesde: t(0) }])?.id).toBe('b');
    expect(pickCourier([])).toBeNull();
  });
});

describe('tiempo estimado de entrega', () => {
  const P: EstimateParams = { idealTripMinutes: 20, prepMinutesPerOrder: 8, courierCycleMinutes: 35, ordersPerTrip: 2, noCourierBufferMinutes: 30, roundingMinutes: 5 };

  it('día tranquilo: alistado + viaje ideal, mostrado como rango', () => {
    const e = deliveryEstimate({ pedidosPorAlistar: 0, pedidosEsperandoSalir: 0, repartidoresEnTurno: 2 }, P);
    expect(e).toMatchObject({ alistadoMin: 8, esperaRepartidorMin: 0, viajeMin: 20, nivelCarga: 'NORMAL', sinRepartidores: false });
    expect(e.minMin).toBe(25);
    expect(e.maxMin).toBe(35);
  });

  it('crece con los pedidos delante', () => {
    const base = deliveryEstimate({ pedidosPorAlistar: 0, pedidosEsperandoSalir: 0, repartidoresEnTurno: 2 }, P);
    const cola = deliveryEstimate({ pedidosPorAlistar: 4, pedidosEsperandoSalir: 0, repartidoresEnTurno: 2 }, P);
    expect(cola.maxMin).toBeGreaterThan(base.maxMin);
    expect(cola.nivelCarga).toBe('ALTA');
  });

  it('espera una oleada completa cuando todos los repartidores van llenos', () => {
    // 2 repartidores × 2 pedidos por viaje = 4 por oleada; con 4 esperando salir, este espera un ciclo de 35 min
    const e = deliveryEstimate({ pedidosPorAlistar: 0, pedidosEsperandoSalir: 4, repartidoresEnTurno: 2 }, P);
    expect(e.esperaRepartidorMin).toBe(35);
    expect(e.nivelCarga).toBe('ALTA');
    expect(deliveryEstimate({ pedidosPorAlistar: 0, pedidosEsperandoSalir: 3, repartidoresEnTurno: 2 }, P).esperaRepartidorMin).toBe(0);
  });

  it('más repartidores de turno bajan la espera', () => {
    const dos = deliveryEstimate({ pedidosPorAlistar: 0, pedidosEsperandoSalir: 8, repartidoresEnTurno: 2 }, P);
    const cuatro = deliveryEstimate({ pedidosPorAlistar: 0, pedidosEsperandoSalir: 8, repartidoresEnTurno: 4 }, P);
    expect(cuatro.esperaRepartidorMin).toBeLessThan(dos.esperaRepartidorMin);
  });

  it('sin repartidores de turno igual hay estimado (nunca se rechaza) con colchón y carga alta', () => {
    const e = deliveryEstimate({ pedidosPorAlistar: 0, pedidosEsperandoSalir: 0, repartidoresEnTurno: 0 }, P);
    expect(e).toMatchObject({ sinRepartidores: true, esperaRepartidorMin: 30, nivelCarga: 'ALTA' });
    expect(e.maxMin).toBeGreaterThanOrEqual(8 + 30 + 20);
  });

  it('el rango siempre es de múltiplos de 5 y el máximo nunca baja del mínimo', () => {
    for (let a = 0; a < 12; a++) {
      for (let s = 0; s < 12; s++) {
        for (const r of [0, 1, 2, 3]) {
          const e = deliveryEstimate({ pedidosPorAlistar: a, pedidosEsperandoSalir: s, repartidoresEnTurno: r }, P);
          expect(e.maxMin % 5).toBe(0);
          expect(e.minMin % 5).toBe(0);
          expect(e.maxMin).toBeGreaterThan(e.minMin);
          expect(e.minMin).toBeGreaterThanOrEqual(P.idealTripMinutes);
        }
      }
    }
  });
});
