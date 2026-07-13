import { Module } from '@nestjs/common';
import { RequisitionDetailsService } from './requisition_details.service';
import { RequisitionDetailsController } from './requisition_details.controller';

@Module({
  controllers: [RequisitionDetailsController],
  providers: [RequisitionDetailsService],
})
export class RequisitionDetailsModule {}
