import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { History } from './entities/history.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { User } from '../users/entities/user.entity';
import { InventoryStock } from '../inventory_stock/entities/inventory_stock.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      History,
      Inventory,
      Warehouse,
      User,
      InventoryStock,
    ]),
  ],
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
