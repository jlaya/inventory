import { Module } from '@nestjs/common';
import { DecreasesService } from './decreases.service';
import { DecreasesController } from './decreases.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { AlertsModule } from '../alerts/alerts.module';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [InventoryModule, AlertsModule, HistoryModule],
  controllers: [DecreasesController],
  providers: [DecreasesService],
})
export class DecreasesModule {}

