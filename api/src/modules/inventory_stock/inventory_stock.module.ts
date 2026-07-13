import { Module } from '@nestjs/common';
import { InventoryStockService } from './inventory_stock.service';
import { InventoryStockController } from './inventory_stock.controller';
import { AlertsModule } from '../alerts/alerts.module';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [AlertsModule, HistoryModule],
  controllers: [InventoryStockController],
  providers: [InventoryStockService],
})
export class InventoryStockModule {}

