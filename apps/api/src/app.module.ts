import { DynamicModule, Global, Module } from '@nestjs/common';
import type { DbHandle } from './db/client';
import { BUSINESS_CONFIG, CLOCK, DB, defaultBusinessConfig, systemClock, type BusinessConfig, type Clock } from './common/tokens';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module';
import { HealthController } from './modules/health/health.controller';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RepartoModule } from './modules/reparto/reparto.module';

export interface AppOptions {
  db: DbHandle;
  clock?: Clock;
  config?: Partial<BusinessConfig>;
}

/** Dependencias transversales (base de datos, reloj, reglas de negocio) disponibles para todos los módulos. */
@Global()
@Module({})
export class CoreModule {
  static register(o: AppOptions): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: DB, useValue: o.db.db },
        { provide: CLOCK, useValue: o.clock ?? systemClock },
        { provide: BUSINESS_CONFIG, useValue: { ...defaultBusinessConfig, ...o.config } },
      ],
      exports: [DB, CLOCK, BUSINESS_CONFIG],
    };
  }
}

@Module({})
export class AppModule {
  static register(o: AppOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.register(o),
        AccountsModule,
        CatalogModule,
        InventoryModule,
        DeliveryModule,
        CartModule,
        PaymentsModule,
        NotificationsModule,
        OrdersModule,
        FulfillmentModule,
        RepartoModule,
      ],
      controllers: [HealthController],
    };
  }
}
