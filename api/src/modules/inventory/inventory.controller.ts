import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Res, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { Public } from '../../core/decorators/public.decorator';

@Public()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getAll(
    @Query('category_id') categoryId?: string,
    @Query('operational_destination') operationalDestination?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const catId = categoryId ? Number(categoryId) : undefined;
    const pageNum = page ? Number(page) : undefined;
    const limitNum = limit ? Number(limit) : undefined;
    return await this.inventoryService.findAll(catId, operationalDestination, pageNum, limitNum);
  }

  @Public()
  @Get('template')
  async downloadTemplate(@Res() res: any) {
    const buffer = await this.inventoryService.generateTemplateExcel();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_requisicion.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Public()
  @Get('bulk/template-register')
  async downloadRegisterTemplate(@Res() res: any) {
    const buffer = await this.inventoryService.generateBulkTemplate('register');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_registro_insumos.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Public()
  @Get('bulk/template-update')
  async downloadUpdateTemplate(@Res() res: any) {
    const buffer = await this.inventoryService.generateBulkTemplate('update');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_actualizacion_insumos.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('bulk/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBulk(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    return await this.inventoryService.processBulkUpload(file.buffer);
  }

  @Post('upload-physical-count')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhysicalCount(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    return await this.inventoryService.processPhysicalCountUpload(file.buffer);
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return await this.inventoryService.findOne(id);
  }

  @Post()
  async create(@Body() createInventoryDto: CreateInventoryDto) {
    return await this.inventoryService.create(createInventoryDto);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInventoryDto: Partial<CreateInventoryDto>
  ) {
    return await this.inventoryService.update(id, updateInventoryDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.inventoryService.remove(id);
  }
}