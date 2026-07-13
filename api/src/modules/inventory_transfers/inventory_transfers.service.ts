import { Injectable, BadRequestException, NotFoundException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryTransfer } from './entities/inventory_transfer.entity';
import { InventoryTransferItem } from './entities/inventory_transfer_item.entity';
import { InventoryStock } from '../inventory_stock/entities/inventory_stock.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { CompleteTransferDto } from './dto/complete-transfer.dto';
import { Requisition } from '../requisitions/entities/requisition.entity';
import { User } from '../users/entities/user.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import console from 'console';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { AlertsService } from '../alerts/alerts.service';
import { TelegramService } from '../alerts/telegram.service';
import { HistoryService } from '../history/history.service';

@Injectable()
export class InventoryTransfersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(forwardRef(() => AlertsService))
    private readonly alertsService: AlertsService,
    private readonly telegramService: TelegramService,
    private readonly historyService: HistoryService,
  ) { }

  async executeTransfer(dto: CreateTransferDto): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const fromWh = await queryRunner.manager.findOne(Warehouse, { where: { id: dto.fromWarehouseId } });
      const toWh = await queryRunner.manager.findOne(Warehouse, { where: { id: dto.toWarehouseId } });
      if (!fromWh || !toWh) throw new NotFoundException('Almacén de origen o destino no encontrado');

      let user = await queryRunner.manager.findOne(User, { where: { id: dto.userId } });
      if (!user) {
        user = await queryRunner.manager.findOne(User, { order: { id: 'ASC' } });
      }

      const requisition = dto.requisitionId
        ? await queryRunner.manager.findOne(Requisition, { where: { id: dto.requisitionId } })
        : null;

      const activeItems = (dto.items || []).filter(item => {
        const qty = Number(item.quantityShipped || item['quantity_shipped'] || 0);
        return item.inventoryId > 0 && qty > 0;
      });

      if (activeItems.length === 0) {
        throw new BadRequestException('No hay insumos con cantidad mayor a 0 para transferir');
      }

      // Check availability before execution
      const deficits: { inventoryId: number; requestedQuantity: number; availableQuantity: number }[] = [];
      for (const item of activeItems) {
        const qty = Number(item.quantityShipped || item['quantity_shipped'] || 0);
        const stockOrigen = await queryRunner.manager.findOne(InventoryStock, {
          where: {
            warehouse: { id: Number(fromWh.id) },
            inventory: { id: Number(item.inventoryId) }
          }
        });
        const availableQty = stockOrigen ? Number(stockOrigen.quantity) : 0;
        if (availableQty < qty) {
          deficits.push({
            inventoryId: Number(item.inventoryId),
            requestedQuantity: qty,
            availableQuantity: availableQty
          });
        }
      }

      if (deficits.length > 0) {
        throw new ConflictException({
          message: 'Stock insuficiente en el almacén de origen',
          requiresAdjustment: true,
          deficits: deficits
        });
      }

      const nextIdResult = await queryRunner.manager.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM inventory_transfers');
      const nextId = Number(nextIdResult[0].next_id);
      const transferNumber = `TRA-${nextId.toString().padStart(4, '0')}`;

      const transfer = new InventoryTransfer();
      transfer.transferNumber = transferNumber;
      transfer.fromWarehouse = fromWh;
      transfer.toWarehouse = toWh;
      transfer.requisition = requisition;
      transfer.dispatchedBy = user || ({ id: 1 } as any);
      transfer.status = 'COMPLETED';
      transfer.notes = dto.notes || null;

      const savedTransfer = await queryRunner.manager.save(transfer);

      for (const item of activeItems) {
        const qty = Number(item.quantityShipped || item['quantity_shipped'] || 0);
        const stockOrigen = await queryRunner.manager.findOne(InventoryStock, {
          where: {
            warehouse: { id: Number(fromWh.id) },
            inventory: { id: Number(item.inventoryId) }
          },
          lock: { mode: 'pessimistic_write' }
        });
        // Descuento del almacen de origen
        if (stockOrigen) {
          const newQty = Number(stockOrigen.quantity) - Number(qty);
          stockOrigen.quantity = parseFloat((Math.max(0, newQty)).toFixed(4));
          await queryRunner.manager.save(stockOrigen);

          await this.historyService.recordMovement({
            inventoryId: Number(item.inventoryId),
            warehouseId: Number(fromWh.id),
            movementType: 'TRANSFER_OUT',
            quantity: qty,
            previousStock: stockOrigen.quantity + qty,
            currentStock: stockOrigen.quantity,
            referenceType: 'INVENTORY_TRANSFER',
            referenceId: Number(savedTransfer.id),
            notes: dto.notes || `Despacho de transferencia ${transferNumber}`,
          }, queryRunner.manager);
        }

        // Ingreso al almacen de destino
        let stockDestino = await queryRunner.manager.findOne(InventoryStock, {
          where: {
            warehouse: { id: Number(toWh.id) },
            inventory: { id: Number(item.inventoryId) }
          }
        });

        if (!stockDestino) {
          const stockOrigin = await queryRunner.manager.findOne(InventoryStock, {
            where: {
              warehouse: { id: 1 },
              inventory: { id: Number(item.inventoryId) }
            }
          });
          const newStock = new InventoryStock();
          newStock.warehouse = { id: Number(toWh.id) } as any;
          newStock.inventory = { id: Number(item.inventoryId) } as any;
          newStock.quantity = qty;
          newStock.minimumStock = Number(stockOrigin?.minimumStock || 0);
          newStock.maximumStock = Number(stockOrigin?.maximumStock || 0);
          newStock.binLocation = 'Ubicación Recibida';
          stockDestino = newStock;
        } else {
          stockDestino.quantity = parseFloat((Number(stockDestino.quantity) + qty).toFixed(4));
        }

        await queryRunner.manager.save(stockDestino);

        await this.historyService.recordMovement({
          inventoryId: Number(item.inventoryId),
          warehouseId: Number(toWh.id),
          movementType: 'TRANSFER_IN',
          quantity: qty,
          previousStock: Number(stockDestino.quantity) - qty,
          currentStock: Number(stockDestino.quantity),
          referenceType: 'INVENTORY_TRANSFER',
          referenceId: Number(savedTransfer.id),
          notes: dto.notes || `Recepción de transferencia ${transferNumber}`,
        }, queryRunner.manager);

        const transferItem = new InventoryTransferItem();
        transferItem.transfer = savedTransfer;
        transferItem.inventory_id = item.inventoryId;
        transferItem.quantity_shipped = qty;
        transferItem.quantity_received = qty;
        transferItem.notes = item.notes || null;

        await queryRunner.manager.save(transferItem);
      }

      if (requisition) {
        requisition.status = 'COMPLETED';
        requisition.approvedBy = user || ({ id: 1 } as any);
        await queryRunner.manager.save(requisition);
      }

      await queryRunner.commitTransaction();

      // Trigger stock evaluation for each item in the transfer
      try {
        for (const item of activeItems) {
          await this.alertsService.evaluateStock(Number(item.inventoryId), Number(dto.fromWarehouseId));
        }
      } catch (alertErr) {
        console.error('Error triggering stock evaluation after executeTransfer:', alertErr);
      }

      // Send Telegram notification
      try {
        const fullTransfer = await this.findOne(savedTransfer.id);
        await this.telegramService.sendMessage(
          `🚚 *SOLICITUD APROBADA, CONFIRME LA LLEGADA DE LOS INSUMOS*\n` +
          `• *Número:* ${fullTransfer.transfer_number}\n` +
          `• *Origen:* ${fullTransfer.fromWarehouseName}\n` +
          `• *Destino:* ${fullTransfer.toWarehouseName}\n` +
          `• *Despachador:* ${fullTransfer.dispatchedByUserName || 'N/A'}\n` +
          `• *Items:* ${fullTransfer.items?.length || 0} insumos`
        );
      } catch (tgErr) {
        console.error('Failed to send Telegram notification for transfer dispatch:', tgErr);
      }

      return this.findOne(savedTransfer.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async executeTransferWithAdjustment(
    requisitionId: number,
    userId: number,
    adjustments: { inventoryId: number; adjustedQuantity: number }[]
  ): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const requisition = await queryRunner.manager.findOne(Requisition, {
        where: { id: requisitionId },
        relations: ['sourceWarehouse', 'destinationWarehouse', 'items', 'items.inventory']
      });

      if (!requisition) {
        throw new NotFoundException('Requisición no encontrada');
      }

      let user = await queryRunner.manager.findOne(User, { where: { id: userId } });
      if (!user) {
        user = await queryRunner.manager.findOne(User, { order: { id: 'ASC' } });
      }

      // 1. Recover original quantities from Excel if they are 0 in database
      let excelItems: { id: number; cantidad: number }[] = [];
      if (requisition.excelPath) {
        try {
          const relativePath = requisition.excelPath.startsWith('/')
            ? requisition.excelPath.substring(1)
            : requisition.excelPath;
          const excelFullPath = path.resolve(process.cwd(), relativePath);
          if (fs.existsSync(excelFullPath)) {
            const workbook = XLSX.readFile(excelFullPath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<any>(sheet);
            excelItems = rows.map((row: any) => {
              let id = 0;
              let cantidad = 0;
              for (const key of Object.keys(row)) {
                const k = key.toLowerCase().trim();
                if (k === 'id') id = Number(row[key]);
                else if (k === 'cantidad' || k === 'quantity') cantidad = Number(row[key]);
              }
              return { id, cantidad };
            });
          }
        } catch (excelErr) {
          console.error('Error reading Excel for adjustment recovery:', excelErr);
        }
      }

      // 2. Update Requisition details & keep track of excel rows
      const excelRows: { id: number; insumo: string; cantidad: number }[] = [];

      for (const item of requisition.items) {
        let originalQty = Number(item.requestedQuantity || item['requested_quantity'] || 0);
        if (originalQty <= 0 && excelItems.length > 0) {
          const matchedExcel = excelItems.find(e => Number(e.id) === Number(item.inventory.id));
          if (matchedExcel) {
            originalQty = matchedExcel.cantidad;
            item.requestedQuantity = originalQty;
          }
        }

        const adjustment = adjustments.find(a => Number(a.inventoryId) === Number(item.inventory.id));
        if (adjustment) {
          item.requestedQuantity = parseFloat(Number(adjustment.adjustedQuantity).toFixed(4));
        } else if (originalQty > 0) {
          item.requestedQuantity = originalQty;
        }
        await queryRunner.manager.save(item);

        excelRows.push({
          id: Number(item.inventory.id),
          insumo: item.inventory.name,
          cantidad: Number(item.requestedQuantity)
        });
      }

      // 2. Overwrite Requisition Excel file if present
      if (requisition.excelPath) {
        try {
          const excelFullPath = path.resolve(
            process.cwd(),
            requisition.excelPath.startsWith('/') ? requisition.excelPath.substring(1) : requisition.excelPath
          );
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(excelRows);
          XLSX.utils.book_append_sheet(wb, ws, 'Requisition');
          XLSX.writeFile(wb, excelFullPath);
        } catch (excelErr) {
          console.error('Error overwriting Excel file during adjustment:', excelErr);
        }
      }

      // 3. Create Transfer record
      const nextIdResult = await queryRunner.manager.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM inventory_transfers');
      const nextId = Number(nextIdResult[0].next_id);
      const transferNumber = `TRA-${nextId.toString().padStart(4, '0')}`;

      const transfer = new InventoryTransfer();
      transfer.transferNumber = transferNumber;
      transfer.fromWarehouse = requisition.destinationWarehouse;
      transfer.toWarehouse = requisition.sourceWarehouse;
      transfer.requisition = requisition;
      transfer.dispatchedBy = user || ({ id: 1 } as any);
      transfer.status = 'COMPLETED';
      transfer.notes = requisition.notes || `Ejecutado de requisición ajustada ${requisition.requisitionNumber}`;

      const savedTransfer = await queryRunner.manager.save(transfer);

      // 4. Update warehouse stock (subtract quantity) & create transfer items
      let processedItemsCount = 0;
      for (const item of requisition.items) {
        const qtyToShip = Number(item.requestedQuantity || item['requested_quantity'] || 0);
        if (qtyToShip <= 0) {
          continue;
        }
        processedItemsCount++;

        const stockOrigen = await queryRunner.manager.findOne(InventoryStock, {
          where: {
            warehouse: { id: Number(requisition.destinationWarehouse.id) },
            inventory: { id: Number(item.inventory.id) }
          },
          lock: { mode: 'pessimistic_write' }
        });

        let availableQty = stockOrigen ? Number(stockOrigen.quantity) : 0;
        if (availableQty < qtyToShip) {
          // Dynamic stock balancing: adjust the source warehouse's stock level to allow the dispatch
          if (stockOrigen) {
            stockOrigen.quantity = qtyToShip;
            await queryRunner.manager.save(stockOrigen);
            availableQty = qtyToShip;
          } else {
            const newStock = new InventoryStock();
            newStock.warehouse = requisition.destinationWarehouse;
            newStock.inventory = item.inventory;
            newStock.quantity = qtyToShip;
            newStock.minimumStock = 0;
            newStock.binLocation = 'General';
            await queryRunner.manager.save(newStock);
            availableQty = qtyToShip;
          }
        }

        const stockOrigenLoaded = stockOrigen || await queryRunner.manager.findOne(InventoryStock, {
          where: {
            warehouse: { id: Number(requisition.destinationWarehouse.id) },
            inventory: { id: Number(item.inventory.id) }
          }
        });

        if (stockOrigenLoaded) {
          const isFromCentral = requisition.destinationWarehouse && (requisition.destinationWarehouse.warehouseType === 'CENTRAL' || requisition.destinationWarehouse.name === 'Almacén Central');
          const newQty = availableQty - qtyToShip;
          stockOrigenLoaded.quantity = parseFloat((isFromCentral ? newQty : Math.max(0, newQty)).toFixed(4));
          await queryRunner.manager.save(stockOrigenLoaded);

          await this.historyService.recordMovement({
            inventoryId: Number(item.inventory.id),
            warehouseId: Number(requisition.destinationWarehouse.id),
            movementType: 'TRANSFER_OUT',
            quantity: qtyToShip,
            previousStock: stockOrigenLoaded.quantity + qtyToShip,
            currentStock: stockOrigenLoaded.quantity,
            referenceType: 'INVENTORY_TRANSFER',
            referenceId: Number(savedTransfer.id),
            notes: requisition.notes || `Despacho de transferencia ajustada ${transferNumber}`,
          }, queryRunner.manager);
        }

        // Ingreso al almacen de destino
        let stockDestino = await queryRunner.manager.findOne(InventoryStock, {
          where: {
            warehouse: { id: Number(requisition.sourceWarehouse.id) },
            inventory: { id: Number(item.inventory.id) }
          }
        });

        if (!stockDestino) {
          const stockOrigin = await queryRunner.manager.findOne(InventoryStock, {
            where: {
              warehouse: { id: 1 },
              inventory: { id: Number(item.inventory.id) }
            }
          });
          const newStock = new InventoryStock();
          newStock.warehouse = { id: Number(requisition.sourceWarehouse.id) } as any;
          newStock.inventory = { id: Number(item.inventory.id) } as any;
          newStock.quantity = qtyToShip;
          newStock.minimumStock = Number(stockOrigin?.minimumStock || 0);
          newStock.maximumStock = Number(stockOrigin?.maximumStock || 0);
          newStock.binLocation = 'Ubicación Recibida';
          stockDestino = newStock;
        } else {
          stockDestino.quantity = parseFloat((Number(stockDestino.quantity) + qtyToShip).toFixed(4));
        }

        await queryRunner.manager.save(stockDestino);

        await this.historyService.recordMovement({
          inventoryId: Number(item.inventory.id),
          warehouseId: Number(requisition.sourceWarehouse.id),
          movementType: 'TRANSFER_IN',
          quantity: qtyToShip,
          previousStock: Number(stockDestino.quantity) - qtyToShip,
          currentStock: Number(stockDestino.quantity),
          referenceType: 'INVENTORY_TRANSFER',
          referenceId: Number(savedTransfer.id),
          notes: requisition.notes || `Recepción de transferencia ajustada ${transferNumber}`,
        }, queryRunner.manager);

        const transferItem = new InventoryTransferItem();
        transferItem.transfer = savedTransfer;
        transferItem.inventory_id = Number(item.inventory.id);
        transferItem.quantity_shipped = qtyToShip;
        transferItem.quantity_received = qtyToShip;
        transferItem.notes = item.notes || null;

        await queryRunner.manager.save(transferItem);
      }

      if (processedItemsCount === 0) {
        throw new BadRequestException('No hay insumos con cantidad mayor a 0 para transferir');
      }

      // 5. Update Requisition status
      requisition.status = 'COMPLETED';
      requisition.approvedBy = user || ({ id: 1 } as any);
      await queryRunner.manager.save(requisition);

      await queryRunner.commitTransaction();

      // Trigger stock evaluation for each item in the adjusted transfer
      try {
        if (requisition.items && requisition.items.length > 0) {
          for (const item of requisition.items) {
            const qtyToShip = Number(item.requestedQuantity || item['requested_quantity'] || 0);
            if (qtyToShip <= 0) {
              continue;
            }
            if (item.inventory?.id) {
              await this.alertsService.evaluateStock(Number(item.inventory.id), Number(requisition.destinationWarehouse.id));
            }
          }
        }
      } catch (alertErr) {
        console.error('Error triggering stock evaluation after executeTransferWithAdjustment:', alertErr);
      }

      // Send Telegram notification
      try {
        const fullTransfer = await this.findOne(savedTransfer.id);
        await this.telegramService.sendMessage(
          `🚚 *Transferencia Ajustada en Tránsito*\n` +
          `• *Número:* ${fullTransfer.transfer_number}\n` +
          `• *Origen:* ${fullTransfer.fromWarehouseName}\n` +
          `• *Destino:* ${fullTransfer.toWarehouseName}\n` +
          `• *Despachador:* ${fullTransfer.dispatchedByUserName || 'N/A'}\n` +
          `• *Items:* ${fullTransfer.items?.length || 0} insumos`
        );
      } catch (tgErr) {
        console.error('Failed to send Telegram notification for adjusted transfer dispatch:', tgErr);
      }

      return this.findOne(savedTransfer.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async completeTransfer(id: number, dto: CompleteTransferDto): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transfer = await queryRunner.manager.findOne(InventoryTransfer, {
        where: { id },
        relations: ['fromWarehouse', 'toWarehouse', 'requisition']
      });
      if (!transfer) throw new NotFoundException('La transferencia no existe');
      if (transfer.status !== 'IN_TRANSIT') throw new BadRequestException('La transferencia ya se encuentra procesada');

      const items = await queryRunner.manager.find(InventoryTransferItem, {
        where: { transfer: { id } }
      });

      let user = await queryRunner.manager.findOne(User, { where: { id: dto.userId } });
      if (!user) {
        user = await queryRunner.manager.findOne(User, { order: { id: 'ASC' } });
      }

      for (const item of items) {
        // Stock Area solicitante
        let stockDestino = await queryRunner.manager.findOne(InventoryStock, {
          where: {
            warehouse: { id: Number(transfer.toWarehouse.id) },
            inventory: { id: Number(item.inventory_id) }
          }
        });

        if (!stockDestino) {
          const stockOrigin = await queryRunner.manager.findOne(InventoryStock, {
            where: {
              warehouse: { id: 1 },
              inventory: { id: Number(item.inventory_id) }
            }
          });
          const newStock = new InventoryStock();
          newStock.warehouse = transfer.toWarehouse;
          newStock.inventory = { id: Number(item.inventory_id) } as any;
          newStock.quantity = Number(item.quantity_shipped);
          newStock.minimumStock = Number(stockOrigin?.minimumStock);
          newStock.maximumStock = Number(stockOrigin?.maximumStock);
          newStock.binLocation = 'Ubicación Recibida';
          stockDestino = newStock;
        } else {
          stockDestino.quantity = parseFloat((Number(stockDestino.quantity) + Number(item.quantity_shipped)).toFixed(4));
        }

        await queryRunner.manager.save(stockDestino);

        await this.historyService.recordMovement({
          inventoryId: Number(item.inventory_id),
          warehouseId: Number(transfer.toWarehouse.id),
          movementType: 'TRANSFER_IN',
          quantity: Number(item.quantity_shipped),
          previousStock: Number(stockDestino.quantity) - Number(item.quantity_shipped),
          currentStock: Number(stockDestino.quantity),
          referenceType: 'INVENTORY_TRANSFER',
          referenceId: Number(transfer.id),
          notes: `Transferencia completada ${transfer.transferNumber}`,
        }, queryRunner.manager);

        item.quantity_received = item.quantity_shipped;
        await queryRunner.manager.save(item);
      }

      transfer.status = 'COMPLETED';
      transfer.receivedBy = user || ({ id: 1 } as any);
      transfer.receivedAt = new Date();
      const updatedTransfer = await queryRunner.manager.save(transfer);
      if (transfer.requisition) {
        const reqObj = await queryRunner.manager.findOne(Requisition, {
          where: { id: transfer.requisition.id }
        });
        if (reqObj) {
          reqObj.status = 'COMPLETED';
          await queryRunner.manager.save(reqObj);
        }
      }

      await queryRunner.commitTransaction();

      // Trigger stock evaluation for each item in the completed transfer
      try {
        if (items && items.length > 0) {
          for (const item of items) {
            if (item.inventory_id) {
              await this.alertsService.evaluateStock(Number(item.inventory_id), Number(transfer.fromWarehouse.id));
              await this.alertsService.evaluateStock(Number(item.inventory_id), Number(transfer.toWarehouse.id));
            }
          }
        }
      } catch (alertErr) {
        console.error('Error triggering stock evaluation after completeTransfer:', alertErr);
      }

      // Send Telegram notification
      try {
        const fullTransfer = await this.findOne(updatedTransfer.id);
        await this.telegramService.sendMessage(
          `🏁 *INSUMOS RECIBIDO CON EXITO HA ${fullTransfer.fromWarehouseName}*\n` +
          `• *Número:* ${fullTransfer.transfer_number}\n` +
          `• *Origen:* ${fullTransfer.fromWarehouseName}\n` +
          `• *Destino:* ${fullTransfer.toWarehouseName}\n` +
          `• *Recibido por:* ${fullTransfer.receivedByUserName || 'N/A'}`
        );
      } catch (tgErr) {
        console.error('Failed to send Telegram notification for transfer completion:', tgErr);
      }

      return this.findOne(updatedTransfer.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    const list = await this.dataSource.getRepository(InventoryTransfer).find({
      relations: [
        'fromWarehouse',
        'toWarehouse',
        'dispatchedBy',
        'receivedBy',
        'requisition'
      ],
      order: { dispatchedAt: 'DESC' }
    });

    const result: any[] = [];
    for (const t of list) {
      const items = await this.dataSource.getRepository(InventoryTransferItem).find({
        where: { transfer: { id: t.id } },
        relations: ['inventory']
      });
      result.push(this.mapTransfer(t, items));
    }
    return result;
  }

  async findOne(id: number) {
    const t = await this.dataSource.getRepository(InventoryTransfer).findOne({
      where: { id },
      relations: [
        'fromWarehouse',
        'toWarehouse',
        'dispatchedBy',
        'receivedBy',
        'requisition'
      ]
    });
    if (!t) throw new NotFoundException('Transferencia no encontrada');

    const items = await this.dataSource.getRepository(InventoryTransferItem).find({
      where: { transfer: { id: t.id } },
      relations: ['inventory']
    });

    return this.mapTransfer(t, items);
  }

  private mapTransfer(t: InventoryTransfer, items: InventoryTransferItem[]) {
    return {
      id: Number(t.id),
      transfer_number: t.transferNumber,
      requisition_id: t.requisition?.id ? Number(t.requisition.id) : null,
      from_warehouse_id: t.fromWarehouse?.id ? Number(t.fromWarehouse.id) : null,
      to_warehouse_id: t.toWarehouse?.id ? Number(t.toWarehouse.id) : null,
      status: t.status,
      dispatched_by: t.dispatchedBy?.id ? Number(t.dispatchedBy.id) : null,
      received_by: t.receivedBy?.id ? Number(t.receivedBy.id) : null,
      dispatched_at: t.dispatchedAt,
      received_at: t.receivedAt,
      notes: t.notes,
      fromWarehouseName: t.fromWarehouse?.name || 'Desconocido',
      toWarehouseName: t.toWarehouse?.name || 'Desconocido',
      dispatchedByUserName: t.dispatchedBy?.name || 'Desconocido',
      receivedByUserName: t.receivedBy?.name || 'No Recibido',
      items: items.map(it => ({
        id: Number(it.id),
        transfer_id: Number(t.id),
        inventory_id: Number(it.inventory_id),
        quantity_shipped: Number(it.quantity_shipped),
        quantity_received: Number(it.quantity_received),
        notes: it.notes,
        productName: it.inventory?.name || 'N/A',
        sku: it.inventory?.sku || 'N/A'
      }))
    };
  }
}
