import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Decrease } from './entities/decrease.entity';
import { InventoryStock } from '../inventory_stock/entities/inventory_stock.entity';
import { CreateDecreaseDto } from './dto/create-decrease.dto';
import { InventoryGateway } from '../inventory/inventory.gateway';
import { AlertsService } from '../alerts/alerts.service';
import { TelegramService } from '../alerts/telegram.service';
import { HistoryService } from '../history/history.service';

@Injectable()
export class DecreasesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly gateway: InventoryGateway,
    @Inject(forwardRef(() => AlertsService))
    private readonly alertsService: AlertsService,
    private readonly telegramService: TelegramService,
    private readonly historyService: HistoryService,
  ) { }

  async create(dto: CreateDecreaseDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const stockObj = await queryRunner.manager.findOne(InventoryStock, {
        where: { id: dto.stock_id.toString() },
        lock: { mode: 'pessimistic_write' }
      });

      if (!stockObj) throw new NotFoundException('Métrica de stock no encontrada.');

      stockObj.quantity = Math.max(0, Number(stockObj.quantity) - Number(dto.quantity));
      await queryRunner.manager.save(stockObj);

      const dId = `MERMA-${Math.floor(100000 + Math.random() * 900000)}`;

      const decrease = new Decrease();
      decrease.id = dId;
      decrease.stock_id = dto.stock_id;
      decrease.quantity = dto.quantity;
      decrease.cause = dto.cause;
      decrease.motive = dto.motive;
      decrease.area_id = dto.area_id;

      const savedDec = await queryRunner.manager.save(decrease);

      // Fetch the updated stock with relations inside transaction
      const fullStockObj = await queryRunner.manager.findOne(InventoryStock, {
        where: { id: dto.stock_id.toString() },
        relations: ['warehouse', 'inventory']
      });

      if (fullStockObj) {
        await this.historyService.recordMovement({
          inventoryId: Number(fullStockObj.inventory.id),
          warehouseId: Number(fullStockObj.warehouse.id),
          movementType: 'DECREASE',
          quantity: Number(dto.quantity),
          previousStock: Number(stockObj.quantity) + Number(dto.quantity),
          currentStock: Number(stockObj.quantity),
          referenceType: 'DECREASE',
          referenceId: Number(savedDec.id.replace('MERMA-', '')),
          notes: dto.motive,
        }, queryRunner.manager);
      }

      await queryRunner.commitTransaction();

      // Trigger stock evaluation
      if (fullStockObj?.inventory?.id && fullStockObj?.warehouse?.id) {
        try {
          await this.alertsService.evaluateStock(Number(fullStockObj.inventory.id), Number(fullStockObj.warehouse.id));
        } catch (alertErr) {
          console.error('Error triggering stock evaluation after decrease registration:', alertErr);
        }
      }

      // Emit socket event for real-time update
      if (this.gateway && this.gateway.server) {
        this.gateway.server.emit('decrease_created', {
          stock_id: dto.stock_id,
          quantity: dto.quantity,
          area_id: dto.area_id
        });
      }

      // Send Telegram notification
      try {
        const prodName = fullStockObj?.inventory?.name || 'N/A';
        const whName = fullStockObj?.warehouse?.name || 'N/A';
        const uomAbbrev = fullStockObj?.inventory?.uom?.abbreviation || 'und';
        await this.telegramService.sendMessage(
          `📉 *Merma Registrada (Pérdida)*\n` +
          `• *Código:* ${savedDec.id}\n` +
          `• *Insumo:* ${prodName}\n` +
          `• *Cantidad:* ${savedDec.quantity} ${uomAbbrev}\n` +
          `• *Almacén:* ${whName}\n` +
          `• *Motivo:* ${savedDec.motive || 'No especificado'}`
        );
      } catch (tgErr) {
        console.error('Failed to send Telegram notification for decrease creation:', tgErr);
      }

      return this.mapDecrease(savedDec, fullStockObj || stockObj);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    const list = await this.dataSource.getRepository(Decrease).find({
      relations: ['stock', 'stock.warehouse', 'stock.inventory'],
      order: { createdAt: 'DESC' }
    });

    return list.map(d => this.mapDecrease(d, d.stock));
  }

  async findOne(id: string) {
    const d = await this.dataSource.getRepository(Decrease).findOne({
      where: { id },
      relations: ['stock', 'stock.warehouse', 'stock.inventory']
    });
    if (!d) throw new NotFoundException('Merma no encontrada');
    return this.mapDecrease(d, d.stock);
  }

  async update(id: string, dto: any) {
    const d = await this.dataSource.getRepository(Decrease).findOne({
      where: { id },
      relations: ['stock', 'stock.warehouse', 'stock.inventory']
    });
    if (!d) throw new NotFoundException('Merma no encontrada');

    if (dto.cause !== undefined) d.cause = Number(dto.cause);
    if (dto.motive !== undefined) d.motive = dto.motive;
    if (dto.area_id !== undefined) d.area_id = Number(dto.area_id);

    if (dto.quantity !== undefined && Number(dto.quantity) !== Number(d.quantity)) {
      const diff = Number(dto.quantity) - Number(d.quantity);
      if (d.stock) {
        d.stock.quantity = Math.max(0, Number(d.stock.quantity) - diff);
        await this.dataSource.getRepository(InventoryStock).save(d.stock);
      }
      d.quantity = Number(dto.quantity);
    }

    const saved = await this.dataSource.getRepository(Decrease).save(d);
    if (saved.stock?.inventory?.id && saved.stock?.warehouse?.id) {
      try {
        await this.alertsService.evaluateStock(Number(saved.stock.inventory.id), Number(saved.stock.warehouse.id));
      } catch (alertErr) {
        console.error('Error triggering stock evaluation after decrease update:', alertErr);
      }
    }

    // Send Telegram notification
    try {
      const prodName = saved.stock?.inventory?.name || 'N/A';
      const whName = saved.stock?.warehouse?.name || 'N/A';
      const uomAbbrev = saved.stock?.inventory?.uom?.abbreviation || 'und';
      await this.telegramService.sendMessage(
        `✏️ *Merma Actualizada*\n` +
        `• *Código:* ${saved.id}\n` +
        `• *Insumo:* ${prodName}\n` +
        `• *Cantidad:* ${saved.quantity} ${uomAbbrev}\n` +
        `• *Almacén:* ${whName}\n` +
        `• *Nuevo Motivo:* ${saved.motive || 'No especificado'}`
      );
    } catch (tgErr) {
      console.error('Failed to send Telegram notification for decrease update:', tgErr);
    }

    return this.mapDecrease(saved, saved.stock);
  }

  async remove(id: string) {
    const d = await this.dataSource.getRepository(Decrease).findOne({
      where: { id },
      relations: ['stock', 'stock.inventory']
    });
    if (!d) throw new NotFoundException('Merma no encontrada');
    await this.dataSource.getRepository(Decrease).remove(d);

    // Send Telegram notification
    try {
      const prodName = d.stock?.inventory?.name || 'N/A';
      await this.telegramService.sendMessage(
        `🗑️ *Merma Eliminada*\n` +
        `• *Código:* ${d.id}\n` +
        `• *Insumo:* ${prodName}`
      );
    } catch (tgErr) {
      console.error('Failed to send Telegram notification for decrease removal:', tgErr);
    }

    return { success: true };
  }

  private mapDecrease(d: Decrease, stock: InventoryStock) {
    return {
      id: d.id,
      stock_id: Number(d.stock_id),
      quantity: Number(d.quantity),
      cause: Number(d.cause),
      motive: d.motive,
      area: Number(d.area_id),
      week: d.week,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
      productName: stock?.inventory?.name || 'N/A',
      sku: stock?.inventory?.sku || 'N/A',
      warehouseName: stock?.warehouse?.name || 'N/A'
    };
  }
}
