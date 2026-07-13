import { Module, forwardRef } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { TelegramService } from './telegram.service';
import { AlertsController } from './alerts.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [
    forwardRef(() => InventoryModule),
    HistoryModule
  ],
  controllers: [AlertsController],
  providers: [AlertsService, TelegramService],
  exports: [AlertsService, TelegramService],
})
export class AlertsModule { }
