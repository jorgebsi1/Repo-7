import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { FulfillmentService } from './fulfillment.service';
import { StoreController } from './store.controller';

@Module({
  imports: [OrdersModule, InventoryModule, CatalogModule],
  controllers: [StoreController],
  providers: [FulfillmentService],
})
export class FulfillmentModule {}
