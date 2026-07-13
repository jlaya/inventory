import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClosureLog } from './entities/closure_log.entity';

@Injectable()
export class ClosureLogsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(dto: any) {
    const nextId = `CLOS-${Date.now().toString().slice(-4)}`;
    const log = new ClosureLog();
    log.id = nextId;
    log.dateTime = new Date();
    log.totalRevenue = dto.total_revenue || 0;
    log.totalCost = dto.total_cost || 0;
    log.storeSnapshot = dto.store_snapshot || null;
    log.week = dto.week || 24;

    const saved = await this.dataSource.getRepository(ClosureLog).save(log);
    return this.mapClosure(saved);
  }

  async findAll() {
    const list = await this.dataSource.getRepository(ClosureLog).find({
      order: { createdAt: 'DESC' }
    });
    return list.map(c => this.mapClosure(c));
  }

  async findOne(id: string) {
    const log = await this.dataSource.getRepository(ClosureLog).findOne({ where: { id } });
    if (!log) throw new NotFoundException('Cierre no encontrado');
    return this.mapClosure(log);
  }

  async update(id: string, dto: any) {
    const log = await this.dataSource.getRepository(ClosureLog).findOne({ where: { id } });
    if (!log) throw new NotFoundException('Cierre no encontrado');
    
    if (dto.total_revenue !== undefined) log.totalRevenue = dto.total_revenue;
    if (dto.total_cost !== undefined) log.totalCost = dto.total_cost;
    if (dto.store_snapshot !== undefined) log.storeSnapshot = dto.store_snapshot;
    if (dto.week !== undefined) log.week = dto.week;
    
    const saved = await this.dataSource.getRepository(ClosureLog).save(log);
    return this.mapClosure(saved);
  }

  async remove(id: string) {
    const log = await this.dataSource.getRepository(ClosureLog).findOne({ where: { id } });
    if (!log) throw new NotFoundException('Cierre no encontrado');
    await this.dataSource.getRepository(ClosureLog).remove(log);
    return { success: true };
  }

  private mapClosure(c: ClosureLog) {
    return {
      id: c.id,
      date_time: c.dateTime,
      total_revenue: Number(c.totalRevenue),
      total_cost: Number(c.totalCost),
      store_snapshot: c.storeSnapshot,
      week: c.week,
      created_at: c.createdAt,
      updated_at: c.updatedAt
    };
  }
}
