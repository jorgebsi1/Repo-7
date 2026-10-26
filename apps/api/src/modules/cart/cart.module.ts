import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({ imports: [DeliveryModule, InventoryModule], controllers: [CartController], providers: [CartService], exports: [CartService] })
export class CartModule {}
