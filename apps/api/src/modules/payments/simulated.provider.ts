import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Cents } from '@prolac/domain';
import type { AuthorizeResult, PaymentProvider } from './payment.provider';

/**
 * Pasarela SIMULADA para desarrollo. NO mueve dinero.
 *   tok_ok        → autoriza
 *   tok_rechazo   → rechaza (tarjeta rechazada)
 *   sin token     → rechaza (TOKEN_REQUERIDO)
 */
@Injectable()
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulado';
  readonly calls: { op: string; reference: string; amountCents?: Cents }[] = [];

  async authorize(input: { amountCents: Cents; token: string | undefined; orderRef: string }): Promise<AuthorizeResult> {
    if (!input.token) return { ok: false, reason: 'TOKEN_REQUERIDO' };
    if (input.token === 'tok_rechazo') return { ok: false, reason: 'TARJETA_RECHAZADA' };
    const reference = `sim_${randomUUID()}`;
    this.calls.push({ op: 'authorize', reference, amountCents: input.amountCents });
    return { ok: true, reference };
  }
  async capture(reference: string, amountCents: Cents): Promise<void> {
    this.calls.push({ op: 'capture', reference, amountCents });
  }
  async void(reference: string): Promise<void> {
    this.calls.push({ op: 'void', reference });
  }
  async refund(reference: string, amountCents: Cents): Promise<void> {
    this.calls.push({ op: 'refund', reference, amountCents });
  }
}
