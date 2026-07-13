import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnitOfMeasure } from './entities/unit.entity';
import { UomConversion } from './entities/uom-conversion.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { CreateUnitDto } from './dto/create-unit.dto';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(UnitOfMeasure)
    private readonly unitsRepo: Repository<UnitOfMeasure>,

    @InjectRepository(UomConversion)
    private readonly conversionsRepo: Repository<UomConversion>,

    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
  ) { }

  async findAll(): Promise<UnitOfMeasure[]> {
    return await this.unitsRepo.find({
      order: { name: 'ASC' }
    });
  }

  async findOne(id: number): Promise<UnitOfMeasure> {
    const unit = await this.unitsRepo.findOne({ where: { id } });
    if (!unit) throw new NotFoundException(`Unidad de medida con ID ${id} no encontrada`);
    return unit;
  }

  async create(createDto: CreateUnitDto): Promise<UnitOfMeasure> {
    const newUnit = this.unitsRepo.create(createDto);
    return await this.unitsRepo.save(newUnit);
  }

  async update(id: number, updateDto: any): Promise<UnitOfMeasure> {
    const unit = await this.findOne(id);
    Object.assign(unit, updateDto);
    return await this.unitsRepo.save(unit);
  }

  async remove(id: number): Promise<any> {
    const unit = await this.findOne(id);
    await this.unitsRepo.remove(unit);
    return { success: true };
  }

  // UOM Conversions
  async findAllConversions(): Promise<UomConversion[]> {
    return await this.conversionsRepo.find({
      relations: ['inventory', 'fromUom', 'toUom'],
      order: { id: 'DESC' }
    });
  }

  async createOrUpdateConversion(dto: { inventoryId: number; fromUomId: number; toUomId: number; factor: number }): Promise<UomConversion> {
    const inventory = await this.inventoryRepo.findOne({ where: { id: dto.inventoryId } });
    if (!inventory) throw new NotFoundException(`Insumo con ID ${dto.inventoryId} no encontrado`);

    const fromUom = await this.findOne(dto.fromUomId);
    const toUom = await this.findOne(dto.toUomId);

    let conversion = await this.conversionsRepo.findOne({
      where: {
        inventory: { id: inventory.id },
        fromUom: { id: fromUom.id },
        toUom: { id: toUom.id }
      }
    });

    if (conversion) {
      conversion.factor = dto.factor;
    } else {
      conversion = this.conversionsRepo.create({
        inventory,
        fromUom,
        toUom,
        factor: dto.factor
      });
    }

    return await this.conversionsRepo.save(conversion);
  }

  async removeConversion(id: number): Promise<{ success: boolean }> {
    const conversion = await this.conversionsRepo.findOne({ where: { id } });
    if (!conversion) throw new NotFoundException(`Conversión con ID ${id} no encontrada`);
    await this.conversionsRepo.remove(conversion);
    return { success: true };
  }
}