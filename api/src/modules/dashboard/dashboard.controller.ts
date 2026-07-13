import { Controller, Get, Post, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private parseRefresh(refresh?: string): boolean {
    return refresh === 'true' || refresh === '1';
  }

  @Get('summary')
  async getSummary(@Query('refresh') refresh?: string) {
    const isRefresh = this.parseRefresh(refresh);
    return this.dashboardService.getSummary(isRefresh);
  }

  @Get('inventory-distribution')
  async getInventoryDistribution(@Query('refresh') refresh?: string) {
    const isRefresh = this.parseRefresh(refresh);
    return this.dashboardService.getInventoryDistribution(isRefresh);
  }

  @Get('reorder-alerts')
  async getReorderAlerts(@Query('refresh') refresh?: string) {
    const isRefresh = this.parseRefresh(refresh);
    return this.dashboardService.getReorderAlerts(isRefresh);
  }

  @Get('discrepancies')
  async getTransferDiscrepancies(@Query('refresh') refresh?: string) {
    const isRefresh = this.parseRefresh(refresh);
    return this.dashboardService.getTransferDiscrepancies(isRefresh);
  }

  @Get('financials')
  async getFinancials(@Query('refresh') refresh?: string) {
    const isRefresh = this.parseRefresh(refresh);
    return this.dashboardService.getFinancials(isRefresh);
  }

  @Get('valuation')
  async getValuation(@Query('refresh') refresh?: string) {
    const isRefresh = this.parseRefresh(refresh);
    return this.dashboardService.getValuation(isRefresh);
  }

  @Get('recipe-costs')
  async getRecipeCosts(@Query('refresh') refresh?: string) {
    const isRefresh = this.parseRefresh(refresh);
    return this.dashboardService.getRecipeCosts(isRefresh);
  }

  @Get('sourcing-compliance')
  async getSourcingCompliance(@Query('refresh') refresh?: string) {
    const isRefresh = this.parseRefresh(refresh);
    return this.dashboardService.getSourcingCompliance(isRefresh);
  }

  @Get('requisition-bottlenecks')
  async getRequisitionBottlenecks(@Query('refresh') refresh?: string) {
    const isRefresh = this.parseRefresh(refresh);
    return this.dashboardService.getRequisitionBottlenecks(isRefresh);
  }

  @Get('user-audit')
  async getUserAudit(@Query('refresh') refresh?: string) {
    const isRefresh = this.parseRefresh(refresh);
    return this.dashboardService.getUserAudit(isRefresh);
  }

  @Get('traceability')
  async getTraceability(@Query('inventoryId') inventoryId?: string) {
    const invId = inventoryId ? Number(inventoryId) : undefined;
    const data = await this.dashboardService.getTraceability(invId);
    return { data };
  }

  @Get('new-metrics')
  async getNewMetrics() {
    return this.dashboardService.getNewMetrics();
  }

  @Get('new-charts')
  async getNewCharts() {
    return this.dashboardService.getNewCharts();
  }

  @Get('new-traceability')
  async getNewTraceability(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? Math.max(1, parseInt(page, 10)) : 1;
    const l = limit ? Math.max(1, parseInt(limit, 10)) : 10;
    return this.dashboardService.getNewTraceability(p, l);
  }

  @Post('refresh')
  async forceRefresh() {
    return this.dashboardService.forceRefresh();
  }
}
