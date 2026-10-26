import { describe, expect, it } from 'vitest';
import {
  coldChainDeadline,
  isWithinColdChain,
  pointInPolygon,
  quoteDelivery,
  type DeliveryZone,
  type Polygon,
} from './delivery.js';
import { DEFAULT_RESERVATION_TTL_MINUTES, isReservationActive, reservationExpiry } from './reservation.js';
import { allocateFEFO, isAcceptableForDelivery, remainingShelfLifeDays } from './shelf-life.js';

const day = (n: number, base = new Date('2026-03-10T12:00:00Z')) => new Date(base.getTime() + n * 86_400_000);

describe('vida útil y FEFO', () => {
  const now = day(0);

  it('calcula días restantes y aplica el mínimo', () => {
    expect(remainingShelfLifeDays(day(7), now)).toBe(7);
    expect(isAcceptableForDelivery(day(3), now, 3)).toBe(true);
    expect(isAcceptableForDelivery(day(2.9), now, 3)).toBe(false);
  });

  it('asigna primero el lote que vence antes y descarta los que no cumplen el mínimo', () => {
    const r = allocateFEFO(
      [
        { loteId: 'tarde', expiresAt: day(9), disponible: 10 },
        { loteId: 'justo', expiresAt: day(4), disponible: 3 },
        { loteId: 'casi-vencido', expiresAt: day(1), disponible: 50 },
      ],
      8,
      now,
      3,
    );
    expect(r.allocations).toEqual([
      { loteId: 'justo', cantidad: 3 },
      { loteId: 'tarde', cantidad: 5 },
    ]);
    expect(r.faltante).toBe(0);
  });

  it('informa el faltante cuando no alcanza el stock vendible', () => {
    const r = allocateFEFO([{ loteId: 'a', expiresAt: day(6), disponible: 2 }], 5, now, 3);
    expect(r).toEqual({ allocations: [{ loteId: 'a', cantidad: 2 }], faltante: 3 });
  });
});

describe('reserva con TTL', () => {
  it('caduca a los 10 minutos salvo que esté confirmada', () => {
    const now = new Date('2026-03-10T12:00:00Z');
    const exp = reservationExpiry(now);
    expect(exp.getTime() - now.getTime()).toBe(DEFAULT_RESERVATION_TTL_MINUTES * 60_000);
    expect(isReservationActive({ expiresAt: exp, confirmed: false }, new Date(exp.getTime() - 1))).toBe(true);
    expect(isReservationActive({ expiresAt: exp, confirmed: false }, exp)).toBe(false);
    expect(isReservationActive({ expiresAt: exp, confirmed: true }, new Date(exp.getTime() + 3_600_000))).toBe(true);
  });
});

describe('zonas de reparto y cadena de frío', () => {
  // Cuadrado ficticio alrededor de (-79.03, -8.11)
  const poligono: Polygon = [
    [-79.04, -8.12],
    [-79.02, -8.12],
    [-79.02, -8.1],
    [-79.04, -8.1],
  ];
  const zona: DeliveryZone = {
    id: 'z1',
    ubicacionId: 'tienda-1',
    nombre: 'Zona ficticia',
    poligono,
    tarifaCents: 600,
    pedidoMinimoCents: 3000,
    envioGratisDesdeCents: 8000,
  };

  it('punto dentro y fuera del polígono', () => {
    expect(pointInPolygon([-79.03, -8.11], poligono)).toBe(true);
    expect(pointInPolygon([-79.0, -8.11], poligono)).toBe(false);
  });

  it('cotiza tarifa, mínimo, envío gratis y fuera de zona', () => {
    const dentro = [-79.03, -8.11] as const;
    expect(quoteDelivery([zona], 'tienda-1', dentro, 5000)).toEqual({ ok: true, zonaId: 'z1', tarifaCents: 600 });
    expect(quoteDelivery([zona], 'tienda-1', dentro, 9000)).toEqual({ ok: true, zonaId: 'z1', tarifaCents: 0 });
    expect(quoteDelivery([zona], 'tienda-1', dentro, 2000)).toEqual({
      ok: false,
      reason: 'BAJO_PEDIDO_MINIMO',
      pedidoMinimoCents: 3000,
    });
    expect(quoteDelivery([zona], 'tienda-1', [-79.0, -8.11], 5000)).toEqual({ ok: false, reason: 'FUERA_DE_ZONA' });
    expect(quoteDelivery([zona], 'otra-tienda', dentro, 5000)).toEqual({ ok: false, reason: 'FUERA_DE_ZONA' });
  });

  it('ventana de frío', () => {
    const packed = new Date('2026-03-10T12:00:00Z');
    expect(coldChainDeadline(packed, 90).toISOString()).toBe('2026-03-10T13:30:00.000Z');
    expect(isWithinColdChain(packed, new Date('2026-03-10T13:30:00Z'), 90)).toBe(true);
    expect(isWithinColdChain(packed, new Date('2026-03-10T13:31:00Z'), 90)).toBe(false);
  });
});
