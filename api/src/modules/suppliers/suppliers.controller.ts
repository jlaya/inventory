import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { AddCatalogItemDto } from './dto/catalog-item.dto';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Post()
  create(@Body() dto: CreateSupplierDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  @Post(':id/catalog')
  addCatalogItem(@Param('id') id: string, @Body() dto: AddCatalogItemDto) {
    return this.service.addCatalogItem(+id, dto);
  }

  @Delete(':id/catalog/:inventoryId')
  removeCatalogItem(@Param('id') id: string, @Param('inventoryId') inventoryId: string) {
    return this.service.removeCatalogItem(+id, +inventoryId);
  }
}
