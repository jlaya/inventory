import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { InventoryStockService } from './inventory_stock.service';
import { CreateInventoryStockDto } from './dto/create-inventory_stock.dto';
import { UpdateInventoryStockDto } from './dto/update-inventory_stock.dto';

@Controller('inventory-stock')
export class InventoryStockController {
  constructor(private readonly inventoryStockService: InventoryStockService) { }

  @Post()
  create(@Body() createInventoryStockDto: CreateInventoryStockDto) {
    return this.inventoryStockService.create(createInventoryStockDto);
  }

  @Get()
  findAllStock() {
    return this.inventoryStockService.findAllStock();
  }

  @Get(':warehouse_id')
  findAll(@Param('warehouse_id') warehouse_id: string) {
    return this.inventoryStockService.findAll(warehouse_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryStockService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInventoryStockDto: UpdateInventoryStockDto) {
    return this.inventoryStockService.update(+id, updateInventoryStockDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inventoryStockService.remove(+id);
  }
}
