import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { InventoryMovementsService } from './inventory-movements.service';
import { Public } from '../../core/decorators/public.decorator';

@Public()
@Controller('inventory-movements')
export class InventoryMovementsController {
  constructor(private readonly service: InventoryMovementsService) {}

  @Get()
  async getAll(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('recipe_search') recipeSearch?: string,
  ) {
    return await this.service.findAll(startDate, endDate, recipeSearch);
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return await this.service.findOne(id);
  }
}
