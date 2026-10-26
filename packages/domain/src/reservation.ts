export const DEFAULT_RESERVATION_TTL_MINUTES = 10;

export interface Reservation {
  expiresAt: Date;
  /** Se confirmó al autorizarse el pago: ya no caduca. */
  confirmed: boolean;
}

export function reservationExpiry(now: Date, ttlMinutes: number = DEFAULT_RESERVATION_TTL_MINUTES): Date {
  return new Date(now.getTime() + ttlMinutes * 60_000);
}

export function isReservationActive(r: Reservation, now: Date): boolean {
  return r.confirmed || r.expiresAt.getTime() > now.getTime();
}
