import { Controller, Post, Get, Res, Body, HttpException, HttpStatus } from '@nestjs/common';
import * as express from 'express';
import { AlertsService } from './alerts.service';
import { Public } from '../../core/decorators/public.decorator';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Public()
  @Post('audit')
  async runAudit() {
    return await this.alertsService.runCentralInventoryAudit(true);
  }

  @Public()
  @Post('restocking-audit')
  async runRestocking() {
    return await this.alertsService.runRestockingAudit(true);
  }

  @Public()
  @Post('replenish')
  async replenish(@Body() body: { warehouseId: number, items: { sku: string, qty: number }[] }) {
    const success = await this.alertsService.replenishStocks(body.warehouseId, body.items);
    if (success) {
      return { success: true };
    } else {
      throw new HttpException('No se pudo reabastecer el inventario', HttpStatus.BAD_REQUEST);
    }
  }

  @Public()
  @Get('audit-data')
  async getAuditData() {
    return await this.alertsService.runCentralInventoryAudit(false);
  }

  @Public()
  @Get('restocking-data')
  async getRestockingData() {
    return await this.alertsService.runRestockingAudit(false);
  }

  @Public()
  @Get('config')
  async getConfig() {
    return {
      runAlertsCron: process.env.RUN_ALERTS_CRON === 'true',
      alertsCronTime: process.env.ALERTS_CRON_TIME || '*/600 * * * *',
      telegramSendMessage: process.env.TELEGRAM_SEND_MESSAGE === 'true',
      hasTelegramToken: !!process.env.TELEGRAM_TOKEN,
      hasTelegramChatId: !!process.env.TELEGRAM_CHAT_ID,
      lastAuditTime: this.alertsService.getLastAuditTime()
    };
  }

  @Public()
  @Get('download-excel')
  async downloadExcel(@Res() res: express.Response) {
    try {
      const buffer = await this.alertsService.generateExcelReportBuffer();
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="reporte_alertas_inventario.xlsx"',
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }
}
