import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryStock } from './entities/inventory_stock.entity';
//import { Warehouse } from '../warehouses/entities/warehouse.entity';
//import { Inventory } from '../inventory/entities/inventory.entity';
import { AlertsService } from '../alerts/alerts.service';
import { HistoryService } from '../history/history.service';

@Injectable()
export class InventoryStockService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(forwardRef(() => AlertsService))
    private readonly alertsService: AlertsService,
    private readonly historyService: HistoryService,
  ) { }

  async create(dto: any) {
    const existing = await this.dataSource.getRepository(InventoryStock).findOne({
      where: {
        warehouse: { id: dto.warehouse_id },
        inventory: { id: dto.inventory_id }
      },
      relations: ['warehouse', 'inventory', 'inventory.uom']
    });

    if (existing) {
      const prevQty = Number(existing.quantity);
      existing.quantity = Number(dto.quantity);
      if (dto.minimum_stock !== undefined) existing.minimumStock = Number(dto.minimum_stock);
      if (dto.bin_location !== undefined) existing.binLocation = dto.bin_location;

      const saved = await this.dataSource.getRepository(InventoryStock).save(existing);

      const diff = Number(dto.quantity) - prevQty;
      if (diff !== 0) {
        await this.historyService.recordMovement({
          inventoryId: Number(dto.inventory_id),
          warehouseId: Number(dto.warehouse_id),
          movementType: diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          quantity: Math.abs(diff),
          previousStock: prevQty,
          currentStock: Number(dto.quantity),
          referenceType: 'INVENTORY_ADJUSTMENT',
          notes: dto.notes || `Ajuste manual de stock (crear/reiniciar)`,
        });
      }

      await this.alertsService.evaluateStock(Number(dto.inventory_id), Number(dto.warehouse_id));
      return this.mapStock(saved);
    }

    const s = new InventoryStock();
    s.warehouse = { id: Number(dto.warehouse_id) } as any;
    s.inventory = { id: Number(dto.inventory_id) } as any;
    s.quantity = Number(dto.quantity) || 0;
    s.minimumStock = Number(dto.minimum_stock) || 0;
    s.binLocation = dto.bin_location || 'General';

    const savedNew = await this.dataSource.getRepository(InventoryStock).save(s);

    if (s.quantity > 0) {
      await this.historyService.recordMovement({
        inventoryId: Number(dto.inventory_id),
        warehouseId: Number(dto.warehouse_id),
        movementType: 'ADJUSTMENT_IN',
        quantity: s.quantity,
        previousStock: 0,
        currentStock: s.quantity,
        referenceType: 'INVENTORY_ADJUSTMENT',
        notes: dto.notes || `Creación inicial de stock`,
      });
    }

    await this.alertsService.evaluateStock(Number(dto.inventory_id), Number(dto.warehouse_id));
    return this.findOne(Number(savedNew.id));
  }

  async findAllStock() {
    const list = await this.dataSource.getRepository(InventoryStock).find({
      relations: ['warehouse', 'inventory', 'inventory.uom'],
      order: { id: 'ASC' }
    });
    return list.map(s => this.mapStock(s));
  }

  async findAll(warehouse_id: string) {
    const list = await this.dataSource.getRepository(InventoryStock).find({
      where: { warehouse: { id: Number(warehouse_id) } },
      relations: ['warehouse', 'inventory', 'inventory.uom'],
      order: { id: 'ASC' }
    });
    return list.map(s => this.mapStock(s));
  }

  async findOne(id: number) {
    const s = await this.dataSource.getRepository(InventoryStock).findOne({
      where: { id: id.toString() },
      relations: ['warehouse', 'inventory', 'inventory.uom']
    });
    if (!s) throw new NotFoundException('Métrica de stock no encontrada');
    return this.mapStock(s);
  }

  async update(id: number, dto: any) {
    const s = await this.dataSource.getRepository(InventoryStock).findOne({
      where: { id: id.toString() },
      relations: ['warehouse', 'inventory', 'inventory.uom']
    });
    if (!s) throw new NotFoundException('Métrica de stock no encontrada');

    const prevQty = Number(s.quantity);
    if (dto.quantity !== undefined) s.quantity = Number(dto.quantity);
    if (dto.minimum_stock !== undefined) s.minimumStock = Number(dto.minimum_stock);
    if (dto.bin_location !== undefined) s.binLocation = dto.bin_location;

    const saved = await this.dataSource.getRepository(InventoryStock).save(s);

    if (dto.quantity !== undefined && Number(dto.quantity) !== prevQty) {
      const diff = Number(dto.quantity) - prevQty;
      if (diff !== 0 && saved.inventory?.id && saved.warehouse?.id) {
        await this.historyService.recordMovement({
          inventoryId: Number(saved.inventory.id),
          warehouseId: Number(saved.warehouse.id),
          movementType: diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          quantity: Math.abs(diff),
          previousStock: prevQty,
          currentStock: Number(dto.quantity),
          referenceType: 'INVENTORY_ADJUSTMENT',
          notes: dto.notes || `Ajuste manual de stock (actualizar)`,
        });
      }
    }

    if (saved.inventory?.id && saved.warehouse?.id) {
      await this.alertsService.evaluateStock(Number(saved.inventory.id), Number(saved.warehouse.id));
    }
    return this.mapStock(saved);
  }

  async remove(id: number) {
    const s = await this.dataSource.getRepository(InventoryStock).findOne({ where: { id: id.toString() } });
    if (!s) throw new NotFoundException('Métrica de stock no encontrada');
    await this.dataSource.getRepository(InventoryStock).remove(s);
    return { success: true };
  }

  private mapStock(s: InventoryStock) {
    return {
      id: Number(s.id),
      warehouse_id: s.warehouse?.id ? Number(s.warehouse.id) : null,
      inventory_id: s.inventory?.id ? Number(s.inventory.id) : null,
      quantity: Number(s.quantity),
      minimum_stock: Number(s.minimumStock),
      maximum_stock: Number(s.maximumStock || 0),
      bin_location: s.binLocation,
      updated_at: s.updatedAt,
      productName: s.inventory?.name || 'Producto Eliminado',
      sku: s.inventory?.sku || 'N/A',
      barcode: s.inventory?.barcode || 'N/A',
      reference_cost: s.inventory ? Number(s.inventory.reference_cost) : 0,
      uomAbbrev: s.inventory?.uom?.abbreviation || 'und',
      warehouseName: s.warehouse?.name || 'Almacén Eliminado',
      operational_destination: s.inventory?.operational_destination || 'Restaurante'
    };
  }
}
