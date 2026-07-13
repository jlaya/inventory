import { Module } from '@nestjs/common';
import { MovementReportsService } from './movement_reports.service';
import { MovementReportsController } from './movement_reports.controller';

@Module({
  controllers: [MovementReportsController],
  providers: [MovementReportsService],
})
export class MovementReportsModule {}
