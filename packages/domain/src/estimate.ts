/**
 * Tiempo estimado de entrega que se le muestra al cliente. No decide si se acepta el pedido (siempre se acepta):
 * solo informa. Crece con la carga: más pedidos delante o menos repartidores → más espera.
 *
 * Todos los parámetros son HIPÓTESIS hasta medir en el piloto (docs/14 §7).
 */
export interface EstimateParams {
  /** Viaje ideal desde que sale el repartidor (la meta de 20 min). */
  idealTripMinutes: number;
  /** Minutos que toma alistar y empacar un pedido de entrega. */
  prepMinutesPerOrder: number;
  /** Ciclo completo de un repartidor: viaje + vuelta (hipótesis: 35). */
  courierCycleMinutes: number;
  /** Pedidos que un repartidor lleva en un mismo viaje. */
  ordersPerTrip: number;
  /** Colchón que se suma si no hay repartidores de turno. */
  noCourierBufferMinutes: number;
  /** El rango se redondea hacia arriba a múltiplos de este valor. */
  roundingMinutes: number;
}

export interface EstimateInput {
  /** Pedidos de entrega confirmados o en alistado que están antes que este. */
  pedidosPorAlistar: number;
  /** Pedidos ya empacados esperando a que salga un repartidor. */
  pedidosEsperandoSalir: number;
  repartidoresEnTurno: number;
}

export type LoadLevel = 'NORMAL' | 'ALTA';

export interface DeliveryEstimate {
  /** Rango que se muestra: "40–50 min". */
  minMin: number;
  maxMin: number;
  /** Desglose para explicar la espera. */
  alistadoMin: number;
  esperaRepartidorMin: number;
  viajeMin: number;
  nivelCarga: LoadLevel;
  sinRepartidores: boolean;
}

const ceilTo = (n: number, step: number) => Math.ceil(n / step) * step;
const floorTo = (n: number, step: number) => Math.floor(n / step) * step;

export function deliveryEstimate(input: EstimateInput, p: EstimateParams): DeliveryEstimate {
  const alistadoMin = (input.pedidosPorAlistar + 1) * p.prepMinutesPerOrder;
  const sinRepartidores = input.repartidoresEnTurno <= 0;

  let esperaRepartidorMin: number;
  if (sinRepartidores) {
    esperaRepartidorMin = p.noCourierBufferMinutes;
  } else {
    // Cada "oleada" son los pedidos que caben en un viaje de todos los repartidores; cada oleada ocupa un ciclo.
    const porOleada = input.repartidoresEnTurno * p.ordersPerTrip;
    const oleadasDelante = Math.floor(input.pedidosEsperandoSalir / porOleada);
    esperaRepartidorMin = oleadasDelante * p.courierCycleMinutes;
  }

  const total = alistadoMin + esperaRepartidorMin + p.idealTripMinutes;
  const maxMin = ceilTo(total + p.roundingMinutes, p.roundingMinutes);
  const minMin = Math.max(p.idealTripMinutes, floorTo(total, p.roundingMinutes));
  const nivelCarga: LoadLevel = sinRepartidores || esperaRepartidorMin > 0 || input.pedidosPorAlistar >= 3 ? 'ALTA' : 'NORMAL';
  return { minMin, maxMin, alistadoMin, esperaRepartidorMin, viajeMin: p.idealTripMinutes, nivelCarga, sinRepartidores };
}
