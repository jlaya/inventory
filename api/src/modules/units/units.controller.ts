import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';

@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) { }

  @Get()
  async getAll() {
    return await this.unitsService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return await this.unitsService.findOne(id);
  }

  @Post()
  async create(@Body() createUnitDto: CreateUnitDto) {
    return await this.unitsService.create(createUnitDto);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateUnitDto: any) {
    return await this.unitsService.update(id, updateUnitDto);
  }

  // UOM Conversions
  @Get('conversions/all')
  async getAllConversions() {
    return await this.unitsService.findAllConversions();
  }

  @Post('conversions')
  async createOrUpdateConversion(@Body() dto: { inventoryId: number; fromUomId: number; toUomId: number; factor: number }) {
    return await this.unitsService.createOrUpdateConversion(dto);
  }

  @Delete('conversions/:id')
  async removeConversion(@Param('id', ParseIntPipe) id: number) {
    return await this.unitsService.removeConversion(id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.unitsService.remove(id);
  }
}