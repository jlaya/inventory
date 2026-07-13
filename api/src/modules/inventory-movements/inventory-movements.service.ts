import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryMovement } from './entities/inventory-movement.entity';

@Injectable()
export class InventoryMovementsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(startDate?: string, endDate?: string, recipeSearch?: string): Promise<InventoryMovement[]> {
    const repo = this.dataSource.getRepository(InventoryMovement);
    const query = repo.createQueryBuilder('m');

    if (startDate && endDate) {
      query.andWhere("CAST(m.created_at AS DATE) BETWEEN :startDate AND :endDate", { startDate, endDate });
    } else if (startDate) {
      query.andWhere("CAST(m.created_at AS DATE) >= :startDate", { startDate });
    } else if (endDate) {
      query.andWhere("CAST(m.created_at AS DATE) <= :endDate", { endDate });
    }

    if (recipeSearch) {
      query.andWhere("(m.recipe_code ILIKE :search OR m.recipe_id::text = :exactSearch)", {
        search: `%${recipeSearch}%`,
        exactSearch: recipeSearch
      });
    }

    query.orderBy('m.created_at', 'DESC');
    return await query.getMany();
  }

  async findOne(id: number): Promise<InventoryMovement> {
    const record = await this.dataSource.getRepository(InventoryMovement).findOne({
      where: { id: id as any }
    });
    if (!record) {
      throw new NotFoundException(`Movimiento de inventario con ID ${id} no encontrado`);
    }
    return record;
  }
}
