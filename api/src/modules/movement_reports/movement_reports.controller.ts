import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MovementReportsService } from './movement_reports.service';
import { CreateMovementReportDto } from './dto/create-movement_report.dto';
import { UpdateMovementReportDto } from './dto/update-movement_report.dto';

@Controller('movement-reports')
export class MovementReportsController {
  constructor(private readonly movementReportsService: MovementReportsService) {}

  @Post()
  create(@Body() createMovementReportDto: CreateMovementReportDto) {
    return this.movementReportsService.create(createMovementReportDto);
  }

  @Get()
  findAll() {
    return this.movementReportsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.movementReportsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMovementReportDto: UpdateMovementReportDto) {
    return this.movementReportsService.update(+id, updateMovementReportDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.movementReportsService.remove(+id);
  }
}
