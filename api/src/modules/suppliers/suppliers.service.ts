import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SupplierCatalogItem } from './entities/supplier-catalog-item.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { AddCatalogItemDto } from './dto/catalog-item.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,

    @InjectRepository(SupplierCatalogItem)
    private readonly catalogRepo: Repository<SupplierCatalogItem>,

    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
  ) {}

  async findAll(): Promise<Supplier[]> {
    return await this.supplierRepo.find({
      relations: ['catalogItems', 'catalogItems.inventory', 'catalogItems.inventory.uom'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({
      where: { id },
      relations: ['catalogItems', 'catalogItems.inventory', 'catalogItems.inventory.uom'],
    });
    if (!supplier) {
      throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
    }
    return supplier;
  }

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    const supplier = this.supplierRepo.create(dto);
    return await this.supplierRepo.save(supplier);
  }

  async update(id: number, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);
    Object.assign(supplier, dto);
    return await this.supplierRepo.save(supplier);
  }

  async remove(id: number): Promise<{ success: boolean }> {
    const supplier = await this.findOne(id);
    await this.supplierRepo.remove(supplier);
    return { success: true };
  }

  async addCatalogItem(supplierId: number, dto: AddCatalogItemDto): Promise<SupplierCatalogItem> {
    const supplier = await this.findOne(supplierId);
    
    const inventory = await this.inventoryRepo.findOne({ where: { id: dto.inventoryId } });
    if (!inventory) {
      throw new NotFoundException(`Insumo con ID ${dto.inventoryId} no encontrado`);
    }

    // Check if relation already exists
    let catalogItem = await this.catalogRepo.findOne({
      where: {
        supplier: { id: supplier.id },
        inventory: { id: inventory.id }
      }
    });

    if (catalogItem) {
      // Update values
      if (dto.estimatedDeliveryDays !== undefined) {
        catalogItem.estimatedDeliveryDays = dto.estimatedDeliveryDays;
      }
      if (dto.lastPurchaseCost !== undefined) {
        catalogItem.lastPurchaseCost = dto.lastPurchaseCost;
      }
    } else {
      // Create new link
      catalogItem = this.catalogRepo.create({
        supplier,
        inventory,
        estimatedDeliveryDays: dto.estimatedDeliveryDays !== undefined ? dto.estimatedDeliveryDays : 1.0000,
        lastPurchaseCost: dto.lastPurchaseCost !== undefined ? dto.lastPurchaseCost : 0.0000
      });
    }

    return await this.catalogRepo.save(catalogItem);
  }

  async removeCatalogItem(supplierId: number, inventoryId: number): Promise<{ success: boolean }> {
    const catalogItem = await this.catalogRepo.findOne({
      where: {
        supplier: { id: supplierId },
        inventory: { id: inventoryId }
      }
    });

    if (!catalogItem) {
      throw new NotFoundException(`Insumo no está vinculado con este proveedor`);
    }

    await this.catalogRepo.remove(catalogItem);
    return { success: true };
  }
}
