import { Controller, Get, Post, Body, Query, Res } from '@nestjs/common';
import { HistoryService } from './history.service';
import { CreateHistoryDto } from './dto/create-history.dto';
import { Public } from '../../core/decorators/public.decorator';
import type { Response } from 'express';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) { }

  @Post()
  create(@Body() createHistoryDto: CreateHistoryDto) {
    return this.historyService.recordMovement(createHistoryDto);
  }

  @Public()
  @Get()
  findAll(
    @Query('warehouseId') warehouseId?: string,
    @Query('inventoryId') inventoryId?: string,
    @Query('movementType') movementType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.historyService.findAll({
      warehouseId: warehouseId ? parseInt(warehouseId, 10) : undefined,
      inventoryId: inventoryId ? parseInt(inventoryId, 10) : undefined,
      movementType,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @Get('kardex')
  getKardex(
    @Query('warehouseId') warehouseId: string,
    @Query('inventoryId') inventoryId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.historyService.getKardex(
      parseInt(warehouseId, 10),
      parseInt(inventoryId, 10),
      startDate,
      endDate,
    );
  }

  @Public()
  @Get('daily-summary')
  getDailyMovementSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.historyService.getDailyMovementSummary(
      startDate,
      endDate,
      warehouseId ? parseInt(warehouseId, 10) : undefined,
    );
  }

  @Public()
  @Get('kpis')
  getKpis(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.historyService.getKpiIndicators(
      startDate,
      endDate,
      warehouseId ? parseInt(warehouseId, 10) : undefined,
    );
  }

  @Public()
  @Get('audit-data')
  getAuditData(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.historyService.getAuditData(startDate, endDate);
  }

  @Public()
  @Get('audit-pdf')
  async getAuditPdf(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte_auditoria_inventario.pdf');
    await this.historyService.generateAuditPdf(res, startDate, endDate);
  }
}
