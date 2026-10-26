import { describe, expect, it } from 'vitest';
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

