import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseIntPipe,
  Body
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SalesService } from './sales.service';
import { Public } from '../../core/decorators/public.decorator';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) { }

  @Get()
  async getAllSales(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.salesService.findAllSales(startDate, endDate);
  }

  @Get('pending')
  async getPendingSales() {
    return await this.salesService.findPendingSales();
  }

  @Public()
  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.salesService.generateSalesTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_carga_ventas.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Public()
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSalesFile(
    @UploadedFile() file: any,
    @Body('allowNegativeStock') allowNegativeStockStr?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    const allowNegativeStock = allowNegativeStockStr === 'true';
    const jobId = this.salesService.startProcessingJob(file.buffer, allowNegativeStock);
    return {
      success: true,
      jobId,
      message: 'Archivo en proceso, recibirá una notificación vía Telegram al finalizar.'
    };
  }

  @Get('job/:jobId')
  getJobStatus(@Param('jobId') jobId: string) {
    return this.salesService.getJobStatus(jobId);
  }

  @Public()
  @Get('job/:jobId/download')
  downloadJobReport(@Param('jobId') jobId: string, @Res() res: Response) {
    const job = this.salesService.getJobStatus(jobId);
    if (!job.reportBuffer) {
      throw new BadRequestException('Reporte general no disponible para este trabajo');
    }
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte_ventas_${jobId}.xlsx"`,
      'Content-Length': job.reportBuffer.length,
    });
    res.end(job.reportBuffer);
  }

  @Public()
  @Get('job/:jobId/download-lowstock')
  downloadLowStockReport(@Param('jobId') jobId: string, @Res() res: Response) {
    const job = this.salesService.getJobStatus(jobId);
    if (!job.lowStockBuffer) {
      throw new BadRequestException('No hay reporte de insumos con stock bajo para este trabajo');
    }
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="insumos_stock_bajo_${jobId}.xlsx"`,
      'Content-Length': job.lowStockBuffer.length,
    });
    res.end(job.lowStockBuffer);
  }

  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  async validateFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    return await this.salesService.validateHeaders(file.buffer);
  }

  @Post(':id/process-discount')
  async processDiscount(@Param('id', ParseIntPipe) id: number) {
    return await this.salesService.processPendingDiscount(id);
  }
}
