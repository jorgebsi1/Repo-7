import { Cents } from '@prolac/domain';

export type AuthorizeResult = { ok: true; reference: string } | { ok: false; reason: string };

/**
 * Contrato con la pasarela de pagos. El proveedor real (Niubiz, Izipay, Culqi, Yape/Plin…)
 * se implementa contra esta interfaz sin tocar el resto del sistema.
 */
export interface PaymentProvider {
  readonly name: string;
  authorize(input: { amountCents: Cents; token: string | undefined; orderRef: string }): Promise<AuthorizeResult>;
  capture(reference: string, amountCents: Cents): Promise<void>;
  void(reference: string): Promise<void>;
  refund(reference: string, amountCents: Cents): Promise<void>;
}
