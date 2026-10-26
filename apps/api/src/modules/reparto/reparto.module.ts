import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { RepartoController } from './reparto.controller';

@Module({ imports: [DeliveryModule], controllers: [RepartoController] })
export class RepartoModule {}
