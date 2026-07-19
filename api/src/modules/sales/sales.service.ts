import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Raw } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryStock } from '../inventory_stock/entities/inventory_stock.entity';
import { InventoryTransaction } from '../purchase_orders/entities/inventory_transaction.entity';
import { TelegramService } from '../alerts/telegram.service';
import { AlertsService } from '../alerts/alerts.service';
import { InventoryMovement } from '../inventory-movements/entities/inventory-movement.entity';
import * as XLSX from 'xlsx';

export interface JobProgress {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  errorMsg?: string;
  reportBuffer?: Buffer;
  lowStockBuffer?: Buffer;
  createdAt: Date;
}

import { HistoryService } from '../history/history.service';

@Injectable()
export class SalesService {
  private activeJobs = new Map<string, JobProgress>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly telegramService: TelegramService,
    private readonly alertsService: AlertsService,
    private readonly historyService: HistoryService,
  ) { }

  getJobStatus(jobId: string): JobProgress {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new NotFoundException('Trabajo no encontrado');
    }
    return job;
  }

  // Returns all sales historical records with optional date filters
  async findAllSales(startDate?: string, endDate?: string): Promise<Sale[]> {
    const where: any = {};
    if (startDate && endDate) {
      where.createdAt = Raw(alias => `CAST(${alias} AS DATE) BETWEEN :startDate AND :endDate`, {
        startDate,
        endDate
      });
    } else if (startDate) {
      where.createdAt = Raw(alias => `CAST(${alias} AS DATE) >= :startDate`, {
        startDate
      });
    } else if (endDate) {
      where.createdAt = Raw(alias => `CAST(${alias} AS DATE) <= :endDate`, {
        endDate
      });
    }

    return this.dataSource.getRepository(Sale).find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  // Returns pending sales for manual intervention
  async findPendingSales(): Promise<Sale[]> {
    return this.dataSource.getRepository(Sale).find({
      where: { discountStatus: 'PENDING' },
      order: { createdAt: 'DESC' },
    });
  }

  // Helper to clean numeric and currency/percent formats
  private cleanValue(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[$\s%]/g, '').replace(/,/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  // Enqueue a job and run asynchronously in the background
  startProcessingJob(fileBuffer: Buffer, allowNegativeStock: boolean): string {
    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    const progress: JobProgress = {
      id: jobId,
      status: 'processing',
      progress: 0,
      totalRows: 0,
      processedRows: 0,
      successCount: 0,
      errorCount: 0,
      createdAt: new Date(),
    };

    this.activeJobs.set(jobId, progress);

    // Fire-and-forget execution
    this.processSalesFile(jobId, fileBuffer, allowNegativeStock).catch((err) => {
      //console.error(`Error in background sales processing job ${jobId}:`, err);
      const current = this.activeJobs.get(jobId);
      if (current) {
        current.status = 'failed';
        current.errorMsg = err.message || String(err);
      }
    });

    return jobId;
  }

  // Core background execution routine
  private async processSalesFile(jobId: string, fileBuffer: Buffer, allowNegativeStock: boolean, areaCode?: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: '' });

      if (rawRows.length === 0) {
        job.status = 'failed';
        job.errorMsg = 'El archivo está vacío.';
        job.progress = 100;
        return;
      }

      job.totalRows = rawRows.length;

      const generalReportRows: any[] = [];
      const lowStockReportRows: any[] = [];

      for (let index = 0; index < rawRows.length; index++) {
        const row = rawRows[index];
        const rowNum = index + 2;

        // Lookup Barcode
        const barcode = String(
          row['Código de Barra'] ||
          row['Codigo de Barra'] ||
          row['Código de Barras'] ||
          row['Codigo de Barras'] ||
          row['barcode'] ||
          row['Barcode'] ||
          ''
        ).trim();

        // Lookup Quantity
        const rawQty = row['Cantidad'] || row['cantidad'] || row['qty'] || row['Qty'] || row['Quantity'] || 0;
        const saleQuantity = this.cleanValue(rawQty);

        if (!barcode && !rawQty && Object.keys(row).length <= 1) {
          job.processedRows++;
          job.progress = Math.round((job.processedRows / job.totalRows) * 100);
          continue; // Skip empty rows
        }

        // Resolve Warehouse early to use its details in the report rows
        const warehouse = await this.dataSource.getRepository(Warehouse).findOne({
          where: { code: 'WH-CENTRAL', isActive: true }
        });

        console.log(warehouse)
        console.log(barcode)
        console.log(saleQuantity)

        if (!barcode) {
          job.processedRows++;
          job.errorCount++;
          generalReportRows.push({
            'Fila': rowNum,
            'Código de Barra': 'N/A',
            'Área': warehouse?.code || 'N/A',
            'Nombre de Área': warehouse?.name || 'N/A',
            'Insumo': 'N/A',
            'Cantidad Requerida': 0,
            'Estatus': 'Error: Código de Barra no provisto'
          });
          continue;
        }

        if (saleQuantity <= 0) {
          job.processedRows++;
          job.errorCount++;
          generalReportRows.push({
            'Fila': rowNum,
            'Código de Barra': barcode,
            'Área': warehouse?.code || 'N/A',
            'Nombre de Área': warehouse?.name || 'N/A',
            'Insumo': 'N/A',
            'Cantidad Requerida': 0,
            'Estatus': 'Error: Cantidad de venta debe ser mayor a 0'
          });
          continue;
        }

        const ingredient = await this.dataSource.getRepository(Ingredient).findOne({
          where: { code: barcode }
        });

        if (!ingredient) {
          job.processedRows++;
          job.errorCount++;
          generalReportRows.push({
            'Fila': rowNum,
            'Código de Barra': barcode,
            'Insumo': 'N/A',
            'Cantidad Requerida': 0,
            'Estatus': `Error: Receta/Producto con código de barras '${barcode}' no encontrado`
          });
          continue;
        }

        if (!warehouse) {
          job.processedRows++;
          job.errorCount++;
          generalReportRows.push({
            'Fila': rowNum,
            'Código de Barra': barcode,
            'Insumo': 'N/A',
            'Cantidad Requerida': 0,
            'Estatus': `Error: No se encontró un Almacén activo en el sistema`
          });
          continue;
        }

        // Clean all values inside row for items JSONB
        const itemsJson: Record<string, any> = {};
        const allowedMetricsHeaders = [
          '% cantidad',
          'venta neta',
          '% ventas',
          'descuento',
          '% descuento',
          'ultimo costo',
          'último costo',
          '% ultimo costo',
          '% último costo',
          'utilidad ultimo',
          'utilidad último',
          'utilidad ultimo costo',
          'utilidad último costo',
          '% utilidad ultimo',
          '% utilidad último',
          '% utilidad ultimo costo',
          '% utilidad último costo',
          'costo promedio',
          '% costo promedio',
          'utilidad costo',
          'utilidad costo promedio',
          '% utilidad costo',
          '% utilidad costo promedio',
          'impuestos',
          'venta neta + impuesto',
          'venta neta + impuestos'
        ];

        for (const [key, value] of Object.entries(row)) {
          const trimmedKey = key.trim();
          const lowerKey = trimmedKey.toLowerCase();

          if (allowedMetricsHeaders.includes(lowerKey)) {
            itemsJson[trimmedKey] = typeof value === 'number' ? value : this.cleanValue(value);
          }
        }

        // 2. Perform Recipe Decomposition & Stock Evaluation
        const recipeItems = ingredient.items || [];
        if (recipeItems.length === 0) {
          job.processedRows++;
          job.errorCount++;
          generalReportRows.push({
            'Fila': rowNum,
            'Código de Barra': barcode,
            'Insumo': 'N/A',
            'Cantidad Requerida': 0,
            'Estatus': 'Error: La receta no contiene insumos vinculados'
          });
          continue;
        }

        // Analyze shortages
        const shortages: { inventoryId: number; name: string; available: number; needed: number; shortage: number; errorType?: string }[] = [];
        const ingredientsToDeduct: { inventory: Inventory; stock: InventoryStock; consumed: number }[] = [];

        for (const recipeItem of recipeItems) {
          const insumoName = recipeItem.name || 'Insumo Desconocido';
          const neededQty = saleQuantity * recipeItem.quantity;

          // Find the Inventory record by inventory_id first, fallback to name (case-insensitive)
          let inventory: Inventory | null = null;
          if (recipeItem.inventory_id) {
            inventory = await this.dataSource.getRepository(Inventory).findOne({
              where: { id: Number(recipeItem.inventory_id) },
              relations: ['uom']
            });
          }
          if (!inventory) {
            inventory = await this.dataSource.getRepository(Inventory).createQueryBuilder('inv')
              .leftJoinAndSelect('inv.uom', 'uom')
              .where('LOWER(inv.name) = LOWER(:name)', { name: insumoName })
              .getOne();
          }

          if (!inventory) {
            shortages.push({
              inventoryId: Number(recipeItem.inventory_id) || 0,
              name: insumoName,
              available: 0,
              needed: neededQty,
              shortage: neededQty,
              errorType: 'NOT_FOUND'
            });
            continue;
          }

          // Lookup stock for this warehouse
          const stock = await this.dataSource.getRepository(InventoryStock).findOne({
            where: {
              warehouse: { id: warehouse.id as any },
              inventory: { id: inventory.id as any }
            }
          });

          if (!stock) {
            // Not registered in this area's inventory
            shortages.push({
              inventoryId: Number(inventory.id),
              name: insumoName,
              available: 0,
              needed: neededQty,
              shortage: neededQty,
              errorType: 'NOT_REGISTERED'
            });
            continue;
          }

          const availableStock = Number(stock.quantity);
          if (availableStock < neededQty && !allowNegativeStock) {
            shortages.push({
              inventoryId: Number(inventory.id),
              name: insumoName,
              available: availableStock,
              needed: neededQty,
              shortage: neededQty - availableStock,
              errorType: 'LOW_STOCK'
            });
          } else {
            ingredientsToDeduct.push({
              inventory,
              stock,
              consumed: neededQty
            });
          }
        }

        // 3. Save Sale & Apply Deductions Transactionally
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const sale = new Sale();
          sale.code = `SLS-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${rowNum}`;
          sale.ingredient = ingredient;
          sale.quantity = saleQuantity;
          sale.area = warehouse.code;
          sale.items = itemsJson;

          if (shortages.length > 0) {
            // Insufficient stock or not registered in inventory
            sale.discountStatus = 'PENDING';
            sale.discountErrors = shortages;
            await queryRunner.manager.save(sale);
            await queryRunner.commitTransaction();

            job.processedRows++;
            job.errorCount++;

            // Track shortages in low stock report and general report
            for (const s of shortages) {
              const statusMsg = s.errorType === 'NOT_REGISTERED'
                ? `Pendiente: Insumo no registrado en el inventario del área`
                : s.errorType === 'NOT_FOUND'
                  ? `Pendiente: Insumo no encontrado en el catálogo`
                  : `Pendiente: Stock Insuficiente (Déficit: ${s.shortage})`;

              lowStockReportRows.push({
                'Receta Código': barcode,
                'Receta': ingredient.name,
                'Área': warehouse.code,
                'Nombre de Área': warehouse.name,
                'Insumo faltante': s.name,
                'Cantidad Requerida': s.needed,
                'Stock Disponible': s.available,
                'Déficit': s.shortage,
                'Detalle': s.errorType === 'NOT_REGISTERED' ? 'No registrado' : s.errorType === 'NOT_FOUND' ? 'No encontrado' : 'Bajo Stock'
              });
              generalReportRows.push({
                'Fila': rowNum,
                'Código de Barra': barcode,
                'Área': warehouse.code,
                'Nombre de Área': warehouse.name,
                'Insumo': s.name,
                'Cantidad Requerida': s.needed,
                'Estatus': statusMsg
              });
            }
          } else {
            // Stock is sufficient or negative stock is allowed -> deduct stock
            sale.discountStatus = 'COMPLETED';
            const savedSale = await queryRunner.manager.save(sale);

            const movementItems: any[] = [];

            for (const item of ingredientsToDeduct) {
              const isCentral = warehouse.code === 'WH-CENTRAL';
              const previousStock = Number(item.stock.quantity);
              const newQty = previousStock - item.consumed;
              const finalQty = isCentral ? newQty : Math.max(0, newQty);
              
              await queryRunner.manager.update(
                InventoryStock,
                { id: item.stock.id },
                { quantity: finalQty }
              );
              item.stock.quantity = finalQty;

              movementItems.push({
                inventory_id: Number(item.inventory.id),
                name: item.inventory.name,
                consumed_quantity: item.consumed,
                previous_stock: previousStock,
                current_stock: item.stock.quantity,
                uom: item.inventory.uom?.abbreviation || 'Kg'
              });

              // Log inventory transaction
              const tx = new InventoryTransaction();
              tx.inventory = item.inventory;
              tx.warehouse = warehouse;
              tx.transactionType = 'OUT';
              tx.quantity = item.consumed;
              tx.referenceType = 'SALE';
              tx.referenceId = Number(savedSale.id);
              await queryRunner.manager.save(tx);

              await this.historyService.recordMovement({
                inventoryId: Number(item.inventory.id),
                warehouseId: Number(warehouse.id),
                movementType: 'SALE',
                quantity: item.consumed,
                previousStock: previousStock,
                currentStock: item.stock.quantity,
                referenceType: 'SALE',
                referenceId: Number(savedSale.id),
                notes: `Venta procesada. Producto: ${ingredient.name}`,
              }, queryRunner.manager);

              generalReportRows.push({
                'Fila': rowNum,
                'Código de Barra': barcode,
                'Área': warehouse.code,
                'Nombre de Área': warehouse.name,
                'Insumo': item.inventory.name,
                'Cantidad Requerida': item.consumed,
                'Estatus': 'Éxito: Stock descontado'
              });
            }

            // Save recipe stock movement traceability log
            const movement = new InventoryMovement();
            movement.recipeCode = barcode;
            movement.recipeId = Number(ingredient.id);
            movement.quantitySold = saleQuantity;
            movement.items = movementItems;
            await queryRunner.manager.save(movement);

            await queryRunner.commitTransaction();
            job.processedRows++;
            job.successCount++;

            // Evaluate thresholds for each updated stock level asynchronously
            for (const item of ingredientsToDeduct) {
              this.alertsService.evaluateStock(Number(item.inventory.id), Number(warehouse.id)).catch(err => {
                console.error(`Error checking alert threshold for inventory ${item.inventory.id}:`, err);
              });
            }
          }
        } catch (trxErr) {
          await queryRunner.rollbackTransaction();
          throw trxErr;
        } finally {
          await queryRunner.release();
        }

        job.progress = Math.round((job.processedRows / job.totalRows) * 100);
      }

      // 4. Generate report spreadsheets in memory
      const generalWb = XLSX.utils.book_new();
      const generalWs = XLSX.utils.json_to_sheet(generalReportRows);
      XLSX.utils.book_append_sheet(generalWb, generalWs, 'Reporte Ventas');
      job.reportBuffer = XLSX.write(generalWb, { type: 'buffer', bookType: 'xlsx' });

      let lowStockBuffer: Buffer | undefined;
      if (lowStockReportRows.length > 0) {
        const lowWb = XLSX.utils.book_new();
        const lowWs = XLSX.utils.json_to_sheet(lowStockReportRows);
        XLSX.utils.book_append_sheet(lowWb, lowWs, 'Insumos Stock Bajo');
        lowStockBuffer = XLSX.write(lowWb, { type: 'buffer', bookType: 'xlsx' });
        job.lowStockBuffer = lowStockBuffer;
      }

      job.status = 'completed';
      job.progress = 100;

      // Notify clients via WebSocket
      try {
        this.alertsService.emitSalesProcessed({ success: true, jobId });
      } catch (wsErr) {
        console.error('Error emitting sales_processed event:', wsErr);
      }

      // 5. Send reports to Telegram
      try {
        const dateStr = new Date().toLocaleDateString('es-ES');
        let message = `📊 *Resultados del ETL de Ventas (${dateStr})*\n` +
          `• *Filas Procesadas:* ${job.totalRows}\n` +
          `• *Descuentos Exitosos:* ${job.successCount} recetas\n` +
          `• *Pendientes/Errores:* ${job.errorCount} recetas`;

        if (lowStockReportRows.length > 0) {
          message += `\n⚠️ *Alerta:* Se detectaron insumos con stock insuficiente. Ver detalles en el segundo reporte adjunto.`;
        }

        await this.telegramService.sendMessage(message);

        // Attach main report file
        await this.telegramService.sendDocument(
          job.reportBuffer!,
          `reporte_ventas_${Date.now()}.xlsx`,
          'Reporte general del proceso ETL de ventas'
        );

        // Attach low stock report if available
        if (lowStockBuffer) {
          await this.telegramService.sendDocument(
            lowStockBuffer,
            `insumos_stock_bajo_${Date.now()}.xlsx`,
            'Reporte de insumos con stock insuficiente para manuales'
          );
        }
      } catch (tgErr) {
        console.error('Failed to send Telegram sales processing summary:', tgErr);
      }

    } catch (err: any) {
      console.error('Error processing sales Excel file:', err);
      job.status = 'failed';
      job.errorMsg = err.message || String(err);
      job.progress = 100;
    }
  }

  // Reprocess a pending discount manually once stock is refilled
  async processPendingDiscount(saleId: number): Promise<{ success: boolean; message: string }> {
    const sale = await this.dataSource.getRepository(Sale).findOne({
      where: { id: saleId },
      relations: ['ingredient']
    });

    if (!sale) {
      throw new NotFoundException('Venta pendiente no encontrada');
    }

    if (sale.discountStatus !== 'PENDING') {
      return { success: false, message: 'La venta ya ha sido descontada o procesada' };
    }

    const warehouse = await this.dataSource.getRepository(Warehouse).findOne({
      where: { code: sale.area }
    });

    if (!warehouse) {
      return { success: false, message: `Área/Almacén '${sale.area}' no encontrado` };
    }

    const recipeItems = sale.ingredient.items || [];
    const shortages: { inventoryId?: number; name: string; available: number; needed: number; shortage: number; errorType?: string }[] = [];
    const ingredientsToDeduct: { inventory: Inventory; stock: InventoryStock; consumed: number }[] = [];

    // Evaluate stock again
    for (const recipeItem of recipeItems) {
      const insumoName = recipeItem.name || 'Insumo Desconocido';
      const neededQty = sale.quantity * recipeItem.quantity;

      let inventory: Inventory | null = null;
      if (recipeItem.inventory_id) {
        inventory = await this.dataSource.getRepository(Inventory).findOne({
          where: { id: Number(recipeItem.inventory_id) },
          relations: ['uom']
        });
      }
      if (!inventory) {
        inventory = await this.dataSource.getRepository(Inventory).createQueryBuilder('inv')
          .leftJoinAndSelect('inv.uom', 'uom')
          .where('LOWER(inv.name) = LOWER(:name)', { name: insumoName })
          .getOne();
      }

      if (!inventory) {
        shortages.push({
          inventoryId: recipeItem.inventory_id ? Number(recipeItem.inventory_id) : undefined,
          name: insumoName,
          available: 0,
          needed: neededQty,
          shortage: neededQty,
          errorType: 'NOT_FOUND'
        });
        continue;
      }

      const stock = await this.dataSource.getRepository(InventoryStock).findOne({
        where: {
          warehouse: { id: warehouse.id as any },
          inventory: { id: inventory.id as any }
        }
      });

      if (!stock) {
        shortages.push({
          inventoryId: Number(inventory.id),
          name: insumoName,
          available: 0,
          needed: neededQty,
          shortage: neededQty,
          errorType: 'NOT_REGISTERED'
        });
        continue;
      }

      const availableStock = Number(stock.quantity);
      if (availableStock < neededQty) {
        shortages.push({
          inventoryId: Number(inventory.id),
          name: insumoName,
          available: availableStock,
          needed: neededQty,
          shortage: neededQty - availableStock,
          errorType: 'LOW_STOCK'
        });
      } else {
        ingredientsToDeduct.push({
          inventory,
          stock,
          consumed: neededQty
        });
      }
    }

    if (shortages.length > 0) {
      // Still short on stock or not registered -> update deficit details
      sale.discountErrors = shortages;
      await this.dataSource.getRepository(Sale).save(sale);

      const listStr = shortages.map(s => {
        if (s.errorType === 'NOT_REGISTERED') {
          return `${s.name} (No registrado en inventario del área)`;
        } else if (s.errorType === 'NOT_FOUND') {
          return `${s.name} (No encontrado en catálogo)`;
        }
        return `${s.name} (Falta: ${s.shortage.toFixed(2)})`;
      }).join(', ');
      return {
        success: false,
        message: `El descuento no es posible: ${listStr}`
      };
    }

    // Execute deductions
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      sale.discountStatus = 'COMPLETED';
      sale.discountErrors = null;
      await queryRunner.manager.save(sale);

      const movementItems: any[] = [];

      for (const item of ingredientsToDeduct) {
        const isCentral = warehouse.warehouseType === 'CENTRAL' || warehouse.name === 'Almacén Central';
        const previousStock = Number(item.stock.quantity);
        const newQty = previousStock - item.consumed;
        item.stock.quantity = isCentral ? newQty : Math.max(0, newQty);
        await queryRunner.manager.save(item.stock);

        movementItems.push({
          inventory_id: Number(item.inventory.id),
          name: item.inventory.name,
          consumed_quantity: item.consumed,
          previous_stock: previousStock,
          current_stock: item.stock.quantity,
          uom: item.inventory.uom?.abbreviation || 'Kg'
        });

        // Log transaction
        const tx = new InventoryTransaction();
        tx.inventory = item.inventory;
        tx.warehouse = warehouse;
        tx.transactionType = 'OUT';
        tx.quantity = item.consumed;
        tx.referenceType = 'SALE';
        tx.referenceId = Number(sale.id);
        await queryRunner.manager.save(tx);

        await this.historyService.recordMovement({
          inventoryId: Number(item.inventory.id),
          warehouseId: Number(warehouse.id),
          movementType: 'SALE',
          quantity: item.consumed,
          previousStock: previousStock,
          currentStock: item.stock.quantity,
          referenceType: 'SALE',
          referenceId: Number(sale.id),
          notes: `Venta pendiente procesada manualmente. Producto: ${sale.ingredient.name}`,
        }, queryRunner.manager);
      }

      // Save recipe stock movement traceability log
      const movement = new InventoryMovement();
      movement.recipeCode = sale.ingredient.code;
      movement.recipeId = Number(sale.ingredient.id);
      movement.quantitySold = sale.quantity;
      movement.items = movementItems;
      await queryRunner.manager.save(movement);

      await queryRunner.commitTransaction();

      // Trigger low-stock notifications if needed
      for (const item of ingredientsToDeduct) {
        this.alertsService.evaluateStock(Number(item.inventory.id), Number(warehouse.id)).catch(err => {
          console.error(`Error checking manual alert threshold for inventory ${item.inventory.id}:`, err);
        });
      }

      return { success: true, message: 'Venta descontada e inventario actualizado con éxito' };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      return { success: false, message: `Error en la transacción: ${err.message || err}` };
    } finally {
      await queryRunner.release();
    }
  }

  // Utility to generate a template file for sales uploads
  async generateSalesTemplate(): Promise<Buffer> {
    // Custom columns requested (with '#' first and 'area' second)
    const headers = [
      'Código de Barra',
      'Producto',
      'Cantidad',
      '% Cantidad',
      'Venta Neta',
      '% Ventas',
      'Descuento',
      '% Descuento',
      'Ultimo Costo',
      '% Ultimo Costo',
      'Utilidad Ultimo Costo',
      '% Utilidad Ultimo Costo',
      'Costo Promedio',
      '% Costo Promedio',
      'Utilidad Costo Promedio',
      '% Utilidad Costo Promedio',
      'Impuestos',
      'Venta Neta + Impuesto'
    ];

    const rows: any[] = [];

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventas');

    // Set nice widths
    const wscols = headers.map(h => ({ wch: Math.max(h.length + 3, 15) }));
    worksheet['!cols'] = wscols;

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async validateHeaders(fileBuffer: Buffer): Promise<{ valid: boolean; headers: string[]; error?: string }> {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rawRows.length === 0) {
        return { valid: false, headers: [], error: 'El archivo está vacío' };
      }
      const headers = (rawRows[0] || []).map((h: any) => String(h || '').trim());
      const hasBarcode = headers.some(h =>
        h.toLowerCase().includes('bar') ||
        h.toLowerCase().includes('código de barra') ||
        h.toLowerCase().includes('codigo de barra') ||
        h.toLowerCase().includes('código de barras') ||
        h.toLowerCase().includes('codigo de barras')
      );
      const hasQuantity = headers.some(h =>
        h.toLowerCase().includes('cant') ||
        h.toLowerCase().includes('qty') ||
        h.toLowerCase().includes('quantity')
      );
      if (!hasBarcode) {
        return { valid: false, headers, error: 'Falta la columna para el Código de Barra' };
      }
      if (!hasQuantity) {
        return { valid: false, headers, error: 'Falta la columna para la Cantidad' };
      }

      return { valid: true, headers };
    } catch (err: any) {
      return { valid: false, headers: [], error: err.message || 'Error al leer el archivo' };
    }
  }
}
