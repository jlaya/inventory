import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Warehouse, WarehouseType } from './entities/warehouse.entity';

@Injectable()
export class WarehousesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(dto: any) {
    const w = new Warehouse();
    w.code = dto.code || `W-${Date.now().toString().slice(-4)}`;
    w.name = dto.name;
    w.warehouseType = dto.warehouse_type || WarehouseType.PRODUCTION_STATION;
    w.isActive = dto.is_active !== undefined ? dto.is_active : true;
    if (dto.parent_warehouse_id) {
      w.parentWarehouse = { id: Number(dto.parent_warehouse_id) } as any;
    }

    return this.dataSource.getRepository(Warehouse).save(w);
  }

  async findAll() {
    return this.dataSource.getRepository(Warehouse).find({
      relations: ['parentWarehouse', 'children']
    });
  }

  async findOne(id: number) {
    const w = await this.dataSource.getRepository(Warehouse).findOne({
      where: { id },
      relations: ['parentWarehouse', 'children']
    });
    if (!w) throw new NotFoundException('Almacén no encontrado');
    return w;
  }

  async update(id: number, dto: any) {
    const w = await this.findOne(id);
    if (dto.name !== undefined) w.name = dto.name;
    if (dto.code !== undefined) w.code = dto.code;
    if (dto.warehouse_type !== undefined) w.warehouseType = dto.warehouse_type;
    if (dto.is_active !== undefined) w.isActive = dto.is_active;
    if (dto.parent_warehouse_id !== undefined) {
      w.parentWarehouse = dto.parent_warehouse_id ? ({ id: Number(dto.parent_warehouse_id) } as any) : null;
    }

    return this.dataSource.getRepository(Warehouse).save(w);
  }

  async remove(id: number) {
    const w = await this.findOne(id);
    await this.dataSource.getRepository(Warehouse).remove(w);
    return { success: true };
  }
}
