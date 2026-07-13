import { Module } from '@nestjs/common';
import { StockMovementsService } from './stock_movements.service';
import { StockMovementsController } from './stock_movements.controller';

@Module({
  controllers: [StockMovementsController],
  providers: [StockMovementsService],
})
export class StockMovementsModule {}
