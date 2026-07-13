import { Module } from '@nestjs/common';
import { InventoryTransfersService } from './inventory_transfers.service';
import { InventoryTransfersController } from './inventory_transfers.controller';
import { TransfersController } from './transfers.controller';
import { AlertsModule } from '../alerts/alerts.module';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [AlertsModule, HistoryModule],
  controllers: [InventoryTransfersController, TransfersController],
  providers: [InventoryTransfersService],
})
export class InventoryTransfersModule {}

