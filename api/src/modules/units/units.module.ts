import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { UnitOfMeasure } from './entities/unit.entity';
import { UomConversion } from './entities/uom-conversion.entity';
import { Inventory } from '../inventory/entities/inventory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UnitOfMeasure, UomConversion, Inventory])],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService, TypeOrmModule],
})
export class UnitsModule {}