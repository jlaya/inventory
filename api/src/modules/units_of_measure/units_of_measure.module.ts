import { Module } from '@nestjs/common';
import { UnitsOfMeasureService } from './units_of_measure.service';
import { UnitsOfMeasureController } from './units_of_measure.controller';

@Module({
  controllers: [UnitsOfMeasureController],
  providers: [UnitsOfMeasureService],
})
export class UnitsOfMeasureModule {}
