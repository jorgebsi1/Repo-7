import type { Cents } from './money.js';
import type { OrderStatus } from './order-state.js';

export type PaymentEffect =
  | { type: 'ninguno' }
  | { type: 'capturar'; amountCents: Cents }
  | { type: 'anular_autorizacion' }
  | { type: 'reembolsar'; amountCents: Cents };

export interface PaymentState {
  authorizedCents: Cents;
  capturedCents: Cents;
  /** Total real calculado con los pesos finales (solo válido al empacar). */
  finalTotalCents: Cents;
}

/**
 * Qué debe hacer el módulo de pagos cuando el pedido cambia de estado.
 * Se autoriza al confirmar; se captura al EMPACAR por el total final (así los faltantes
 * y las diferencias de peso nunca generan cobros que luego haya que revertir).
 */
export function paymentEffect(from: OrderStatus, to: OrderStatus, pay: PaymentState): PaymentEffect {
  if (to === 'EMPACADO') {
    if (pay.finalTotalCents > pay.authorizedCents) {
      throw new RangeError('El total final excede lo autorizado; requiere nuevo consentimiento del cliente');
    }
    return { type: 'capturar', amountCents: pay.finalTotalCents };
  }
  if (to === 'CANCELADO' && from === 'CONFIRMADO') return { type: 'anular_autorizacion' };
  if (to === 'REEMBOLSADO') {
    return pay.capturedCents > 0
      ? { type: 'reembolsar', amountCents: pay.capturedCents }
      : { type: 'anular_autorizacion' };
  }
  return { type: 'ninguno' };
}
