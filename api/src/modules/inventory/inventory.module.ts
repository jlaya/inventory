import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryGateway } from './inventory.gateway';
import { Inventory } from './entities/inventory.entity';
import { UnitOfMeasure } from './entities/unit-of-measure.entity';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    // Registramos las entidades para que los repositorios estén disponibles
    TypeOrmModule.forFeature([Inventory, UnitOfMeasure]),
    forwardRef(() => AlertsModule),
  ],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryGateway // <--- Esto resuelve el UnknownDependenciesException
  ],
  exports: [InventoryService, InventoryGateway],
})
export class InventoryModule { }