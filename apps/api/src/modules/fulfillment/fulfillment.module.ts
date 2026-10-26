import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { FulfillmentService } from './fulfillment.service';
import { StoreController } from './store.controller';

@Module({
  imports: [OrdersModule, InventoryModule, CatalogModule, DeliveryModule],
  controllers: [StoreController],
  providers: [FulfillmentService],
})
export class FulfillmentModule {}
