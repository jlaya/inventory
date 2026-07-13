import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { InventoryGateway } from '../inventory/inventory.gateway';
import { TelegramService } from './telegram.service';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryStock } from '../inventory_stock/entities/inventory_stock.entity';
import { InventoryTransaction } from '../purchase_orders/entities/inventory_transaction.entity';
import { Warehouse, WarehouseType } from '../warehouses/entities/warehouse.entity';
import { RequisitionDetail } from '../requisition_details/entities/requisition_detail.entity';
import { PurchaseOrderDetail } from '../purchase_orders/entities/purchase_order_detail.entity';
import { HistoryService } from '../history/history.service';
import * as XLSX from 'xlsx';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(forwardRef(() => InventoryGateway))
    private readonly gateway: InventoryGateway,
    private readonly telegramService: TelegramService,
    private readonly historyService: HistoryService,
  ) { }

  async evaluateStock(inventoryId: number, warehouseId: number): Promise<void> {
    try {
      this.logger.log(`Evaluando stock para insumo ID ${inventoryId} en almacén ID ${warehouseId}`);

      // Early guard to prevent TypeORM findOne error with undefined selection conditions
      if (!inventoryId || !warehouseId || isNaN(inventoryId) || isNaN(warehouseId)) {
        this.logger.warn(`Evaluación omitida: ID de insumo (${inventoryId}) o de almacén (${warehouseId}) no es válido.`);
        return;
      }

      // 1. Resolve Inventory details
      const inventory = await this.dataSource.getRepository(Inventory).findOne({
        where: { id: inventoryId as any, is_active: true, tracks_inventory: true },
        relations: ['uom'],
      });
      if (!inventory) {
        this.logger.log(`El insumo con ID ${inventoryId} no está activo o no es inventariable.`);
        return;
      }

      // 2. Resolve Warehouse details
      const warehouse = await this.dataSource.getRepository(Warehouse).findOne({
        where: { id: warehouseId as any },
      });
      if (!warehouse) {
        this.logger.error(`Almacén con ID ${warehouseId} no encontrado.`);
        return;
      }

      // 3. Resolve Stock metrics
      const stock = await this.dataSource.getRepository(InventoryStock).findOne({
        where: {
          warehouse: { id: warehouseId as any },
          inventory: { id: inventoryId as any },
        },
      });

      const stockActual = stock ? Number(stock.quantity) : 0;
      const minimumStock = stock ? Number(stock.minimumStock) : 0;
      const maximumStock = stock ? Number(stock.maximumStock || 0) : 0;
      const projectedDailyDemand = stock ? Number(stock.projectedDailyDemand || 0) : 0;
      const projectedWeeklyDemand = stock ? Number(stock.projectedWeeklyDemand || 0) : 0;
      const projectedProduction = stock ? Number(stock.projectedProduction || 0) : 0;

      // Resolve Central Warehouse
      let centralWh = await this.dataSource.getRepository(Warehouse).findOne({
        where: { warehouseType: WarehouseType.CENTRAL },
      });
      if (!centralWh) {
        centralWh = await this.dataSource.getRepository(Warehouse).findOne({
          where: { code: 'WH-CENTRAL' },
        });
      }
      const isCentral = centralWh ? Number(centralWh.id) === Number(warehouseId) : false;

      let severity: 'CRITICAL' | 'PREVENTIVE' | 'OVERPRODUCTION' | 'NORMAL' = 'NORMAL';
      let message = '';
      let dailyAvg = 0;
      let plannedProduction = 0;
      let projectedDemand = 0;

      if (isCentral) {
        // Apply Central Inventory Rules in Priority order
        if (stockActual < (projectedDailyDemand * 3)) {
          severity = 'CRITICAL';
          message = `🚨 *ALERTA CRÍTICA*: El stock físico actual de *${inventory.name}* (*${stockActual.toFixed(2)}*) es insuficiente para cubrir 3 días de operación en *${warehouse.name}* (Requerido: *${(projectedDailyDemand * 3).toFixed(2)}*).`;
        } else if (stockActual > (projectedWeeklyDemand * 1.30)) {
          severity = 'OVERPRODUCTION';
          message = `🟢 *ALERTA SOBREPRODUCCIÓN*: Stock de *${inventory.name}* en *${warehouse.name}* supera la demanda semanal en más del 30%. Stock actual: *${stockActual.toFixed(2)}* (Límite: *${(projectedWeeklyDemand * 1.30).toFixed(2)}*).`;
        } else if (projectedProduction < projectedWeeklyDemand) {
          severity = 'PREVENTIVE';
          message = `⚠️ *ALERTA PREVENTIVA*: Ritmo de producción proyectado de *${inventory.name}* en *${warehouse.name}* (*${projectedProduction.toFixed(2)}*) no satisfará la demanda semanal proyectada (*${projectedWeeklyDemand.toFixed(2)}*).`;
        }
        dailyAvg = projectedDailyDemand;
        plannedProduction = projectedProduction;
        projectedDemand = projectedWeeklyDemand;
      } else {
        // Traditional Warehouse Rules
        // 4. Calculate Daily Average Consumption (dailyAvg)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Query OUT transactions
        const outTransactions = await this.dataSource.getRepository(InventoryTransaction).find({
          where: {
            inventory: { id: inventoryId as any },
            warehouse: { id: warehouseId as any },
            transactionType: 'OUT',
            createdAt: MoreThanOrEqual(thirtyDaysAgo),
          },
        });

        let outSum = 0;
        for (const tx of outTransactions) {
          outSum += Number(tx.quantity);
        }

        dailyAvg = outSum / 30;
        if (dailyAvg <= 0) {
          if (minimumStock > 0) {
            dailyAvg = minimumStock / 3;
          } else {
            dailyAvg = 5.0; // Fallback valor por defecto
          }
        }

        // 5. Calculate Planned Production (plannedProduction)
        const pendingRequisitionsQtyResult = await this.dataSource
          .getRepository(RequisitionDetail)
          .createQueryBuilder('detail')
          .leftJoin('detail.requisition', 'req')
          .select('SUM(detail.requestedQuantity)', 'sum')
          .where('detail.inventory = :inventoryId', { inventoryId })
          .andWhere('req.destinationWarehouse = :warehouseId', { warehouseId })
          .andWhere('req.status IN (:...statuses)', { statuses: ['PENDING', 'APPROVED'] })
          .getRawOne();

        const reqQty = Number(pendingRequisitionsQtyResult?.sum || 0);

        const activePoDetails = await this.dataSource
          .getRepository(PurchaseOrderDetail)
          .createQueryBuilder('detail')
          .leftJoinAndSelect('detail.purchaseOrder', 'po')
          .leftJoinAndSelect('po.requisition', 'req')
          .where('detail.inventory = :inventoryId', { inventoryId })
          .andWhere('po.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['COMPLETED', 'CANCELLED', 'DRAFT'] })
          .getMany();

        let poPendingQty = 0;
        for (const pod of activePoDetails) {
          const poDestWarehouseId = pod.purchaseOrder?.requisition?.destinationWarehouse?.id;
          let poMatchesWarehouse = false;
          if (poDestWarehouseId) {
            poMatchesWarehouse = Number(poDestWarehouseId) === Number(warehouseId);
          } else {
            poMatchesWarehouse = isCentral;
          }

          if (poMatchesWarehouse) {
            const pending = Number(pod.quantity) - Number(pod.quantityReceived || 0);
            if (pending > 0) {
              poPendingQty += pending;
            }
          }
        }

        plannedProduction = reqQty + poPendingQty;

        // 6. Calculate Projected Demand (projectedDemand)
        projectedDemand = dailyAvg * 7;

        // 7. Evaluate Levels
        if (stockActual < dailyAvg * 3) {
          severity = 'CRITICAL';
          message = `🚨 *ALERTA CRÍTICA*: Stock de *${inventory.name}* en *${warehouse.name}* es extremadamente bajo. Stock actual: *${stockActual.toFixed(2)}* ${inventory.uom?.abbreviation || 'und'} (Consumo diario promedio: *${dailyAvg.toFixed(2)}*). Se requiere reabastecimiento urgente.`;
        } else if ((stockActual + plannedProduction) < projectedDemand) {
          severity = 'PREVENTIVE';
          message = `⚠️ *ALERTA PREVENTIVA*: Stock proyectado de *${inventory.name}* en *${warehouse.name}* no cubrirá la demanda semanal. Stock actual + Planificado: *${(stockActual + plannedProduction).toFixed(2)}* ${inventory.uom?.abbreviation || 'und'} (Demanda proyectada: *${projectedDemand.toFixed(2)}*).`;
        } else if (stockActual > projectedDemand * 1.3) {
          severity = 'OVERPRODUCTION';
          message = `🔵 *ALERTA SOBREPRODUCCIÓN*: Stock de *${inventory.name}* en *${warehouse.name}* supera la demanda proyectada en más del 30%. Stock actual: *${stockActual.toFixed(2)}* ${inventory.uom?.abbreviation || 'und'} (Límite proyectado: *${(projectedDemand * 1.3).toFixed(2)}*).`;
        }
      }

      if (severity !== 'NORMAL') {
        this.logger.warn(`Alerta de inventario generada: [${severity}] - ${message}`);

        // Channel 1: WebSockets via InventoryGateway
        const alertPayload = {
          inventoryId,
          sku: inventory.sku,
          productName: inventory.name,
          warehouseId,
          warehouseName: warehouse.name,
          quantity: stockActual,
          minimumStock,
          maximumStock,
          dailyAvg,
          plannedProduction,
          projectedDemand,
          severity,
          message: message.replace(/\*/g, ''), // Plain text message for web toast notifications
        };
        this.gateway.emitAlert(alertPayload);

        // Channel 2: Telegram Notification
        await this.telegramService.sendMessage(message);
      }
    } catch (e) {
      this.logger.error(`Error evaluando stock para insumo ID ${inventoryId} en almacén ID ${warehouseId}`, e);
    }
  }

  private lastAuditTime: Date | null = null;

  getLastAuditTime(): Date | null {
    return this.lastAuditTime;
  }

  async getAuditItems(): Promise<{ alertItems: any[], allItems: any[], criticalCount: number, preventiveCount: number, normalCount: number }> {
    // Resolve Central Warehouse
    let centralWh = await this.dataSource.getRepository(Warehouse).findOne({
      where: { warehouseType: WarehouseType.CENTRAL },
    });
    if (!centralWh) {
      centralWh = await this.dataSource.getRepository(Warehouse).findOne({
        where: { code: 'WH-CENTRAL' },
      });
    }
    if (!centralWh) {
      throw new Error('No se pudo encontrar el Almacén Central.');
    }

    // Fetch all stocks for Central Warehouse
    const stocks = await this.dataSource.getRepository(InventoryStock).find({
      where: { warehouse: { id: centralWh.id as any } },
      relations: ['inventory', 'inventory.uom'],
    });

    const alertItems: any[] = [];
    const allItems: any[] = [];
    let criticalCount = 0;
    let preventiveCount = 0;
    let normalCount = 0;

    for (const stock of stocks) {
      const inventory = stock.inventory;
      if (!inventory || !inventory.is_active || !inventory.tracks_inventory) {
        continue;
      }

      const stockActual = Number(stock.quantity || 0); // Physical stock
      const minimumStock = Number(stock.minimumStock || 0); // System stock

      const variationPct = minimumStock === 0 ? 0 : ((stockActual - minimumStock) / minimumStock) * 100;
      const absVar = Math.abs(variationPct);

      let severity: 'CRITICAL' | 'PREVENTIVE' | 'NORMAL' = 'NORMAL';
      let justification = '';

      if (absVar <= 5) {
        severity = 'NORMAL';
        justification = 'La variación está dentro del rango establecido. Flujo de cocina e inventario estable.';
        normalCount++;
      } else if (absVar > 5 && absVar <= 10) {
        severity = 'PREVENTIVE';
        justification = 'La variación excede el rango tolerable. Se recomienda un pre-conteo de validación.';
        preventiveCount++;
      } else {
        severity = 'CRITICAL';
        justification = 'La variación es significativa, requiere revisión inmediata de comandas, mermas o fugas.';
        criticalCount++;
      }

      const itemData = {
        sku: inventory.sku,
        name: inventory.name,
        uom: inventory.uom?.abbreviation || 'und',
        systemStock: minimumStock,
        physicalStock: stockActual,
        variationPct,
        alertType: severity,
        justification
      };

      if (severity !== 'NORMAL') {
        alertItems.push(itemData);
        allItems.push(itemData);
      }
    }

    return {
      alertItems,
      allItems,
      criticalCount,
      preventiveCount,
      normalCount
    };
  }

  async runCentralInventoryAudit(sendTelegram = true): Promise<any> {
    try {
      this.logger.log('Ejecutando auditoría consolidada del Inventario Central...');

      const {
        alertItems,
        allItems,
        criticalCount,
        preventiveCount,
        normalCount
      } = await this.getAuditItems();

      this.lastAuditTime = new Date();
      this.logger.log(`Auditoría de Inventario Central: ${alertItems.length} insumos con alertas de ${allItems.length} evaluados.`);

      // Generate Telegram consolidated report
      const message =
        `📋 *Reporte de Auditoría - Rango de Tolerancia de Inventario Central*\n\n` +
        `• *Desviación Crítica (> ±10%):* ${criticalCount}\n` +
        `• *Desviación Alerta (> ±5% hasta ±10%):* ${preventiveCount}\n` +
        `• *Dentro de Rango (±0% hasta ±5%):* ${normalCount}\n\n` +
        `*Total Fuera de Rango (Afectados):* ${alertItems.length} de ${allItems.length} insumos evaluados.`;

      let excelBuffer: Buffer | null = null;
      const totalEvaluados = criticalCount + preventiveCount + normalCount;

      if (totalEvaluados > 0) {
        // Generate Excel file using AOA
        const excelRows: any[] = [
          [],
          ["REPORTE DE AUDITORÍA - RANGO DE TOLERANCIA DE INVENTARIO CENTRAL"],
          [`Generado el: ${new Date().toLocaleString()}`],
          [],
          ["SKU", "Producto", "UOM", "Stock Sistema (Mínimo)", "Stock Físico (Cantidad)", "Variación (%)", "Estado Tolerancia", "Inconveniente / Explicación"]
        ];

        // Add products that do not meet the tolerance range
        for (const item of allItems) {
          const varVal = Number(item.variationPct || 0);

          excelRows.push([
            item.sku,
            item.name,
            item.uom,
            item.systemStock,
            item.physicalStock,
            `${varVal > 0 ? '+' : ''}${varVal.toFixed(2)}%`,
            item.alertType === 'CRITICAL' ? '🔴 Fuera de Rango / Crítico' : '🟡 Fuera de Rango / Alerta',
            item.justification
          ]);
        }

        const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tolerancia Inventario');
        excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        if (sendTelegram && excelBuffer) {
          await this.telegramService.sendDocument(
            excelBuffer,
            'reporte_alertas_inventario.xlsx',
            message
          );
        }
      } else {
        if (sendTelegram) {
          await this.telegramService.sendMessage(message + '\n\n*No se detectaron insumos en el inventario central.*');
        }
      }

      const auditResult = {
        success: true,
        criticalCount,
        preventiveCount,
        normalCount,
        totalAfectados: alertItems.length,
        totalEvaluados,
        items: alertItems,
        allItems,
        lastAuditTime: this.lastAuditTime,
        excelFileBase64: excelBuffer ? excelBuffer.toString('base64') : null
      };

      try {
        this.gateway.emitCronAudit(auditResult);
      } catch (wsErr) {
        this.logger.error('Error al emitir evento de cron por WebSocket', wsErr);
      }

      return auditResult;
    } catch (e) {
      this.logger.error('Error en auditoría consolidada de inventario central', e);
      return { success: false, error: e.message };
    }
  }

  async generateExcelReportBuffer(): Promise<Buffer> {
    const {
      allItems,
      criticalCount,
      preventiveCount,
      normalCount
    } = await this.getAuditItems();

    const totalEvaluados = criticalCount + preventiveCount + normalCount;

    const excelRows: any[] = [
      [],
      ["REPORTE DE AUDITORÍA - RANGO DE TOLERANCIA DE INVENTARIO CENTRAL"],
      [`Generado el: ${new Date().toLocaleString()}`],
      [],
      ["SKU", "Producto", "UOM", "Stock Sistema (Mínimo)", "Stock Físico (Cantidad)", "Variación (%)", "Estado Tolerancia", "Inconveniente / Explicación"]
    ];

    for (const item of allItems) {
      const varVal = Number(item.variationPct || 0);

      excelRows.push([
        item.sku,
        item.name,
        item.uom,
        item.systemStock,
        item.physicalStock,
        `${varVal > 0 ? '+' : ''}${varVal.toFixed(2)}%`,
        item.alertType === 'CRITICAL' ? '🔴 Fuera de Rango / Crítico' : '🟡 Fuera de Rango / Alerta',
        item.justification
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tolerancia Inventario');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async runRestockingAudit(sendTelegram = true): Promise<any> {
    try {
      this.logger.log('Iniciando auditoría de reabastecimiento crítico...');

      // Resolve Central Warehouse
      let centralWh = await this.dataSource.getRepository(Warehouse).findOne({
        where: { warehouseType: WarehouseType.CENTRAL },
      });
      if (!centralWh) {
        centralWh = await this.dataSource.getRepository(Warehouse).findOne({
          where: { code: 'WH-CENTRAL' },
        });
      }
      if (!centralWh) {
        throw new Error('No se pudo encontrar el Almacén Central.');
      }

      // Fetch all stocks for Central Warehouse
      const stocks = await this.dataSource.getRepository(InventoryStock).find({
        where: { warehouse: { id: centralWh.id as any } },
        relations: ['inventory', 'inventory.uom'],
      });

      const restockItems: any[] = [];
      for (const stock of stocks) {
        const inventory = stock.inventory;
        if (!inventory || !inventory.is_active || !inventory.tracks_inventory) {
          continue;
        }

        const stockActual = Number(stock.quantity || 0);
        const dailyDemand = Number(stock.projectedDailyDemand || 0);
        const minStock = Number(stock.minimumStock || 0);
        const maxStock = Number(stock.maximumStock || 0);

        // An item needs restocking if daily demand is set and stock covers < 3 days,
        // OR if stock is below the minimum stock limit
        const isCriticalDemand = dailyDemand > 0 && stockActual < (dailyDemand * 3);
        const isBelowMinStock = minStock > 0 && stockActual < minStock;

        if (isCriticalDemand || isBelowMinStock) {
          // If projectedDailyDemand is 0, estimate it as minimumStock / 3
          const effectiveDailyDemand = dailyDemand > 0 ? dailyDemand : (minStock / 3);
          const daysRemaining = effectiveDailyDemand > 0 ? (stockActual / effectiveDailyDemand) : 0;
          const qtyToRestock = maxStock > 0 ? (maxStock - stockActual) : ((effectiveDailyDemand * 7) - stockActual);

          if (qtyToRestock > 0) {
            restockItems.push({
              sku: inventory.sku,
              name: inventory.name,
              uom: inventory.uom?.abbreviation || 'und',
              physicalStock: stockActual,
              dailyDemand: effectiveDailyDemand,
              daysRemaining,
              maximumStock: maxStock,
              qtyToRestock: Number(qtyToRestock.toFixed(2))
            });
          }
        }
      }

      let excelBuffer: Buffer | null = null;

      if (restockItems.length > 0) {
        // Generate Excel file
        const excelRows: any[] = [
          [],
          ["PROPUESTA DE REABASTECIMIENTO CRÍTICO - CENTRAL DE INVENTARIO"],
          [`Generado el: ${new Date().toLocaleString()}`],
          [],
          ["SKU", "Producto", "UOM", "Stock Actual (Físico)", "Demanda Diaria", "Días Restantes", "Stock Máximo", "Cantidad Sugerida a Surtir"]
        ];

        for (const item of restockItems) {
          excelRows.push([
            item.sku,
            item.name,
            item.uom,
            item.physicalStock,
            item.dailyDemand,
            Number(item.daysRemaining.toFixed(2)),
            item.maximumStock,
            item.qtyToRestock
          ]);
        }

        const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Abastecimiento Sugerido');
        excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const message =
          `⚠️ *PROPUESTA DE REABASTECIMIENTO CRÍTICO - ALMACÉN CENTRAL*\n\n` +
          `Se han detectado *${restockItems.length}* insumos con menos de 3 días de suministro en el almacén.\n\n` +
          `Se adjunta propuesta de reabastecimiento en formato Excel. Puede aprobar esta solicitud directamente desde el panel administrativo en tiempo real.`;

        if (sendTelegram && excelBuffer) {
          await this.telegramService.sendDocument(
            excelBuffer,
            'propuesta_reabastecimiento_critico.xlsx',
            message
          );
        }
      }

      const auditResult = {
        success: true,
        warehouseId: centralWh.id,
        warehouseName: centralWh.name,
        items: restockItems,
        excelFileBase64: excelBuffer ? excelBuffer.toString('base64') : null,
        timestamp: new Date()
      };

      try {
        this.gateway.emitRestockingNeeded(auditResult);
      } catch (wsErr) {
        this.logger.error('Error al emitir evento de reabastecimiento por WebSocket', wsErr);
      }

      return auditResult;
    } catch (e) {
      this.logger.error('Error en auditoría de reabastecimiento', e);
      return { success: false, error: e.message };
    }
  }

  async replenishStocks(warehouseId: number, items: { sku: string, qty: number }[]): Promise<boolean> {
    try {
      this.logger.log(`Procesando reabastecimiento en tiempo real para almacén ID ${warehouseId} con ${items.length} insumos.`);

      for (const item of items) {
        const stock = await this.dataSource.getRepository(InventoryStock).findOne({
          where: {
            warehouse: { id: warehouseId as any },
            inventory: { sku: item.sku }
          },
          relations: ['inventory']
        });

        if (stock) {
          const oldQty = Number(stock.quantity || 0);
          const newQty = oldQty + Number(item.qty || 0);
          stock.quantity = newQty;
          await this.dataSource.getRepository(InventoryStock).save(stock);
          this.logger.log(`Stock de SKU ${item.sku} actualizado: ${oldQty} -> ${newQty}`);

          // Registrar movimiento en el historial para trazabilidad
          try {
            await this.historyService.recordMovement({
              inventoryId: Number(stock.inventory.id),
              warehouseId: Number(warehouseId),
              movementType: 'INPUT',
              quantity: Number(item.qty),
              previousStock: oldQty,
              currentStock: newQty,
              notes: `Entrada por Reabastecimiento Crítico en Almacén Central`
            });
          } catch (hErr) {
            this.logger.error(`Error al registrar movimiento en historial para SKU ${item.sku}:`, hErr);
          }
        }
      }

      // Send confirmation to Telegram
      const msg = `✅ *REABASTECIMIENTO COMPLETADO EN TIEMPO REAL*\n\n` +
        `Se han repuesto con éxito los insumos en el almacén central:\n` +
        items.map(it => `• SKU *${it.sku}*: +${it.qty.toFixed(2)}`).join('\n');
      await this.telegramService.sendMessage(msg);

      return true;
    } catch (e) {
      this.logger.error('Error al reabastecer stock', e);
      return false;
    }
  }

  @Cron(process.env.ALERTS_CRON_TIME || '*/600 * * * *')
  async runBackupCheck() {
    if (process.env.RUN_ALERTS_CRON === 'false') {
      this.logger.warn('RUN_ALERTS_CRON no está habilitado.');
      return
    }
    this.logger.log('Iniciando cron de auditoría de Inventario Central...');
    try {
      await this.runCentralInventoryAudit(true);
      this.logger.log('Cron de auditoría completado con éxito.');
    } catch (e) {
      this.logger.error('Error en cron de auditoría de Inventario Central', e);
    }
  }

  @Cron(process.env.ALERTS_CRON_TIME || '*/600 * * * *')
  async runRestockingBackupCheck() {
    if (process.env.RUN_ALERTS_CRON === 'false') {
      this.logger.warn('RUN_ALERTS_CRON no está habilitado.');
      return;
    }
    this.logger.log('Iniciando cron de reabastecimiento crítico...');
    try {
      await this.runRestockingAudit(true);
      this.logger.log('Cron de reabastecimiento crítico completado con éxito.');
    } catch (e) {
      this.logger.error('Error en cron de reabastecimiento crítico', e);
    }
  }
}
