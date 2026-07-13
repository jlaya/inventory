import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CategoryModule } from './modules/categories/category.module';
import { UnitsModule } from './modules/units/units.module';
import { UnitsOfMeasureModule } from './modules/units_of_measure/units_of_measure.module';
import { InventoryStockModule } from './modules/inventory_stock/inventory_stock.module';
import { InventoryTransfersModule } from './modules/inventory_transfers/inventory_transfers.module';
import { StockMovementsModule } from './modules/stock_movements/stock_movements.module';
import { RequisitionsModule } from './modules/requisitions/requisitions.module';
import { RequisitionDetailsModule } from './modules/requisition_details/requisition_details.module';
import { ClosureLogsModule } from './modules/closure_logs/closure_logs.module';
import { DecreasesModule } from './modules/decreases/decreases.module';
import { DecreaseDetailsModule } from './modules/decrease_details/decrease_details.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { InventoryReportsModule } from './modules/inventory_reports/inventory_reports.module';
import { MovementReportsModule } from './modules/movement_reports/movement_reports.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { PurchaseOrdersModule } from './modules/purchase_orders/purchase_orders.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { SalesModule } from './modules/sales/sales.module';
import { HistoryModule } from './modules/history/history.module';
import { InventoryMovementsModule } from './modules/inventory-movements/inventory-movements.module';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './core/guards/auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET', 'default_secure_secret_key');
        const expiresVar = configService.get<string>('JWT_EXPIRES_IN_SECONDS');
        const expiresIn = expiresVar ? (isNaN(Number(expiresVar)) ? expiresVar : Number(expiresVar)) : '24h';
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'password'),
        database: configService.get<string>('DB_DATABASE', 'restaurant_erp'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
        logging: false,
      }),
    }),
    InventoryModule,
    CategoryModule,
    UnitsModule,
    WarehousesModule,
    UnitsOfMeasureModule,
    InventoryStockModule,
    InventoryTransfersModule,
    StockMovementsModule,
    RequisitionsModule,
    RequisitionDetailsModule,
    ClosureLogsModule,
    DecreasesModule,
    DecreaseDetailsModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    InventoryReportsModule,
    MovementReportsModule,
    IngredientsModule,
    PurchaseOrdersModule,
    DashboardModule,
    SuppliersModule,
    AlertsModule,
    SalesModule,
    HistoryModule,
    InventoryMovementsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}