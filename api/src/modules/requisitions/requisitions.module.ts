import { Module } from '@nestjs/common';
import { RequisitionsService } from './requisitions.service';
import { RequisitionsController } from './requisitions.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [InventoryModule, AlertsModule],
  controllers: [RequisitionsController],
  providers: [RequisitionsService],
})
export class RequisitionsModule {}
