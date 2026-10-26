export const DB = Symbol('DB');
export const CLOCK = Symbol('CLOCK');
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface Clock {
  now(): Date;
}
export const systemClock: Clock = { now: () => new Date() };

/** Reglas de negocio configurables (hipótesis a confirmar con Prolac; ver docs/13 §9). */
export interface BusinessConfig {
  /** Vida útil mínima que debe quedar al entregar al cliente. */
  minRemainingShelfLifeDays: number;
  /** Minutos máximos entre que el repartidor sale de la tienda (en cooler) y entrega. */
  maxMinutesOutOfFridge: number;
  /** Pedidos de entrega que puede atender cada repartidor en turno a la vez (hipótesis: 2). */
  maxPedidosPorRepartidor: number;
  /** Margen con el que se autoriza el cobro de productos por peso. */
  weightMargin: number;
  /** Minutos que dura la reserva de stock mientras se paga. */
  reservationTtlMinutes: number;
  /** Minutos por defecto hasta la entrega/recojo si el cliente no elige franja. */
  defaultLeadMinutes: number;
}
export const BUSINESS_CONFIG = Symbol('BUSINESS_CONFIG');
export const defaultBusinessConfig: BusinessConfig = {
  minRemainingShelfLifeDays: 2,
  maxMinutesOutOfFridge: 20,
  maxPedidosPorRepartidor: 2,
  weightMargin: 0.1,
  reservationTtlMinutes: 10,
  defaultLeadMinutes: 60,
};
