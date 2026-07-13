import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, EntityManager, Raw } from 'typeorm';
import { History } from './entities/history.entity';
import { CreateHistoryDto } from './dto/create-history.dto';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { User } from '../users/entities/user.entity';
import { InventoryStock } from '../inventory_stock/entities/inventory_stock.entity';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(InventoryStock)
    private readonly stockRepository: Repository<InventoryStock>,
  ) { }

  /**
   * Registra un nuevo movimiento de inventario en el historial.
   */
  async recordMovement(dto: CreateHistoryDto, manager?: EntityManager): Promise<History> {
    const inventoryRepo = manager ? manager.getRepository(Inventory) : this.inventoryRepository;
    const warehouseRepo = manager ? manager.getRepository(Warehouse) : this.warehouseRepository;
    const userRepo = manager ? manager.getRepository(User) : this.userRepository;
    const stockRepo = manager ? manager.getRepository(InventoryStock) : this.stockRepository;
    const historyRepo = manager ? manager.getRepository(History) : this.historyRepository;

    const inventory = await inventoryRepo.findOne({ where: { id: dto.inventoryId } });
    if (!inventory) {
      throw new NotFoundException(`Producto con ID ${dto.inventoryId} no encontrado`);
    }

    const warehouse = await warehouseRepo.findOne({ where: { id: dto.warehouseId } });
    if (!warehouse) {
      throw new NotFoundException(`Almacén/Área con ID ${dto.warehouseId} no encontrado`);
    }

    let user: User | null = null;
    if (dto.createdById) {
      user = await userRepo.findOne({ where: { id: dto.createdById } });
    }

    const history = new History();
    history.inventory = inventory;
    history.warehouse = warehouse;
    history.movementType = dto.movementType;
    history.quantity = Number(dto.quantity);
    history.referenceType = dto.referenceType || null;
    history.referenceId = dto.referenceId || null;
    history.lotNumber = dto.lotNumber || null;
    history.expirationDate = dto.expirationDate || null;
    history.notes = dto.notes || null;
    history.createdBy = user;

    // Obtener costo unitario: usar el del DTO, o el costo de referencia del inventario
    const unitCost = dto.unitCost !== undefined ? Number(dto.unitCost) : Number(inventory.reference_cost || 0);
    history.unitCost = unitCost;
    history.totalCost = history.quantity * unitCost;

    // Si se envían los stocks previo/actual desde el servicio que hace el cambio físico, los usamos.
    // De lo contrario, intentamos calcularlos consultando el stock actual.
    if (dto.previousStock !== undefined && dto.currentStock !== undefined) {
      history.previousStock = Number(dto.previousStock);
      history.currentStock = Number(dto.currentStock);
    } else {
      const stock = await stockRepo.findOne({
        where: { warehouse: { id: warehouse.id }, inventory: { id: inventory.id } },
      });

      const currentStockInDb = stock ? Number(stock.quantity) : 0;
      const isPositive = [
        'INPUT',
        'TRANSFER_IN',
        'PRODUCTION_YIELD',
        'ADJUSTMENT_IN',
      ].includes(dto.movementType);

      if (isPositive) {
        // Si el stock actual ya refleja el movimiento, el previo era restándole la cantidad
        history.currentStock = currentStockInDb;
        history.previousStock = Math.max(0, currentStockInDb - history.quantity);
      } else {
        // Si es salida, el previo era sumándole la cantidad
        history.currentStock = currentStockInDb;
        history.previousStock = currentStockInDb + history.quantity;
      }
    }

    if (dto.movementDate) {
      history.movementDate = dto.movementDate;
    }
    if (dto.week !== undefined) {
      history.week = dto.week;
    }

    return await historyRepo.save(history);
  }

  /**
   * Obtiene todos los registros del historial con filtros y paginación.
   */
  async findAll(filters: {
    warehouseId?: number;
    inventoryId?: number;
    movementType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.warehouseId) {
      where.warehouse = { id: filters.warehouseId };
    }
    if (filters.inventoryId) {
      where.inventory = { id: filters.inventoryId };
    }
    if (filters.movementType) {
      where.movementType = filters.movementType;
    }
    if (filters.startDate && filters.endDate) {
      where.movementDate = Raw(alias => `CAST(${alias} AS DATE) BETWEEN :startDate AND :endDate`, {
        startDate: filters.startDate,
        endDate: filters.endDate
      });
    } else if (filters.startDate) {
      where.movementDate = Raw(alias => `CAST(${alias} AS DATE) >= :startDate`, {
        startDate: filters.startDate
      });
    } else if (filters.endDate) {
      where.movementDate = Raw(alias => `CAST(${alias} AS DATE) <= :endDate`, {
        endDate: filters.endDate
      });
    }

    const [items, total] = await this.historyRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['inventory', 'warehouse', 'createdBy'],
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Obtiene el Kardex físico-valorado cronológico de un producto en un almacén específico.
   */
  async getKardex(warehouseId: number, inventoryId: number, startDate?: string, endDate?: string) {
    const where: any = {
      warehouse: { id: warehouseId },
      inventory: { id: inventoryId },
    };

    if (startDate && endDate) {
      where.movementDate = Raw(alias => `CAST(${alias} AS DATE) BETWEEN :startDate AND :endDate`, {
        startDate,
        endDate
      });
    }

    return await this.historyRepository.find({
      where,
      order: { createdAt: 'ASC' },
      relations: ['createdBy'],
    });
  }

  /**
   * Reporte diario inteligente de trazabilidad de movimientos agrupado por tipo de movimiento.
   */
  async getDailyMovementSummary(startDate: string, endDate: string, warehouseId?: number) {
    const queryBuilder = this.historyRepository
      .createQueryBuilder('h')
      .select('h.movement_date', 'date')
      .addSelect('h.movement_type', 'type')
      .addSelect('COUNT(h.id)', 'count')
      .addSelect('SUM(CAST(h.quantity AS NUMERIC))', 'total_quantity')
      .addSelect('SUM(CAST(h.total_cost AS NUMERIC))', 'total_cost_value')
      .where('CAST(h.movement_date AS DATE) BETWEEN :startDate AND :endDate', { startDate, endDate });

    if (warehouseId) {
      queryBuilder.andWhere('h.warehouse_id = :warehouseId', { warehouseId });
    }

    queryBuilder
      .groupBy('h.movement_date')
      .addGroupBy('h.movement_type')
      .orderBy('h.movement_date', 'ASC')
      .addOrderBy('h.movement_type', 'ASC');

    return await queryBuilder.getRawMany();
  }

  /**
   * Indicadores y KPIs Inteligentes de control de stock y eficiencia para el cuadro de mando.
   */
  async getKpiIndicators(startDate: string, endDate: string, warehouseId?: number) {
    // 1. Mermas (Decreases) totales y su costo
    const decreasesQuery = this.historyRepository
      .createQueryBuilder('h')
      .select('SUM(CAST(h.quantity AS NUMERIC))', 'quantity')
      .select('SUM(CAST(h.total_cost AS NUMERIC))', 'cost')
      .where('CAST(h.movement_date AS DATE) BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere("h.movement_type = 'DECREASE'");

    if (warehouseId) {
      decreasesQuery.andWhere('h.warehouse_id = :warehouseId', { warehouseId });
    }
    const rawDecreases = await decreasesQuery.getRawOne();
    const totalDecreasesCost = parseFloat(rawDecreases?.cost || 0);
    const totalDecreasesQty = parseFloat(rawDecreases?.quantity || 0);

    // 2. Consumo en producción
    const consumptionQuery = this.historyRepository
      .createQueryBuilder('h')
      .select('SUM(CAST(h.total_cost AS NUMERIC))', 'cost')
      .where('CAST(h.movement_date AS DATE) BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere("h.movement_type = 'PRODUCTION_CONSUMPTION'");

    if (warehouseId) {
      consumptionQuery.andWhere('h.warehouse_id = :warehouseId', { warehouseId });
    }
    const rawConsumption = await consumptionQuery.getRawOne();
    const totalConsumptionCost = parseFloat(rawConsumption?.cost || 0);

    // 3. Eficiencia: Tasa de Desperdicio / Mermas (%)
    const wasteRate = totalConsumptionCost > 0
      ? (totalDecreasesCost / totalConsumptionCost) * 100
      : 0;

    // 4. Productos más consumidos
    const topConsumedQuery = this.historyRepository
      .createQueryBuilder('h')
      .select('h.inventory_id', 'inventoryId')
      .addSelect('inv.name', 'productName')
      .addSelect('inv.sku', 'sku')
      .addSelect('SUM(CAST(h.quantity AS NUMERIC))', 'totalQuantity')
      .addSelect('SUM(CAST(h.total_cost AS NUMERIC))', 'totalCost')
      .innerJoin('h.inventory', 'inv')
      .where('CAST(h.movement_date AS DATE) BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere("h.movement_type IN ('PRODUCTION_CONSUMPTION', 'SALE')");

    if (warehouseId) {
      topConsumedQuery.andWhere('h.warehouse_id = :warehouseId', { warehouseId });
    }

    topConsumedQuery
      .groupBy('h.inventory_id')
      .addGroupBy('inv.name')
      .addGroupBy('inv.sku')
      .orderBy('"totalQuantity"', 'DESC')
      .limit(5);

    const topConsumed = await topConsumedQuery.getRawMany();

    // 5. Total de Ingresos (Compras recibidas)
    const inputsQuery = this.historyRepository
      .createQueryBuilder('h')
      .select('SUM(CAST(h.total_cost AS NUMERIC))', 'cost')
      .where('CAST(h.movement_date AS DATE) BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere("h.movement_type = 'INPUT'");

    if (warehouseId) {
      inputsQuery.andWhere('h.warehouse_id = :warehouseId', { warehouseId });
    }
    const rawInputs = await inputsQuery.getRawOne();
    const totalInputsCost = parseFloat(rawInputs?.cost || 0);

    // 6. Rotación de Inventario (Ratio aproximado)
    // Ratio = Consumo Total / Stock Promedio (estimado con el último stock)
    const stockQuery = this.stockRepository
      .createQueryBuilder('s')
      .select('SUM(CAST(s.quantity AS NUMERIC) * CAST(inv.reference_cost AS NUMERIC))', 'total_value')
      .innerJoin('s.inventory', 'inv');

    if (warehouseId) {
      stockQuery.where('s.warehouse_id = :warehouseId', { warehouseId });
    }
    const rawStockVal = await stockQuery.getRawOne();
    const currentStockValue = parseFloat(rawStockVal?.total_value || 0);

    const inventoryTurnover = currentStockValue > 0
      ? (totalConsumptionCost + totalDecreasesCost) / currentStockValue
      : 0;

    return {
      period: { startDate, endDate },
      totalDecreasesCost,
      totalDecreasesQty,
      totalConsumptionCost,
      wasteRate: parseFloat(wasteRate.toFixed(2)),
      totalInputsCost,
      currentStockValue,
      inventoryTurnover: parseFloat(inventoryTurnover.toFixed(2)),
      topConsumed: topConsumed.map(item => ({
        inventoryId: Number(item.inventoryId),
        productName: item.productName,
        sku: item.sku,
        totalQuantity: parseFloat(item.totalQuantity || 0),
        totalCost: parseFloat(item.totalCost || 0),
      })),
    };
  }
}
