import { Module } from '@nestjs/common';
import { DecreaseDetailsService } from './decrease_details.service';
import { DecreaseDetailsController } from './decrease_details.controller';

@Module({
  controllers: [DecreaseDetailsController],
  providers: [DecreaseDetailsService],
})
export class DecreaseDetailsModule {}
