import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { InventoryReportsService } from './inventory_reports.service';
import { CreateInventoryReportDto } from './dto/create-inventory_report.dto';
import { UpdateInventoryReportDto } from './dto/update-inventory_report.dto';

@Controller('inventory-reports')
export class InventoryReportsController {
  constructor(private readonly inventoryReportsService: InventoryReportsService) {}

  @Post()
  create(@Body() createInventoryReportDto: CreateInventoryReportDto) {
    return this.inventoryReportsService.create(createInventoryReportDto);
  }

  @Get()
  findAll() {
    return this.inventoryReportsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryReportsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInventoryReportDto: UpdateInventoryReportDto) {
    return this.inventoryReportsService.update(+id, updateInventoryReportDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inventoryReportsService.remove(+id);
  }
}
