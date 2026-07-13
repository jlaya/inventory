import { Module } from '@nestjs/common';
import { InventoryReportsService } from './inventory_reports.service';
import { InventoryReportsController } from './inventory_reports.controller';

@Module({
  controllers: [InventoryReportsController],
  providers: [InventoryReportsService],
})
export class InventoryReportsModule {}
