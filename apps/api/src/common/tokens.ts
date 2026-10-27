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
  /**
   * Viaje IDEAL desde que el repartidor sale de la tienda (en cooler): 20 min. Es una META con semáforo,
   * no un límite: pasarse solo se registra como "demorado". No hay nivel crítico (decisión del propietario).
   */
  idealTripMinutes: number;
  /** Pedidos que un repartidor lleva en un mismo viaje (hipótesis: 2). Solo afecta al tiempo estimado. */
  pedidosPorViaje: number;
  /** Minutos para alistar y empacar un pedido de entrega (hipótesis: 8). */
  prepMinutesPerOrder: number;
  /** Ciclo completo de un repartidor: viaje + vuelta (hipótesis: 35). */
  courierCycleMinutes: number;
  /** Colchón del tiempo estimado cuando no hay repartidores de turno (hipótesis: 30). */
  noCourierBufferMinutes: number;
  /** El rango estimado se redondea hacia arriba a múltiplos de este valor. */
  etaRoundingMinutes: number;
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
  idealTripMinutes: 20,
  pedidosPorViaje: 2,
  prepMinutesPerOrder: 8,
  courierCycleMinutes: 35,
  noCourierBufferMinutes: 30,
  etaRoundingMinutes: 5,
  weightMargin: 0.1,
  reservationTtlMinutes: 10,
  defaultLeadMinutes: 60,
};
