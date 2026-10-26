import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from '../../common/tokens';
import { SimulatedPaymentProvider } from './simulated.provider';

@Module({
  providers: [SimulatedPaymentProvider, { provide: PAYMENT_PROVIDER, useExisting: SimulatedPaymentProvider }],
  exports: [PAYMENT_PROVIDER, SimulatedPaymentProvider],
})
export class PaymentsModule {}
