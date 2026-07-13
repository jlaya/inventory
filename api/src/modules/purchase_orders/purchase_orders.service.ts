import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { PurchaseOrder } from './entities/purchase_order.entity';
import { PurchaseOrderDetail } from './entities/purchase_order_detail.entity';
import { PurchaseOrderAttachment } from './entities/purchase_order_attachment.entity';
import { InventoryTransaction } from './entities/inventory_transaction.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Warehouse, WarehouseType } from '../warehouses/entities/warehouse.entity';
import { User } from '../users/entities/user.entity';
import { InventoryStock } from '../inventory_stock/entities/inventory_stock.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { UomConversion } from '../units/entities/uom-conversion.entity';
import { UnitOfMeasure } from '../units/entities/unit.entity';
import { InventoryGateway } from '../inventory/inventory.gateway';
import { CreatePurchaseOrderDto } from './dto/create-purchase_order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase_order.dto';
import { AlertsService } from '../alerts/alerts.service';
import { TelegramService } from '../alerts/telegram.service';
import { HistoryService } from '../history/history.service';
import { Requisition } from '../requisitions/entities/requisition.entity';
import { InventoryTransfer } from '../inventory_transfers/entities/inventory_transfer.entity';
import { InventoryTransferItem } from '../inventory_transfers/entities/inventory_transfer_item.entity';
import * as XLSX from 'xlsx';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly gateway: InventoryGateway,
    @Inject(forwardRef(() => AlertsService))
    private readonly alertsService: AlertsService,
    private readonly telegramService: TelegramService,
    private readonly historyService: HistoryService,
  ) { }

  // Cron job running every hour to check for stock alerts
  @Cron('0 * * * *')
  async handleStockCheckCron() {
    try {
      const suggestions = await this.getSuggestions();
      const criticalCount = suggestions.filter(s => s.deficit > 0).length;
      if (criticalCount > 0) {
        console.log(`[ALERTA STOCK] Se detectaron ${criticalCount} insumos por debajo del stock mínimo en Almacén Central.`);
      }
    } catch (e) {
      console.error('Error running stock check cron', e);
    }
  }

  // Stock Suggestions Alert logic
  async getSuggestions() {
    // Resolve Central Warehouse
    let centralWh = await this.dataSource.getRepository(Warehouse).findOne({
      where: { warehouseType: WarehouseType.CENTRAL }
    });

    if (!centralWh) {
      centralWh = await this.dataSource.getRepository(Warehouse).findOne({
        where: { name: 'Almacén Central' }
      });
    }

    if (!centralWh) {
      // Find first available warehouse
      const warehouses = await this.dataSource.getRepository(Warehouse).find({ take: 1 });
      centralWh = warehouses.length > 0 ? warehouses[0] : null;
    }

    if (!centralWh) {
      return [];
    }

    // Get active inventory items that track inventory
    const activeItems = await this.dataSource.getRepository(Inventory).find({
      where: { is_active: true, tracks_inventory: true },
      relations: ['uom']
    });

    const suggestions: any[] = [];

    for (const item of activeItems) {
      // Find stock in Central Warehouse
      const stock = await this.dataSource.getRepository(InventoryStock).findOne({
        where: {
          warehouse: { id: centralWh.id },
          inventory: { id: item.id }
        }
      });

      const currentStock = stock ? Number(stock.quantity) : 0;
      const minimumStock = stock ? Number(stock.minimumStock) : 0;
      const maximumStock = stock ? Number(stock.maximumStock) : 0;

      if (currentStock < minimumStock) {
        const deficit = minimumStock - currentStock;

        // Suggest ordering to reach minimum (or maximum if defined)
        let suggestedQty = deficit;
        if (maximumStock > minimumStock) {
          suggestedQty = maximumStock - currentStock;
        }

        suggestions.push({
          inventory_id: Number(item.id),
          name: item.name,
          sku: item.sku,
          uom: item.uom?.abbreviation || 'und',
          current_stock: Number(currentStock.toFixed(4)),
          minimum_stock: Number(minimumStock.toFixed(4)),
          maximum_stock: Number(maximumStock.toFixed(4)),
          deficit: Number(deficit.toFixed(4)),
          suggested_quantity: Number(suggestedQty.toFixed(4))
        });
      }
    }

    return suggestions;
  }

  async create(dto: CreatePurchaseOrderDto, file?: Express.Multer.File) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Decode items JSON string
      let parsedItems: Array<{ inventory_id: number; quantity: number; unit_price: number; uom_id?: number }> = [];
      try {
        parsedItems = typeof dto.items === 'string' ? JSON.parse(dto.items) : dto.items;
      } catch (err) {
        throw new BadRequestException('El campo items debe ser un JSON string válido');
      }

      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        throw new BadRequestException('La orden debe tener al menos un insumo');
      }

      // Determine next purchase order number
      const nextIdResult = await queryRunner.manager.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM purchase_orders');
      const nextId = Number(nextIdResult[0].next_id);
      const poNum = `OC-${nextId.toString().padStart(4, '0')}`;

      // Resolve creator user
      const creatorId = dto.created_by ? Number(dto.created_by) : 1;
      const creator = await queryRunner.manager.findOne(User, { where: { id: creatorId } });

      let requisitionObj: { id: number } | null = null;
      if (dto.requisition_id) {
        const reqId = Number(dto.requisition_id);
        const reqExists = await queryRunner.manager.query('SELECT id FROM requisitions WHERE id = $1', [reqId]);
        if (reqExists && reqExists.length > 0) {
          requisitionObj = { id: reqId };
        }
      }

      // Resolve Supplier
      let supplier: Supplier | null = null;
      if (dto.supplier_id) {
        supplier = await queryRunner.manager.findOne(Supplier, { where: { id: Number(dto.supplier_id) } });
      }

      // Initialize PurchaseOrder
      const po = new PurchaseOrder();
      po.purchaseOrderNumber = poNum;
      po.supplier = supplier;
      po.supplierName = supplier ? supplier.name : (dto.supplier_name || 'Proveedor por asignar');
      po.requisition = requisitionObj as any;
      po.status = 'ISSUED'; // Default to ISSUED (Emitida/Enviada)
      po.notes = dto.notes || null;
      po.createdBy = creator;
      po.totalAmount = 0;

      const savedPo = await queryRunner.manager.save(po);

      let computedTotal = 0;
      const poDetails: PurchaseOrderDetail[] = [];

      for (const item of parsedItems) {
        const product = await queryRunner.manager.findOne(Inventory, { where: { id: item.inventory_id }, relations: ['uom'] });
        if (!product) {
          throw new NotFoundException(`Insumo con ID ${item.inventory_id} no encontrado`);
        }

        let purchaseUom: UnitOfMeasure | null = null;
        if (item.uom_id) {
          purchaseUom = await queryRunner.manager.findOne(UnitOfMeasure, { where: { id: item.uom_id } });
        }

        const quantity = parseFloat(item.quantity as any) || 0;
        const unitPrice = parseFloat(item.unit_price as any) || 0;
        const totalPrice = quantity * unitPrice;
        computedTotal += totalPrice;

        const detail = new PurchaseOrderDetail();
        detail.purchaseOrder = savedPo;
        detail.inventory = product;
        detail.uom = purchaseUom;
        detail.quantity = quantity;
        detail.quantityReceived = 0;
        detail.unitPrice = unitPrice;
        detail.totalPrice = totalPrice;

        const savedDetail = await queryRunner.manager.save(detail);
        poDetails.push(savedDetail);
      }

      // Update total amount of the purchase order
      savedPo.totalAmount = computedTotal;
      savedPo.items = poDetails;
      await queryRunner.manager.save(savedPo);

      // Handle file attachment
      if (file) {
        const attachment = new PurchaseOrderAttachment();
        attachment.purchaseOrder = savedPo;
        attachment.fileName = file.originalname;
        attachment.filePath = `/uploads/${file.filename}`;
        attachment.mimeType = file.mimetype;
        await queryRunner.manager.save(attachment);
      }

      await queryRunner.commitTransaction();

      // Emit WebSocket Notification
      this.emitEvent('purchase_order_created', {
        id: Number(savedPo.id),
        purchase_order_number: savedPo.purchaseOrderNumber,
        supplier_name: savedPo.supplierName,
        total_amount: savedPo.totalAmount,
        status: savedPo.status,
      });

      // Send Telegram notification
      try {
        const fullPo = await this.findOne(savedPo.id);
        const poNum = fullPo.purchase_order_number;
        const supplierName = fullPo.supplier_name;
        const amount = fullPo.total_amount;
        const creatorName = fullPo.created_by_user_name;
        const itemsCount = fullPo.items?.length || 0;

        await this.telegramService.sendMessage(
          `🛒 *Nueva Orden de Compra Registrada*\n` +
          `• *Número:* ${poNum}\n` +
          `• *Proveedor:* ${supplierName}\n` +
          `• *Monto Total:* $${amount.toFixed(2)}\n` +
          `• *Creado por:* ${creatorName}\n` +
          `• *Items:* ${itemsCount} productos`
        );
      } catch (tgErr) {
        console.error('Failed to send Telegram notification for purchase order creation:', tgErr);
      }

      return this.findOne(savedPo.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    const pos = await this.dataSource.getRepository(PurchaseOrder).find({
      relations: [
        'requisition',
        'requisition.sourceWarehouse',
        'requisition.destinationWarehouse',
        'createdBy',
        'items',
        'items.inventory',
        'items.inventory.uom',
        'items.uom',
        'attachments',
        'supplier'
      ],
      order: { createdAt: 'DESC' }
    });
    return pos.map(p => this.mapPurchaseOrder(p));
  }

  async findOne(id: number) {
    const po = await this.dataSource.getRepository(PurchaseOrder).findOne({
      where: { id },
      relations: [
        'requisition',
        'requisition.sourceWarehouse',
        'requisition.destinationWarehouse',
        'createdBy',
        'items',
        'items.inventory',
        'items.inventory.uom',
        'items.uom',
        'attachments',
        'supplier'
      ]
    });
    if (!po) throw new NotFoundException('Orden de compra no encontrada');
    return this.mapPurchaseOrder(po);
  }

  async update(id: number, dto: UpdatePurchaseOrderDto) {
    const po = await this.dataSource.getRepository(PurchaseOrder).findOne({ where: { id } });
    if (!po) throw new NotFoundException('Orden de compra no encontrada');

    if (dto.supplier_name !== undefined) po.supplierName = dto.supplier_name;
    if (dto.notes !== undefined) po.notes = dto.notes;
    if (dto.status !== undefined) po.status = dto.status;
    if (dto.supplier_id !== undefined) {
      if (dto.supplier_id) {
        const supplier = await this.dataSource.getRepository(Supplier).findOne({ where: { id: Number(dto.supplier_id) } });
        if (supplier) {
          po.supplier = supplier;
          po.supplierName = supplier.name;
        }
      } else {
        po.supplier = null;
      }
    }

    const saved = await this.dataSource.getRepository(PurchaseOrder).save(po);

    this.emitEvent('purchase_order_updated', {
      id: Number(saved.id),
      purchase_order_number: saved.purchaseOrderNumber,
      status: saved.status,
    });

    const result = await this.findOne(Number(saved.id));

    // Send Telegram notification
    try {
      await this.telegramService.sendMessage(
        `🔄 *Orden de Compra Actualizada*\n` +
        `• *Número:* ${result.purchase_order_number}\n` +
        `• *Nuevo Estado:* ${result.status}\n` +
        `• *Proveedor:* ${result.supplier_name}`
      );
    } catch (tgErr) {
      console.error('Failed to send Telegram notification for purchase order update:', tgErr);
    }

    return result;
  }

  async receive(
    id: number,
    receivedByUserId?: number,
    closeOrder?: boolean,
    receivedItems?: Array<{ detailId: number; quantityReceived: number }>
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let excelBuffer: Buffer | null = null;

    try {
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id },
        relations: ['items', 'items.inventory', 'items.inventory.uom', 'items.uom', 'requisition']
      });

      if (!po) throw new NotFoundException('Orden de compra no encontrada');
      if (po.status === 'RECEIVED' || po.status === 'COMPLETED') {
        throw new BadRequestException('Esta orden de compra ya ha sido recibida y procesada por completo');
      }

      // Resolve the receiving user
      const receiverId = receivedByUserId ? Number(receivedByUserId) : 1;
      const receiver = await queryRunner.manager.findOne(User, { where: { id: receiverId } });

      // Resolve the Almacén Central warehouse
      const centralWh = await queryRunner.manager.findOne(Warehouse, {
        where: { code: 'WH-CENTRAL' }
      });

      if (!centralWh) {
        throw new BadRequestException('No se encontró ningún almacén en el sistema para registrar el stock');
      }

      // Process items receipt
      if (receivedItems && Array.isArray(receivedItems) && receivedItems.length > 0) {
        // ITEM-BY-ITEM DETAILED RECEIPT FLOW
        for (const receipt of receivedItems) {
          const detail = po.items.find(it => Number(it.id) === Number(receipt.detailId));
          if (!detail) {
            throw new BadRequestException(`El item con ID ${receipt.detailId} no pertenece a esta orden de compra`);
          }

          const qtyToReceive = parseFloat(receipt.quantityReceived as any) || 0;
          if (qtyToReceive <= 0) continue;

          // Resolve UOM Conversion Factor
          let factor = 1.0000;
          const purchaseUom = detail.uom;
          const inventoryUom = detail.inventory.uom;

          if (purchaseUom && inventoryUom && purchaseUom.id !== inventoryUom.id) {
            const conversion = await queryRunner.manager.findOne(UomConversion, {
              where: {
                inventory: { id: detail.inventory.id },
                fromUom: { id: purchaseUom.id },
                toUom: { id: inventoryUom.id }
              }
            });

            if (conversion) {
              factor = Number(conversion.factor);
            }
          }

          // Converted quantity to base unit (recipe unit)
          const convertedQuantity = qtyToReceive * factor;

          // Find or create InventoryStock record in Central Warehouse
          let stockRecord = await queryRunner.manager.findOne(InventoryStock, {
            where: {
              warehouse: { id: centralWh.id },
              inventory: { id: detail.inventory.id }
            }
          });

          if (stockRecord) {
            stockRecord.quantity = Number(stockRecord.quantity) + convertedQuantity;
            await queryRunner.manager.save(stockRecord);
          } else {
            stockRecord = new InventoryStock();
            stockRecord.warehouse = centralWh;
            stockRecord.inventory = detail.inventory;
            stockRecord.quantity = convertedQuantity;
            stockRecord.minimumStock = 0;
            stockRecord.binLocation = 'Estantería General';
            await queryRunner.manager.save(stockRecord);
          }

          await this.historyService.recordMovement({
            inventoryId: Number(detail.inventory.id),
            warehouseId: Number(centralWh.id),
            movementType: 'INPUT',
            quantity: convertedQuantity,
            previousStock: stockRecord.quantity - convertedQuantity,
            currentStock: stockRecord.quantity,
            referenceType: 'PURCHASE_ORDER',
            referenceId: Number(po.id),
            notes: po.notes || `Recepción de item en orden de compra ${po.purchaseOrderNumber}`,
          }, queryRunner.manager);

          // Log InventoryTransaction (using converted quantity)
          const transaction = new InventoryTransaction();
          transaction.inventory = detail.inventory;
          transaction.warehouse = centralWh;
          transaction.transactionType = 'IN';
          transaction.quantity = convertedQuantity;
          transaction.referenceType = 'PURCHASE_ORDER';
          transaction.referenceId = Number(po.id);
          transaction.createdBy = receiver;
          await queryRunner.manager.save(transaction);

          // Update supplier last purchase cost in catalog if linked
          if (po.supplier) {
            await queryRunner.manager.query(
              `UPDATE supplier_catalog SET last_purchase_cost = $1, updated_at = NOW()
               WHERE supplier_id = $2 AND inventory_id = $3`,
              [detail.unitPrice, po.supplier.id, detail.inventory.id]
            );
          }

          // Update received qty in details
          detail.quantityReceived = Number(detail.quantityReceived || 0) + qtyToReceive;
          await queryRunner.manager.save(detail);
        }
      } else {
        // LEGACY EN-MASSE FULL RECEIVE FLOW
        for (const detail of po.items) {
          const remainingQty = Number(detail.quantity) - Number(detail.quantityReceived || 0);
          if (remainingQty <= 0) continue;

          let factor = 1.0000;
          const purchaseUom = detail.uom;
          const inventoryUom = detail.inventory.uom;

          if (purchaseUom && inventoryUom && purchaseUom.id !== inventoryUom.id) {
            const conversion = await queryRunner.manager.findOne(UomConversion, {
              where: {
                inventory: { id: detail.inventory.id },
                fromUom: { id: purchaseUom.id },
                toUom: { id: inventoryUom.id }
              }
            });
            if (conversion) {
              factor = Number(conversion.factor);
            }
          }

          const convertedQuantity = remainingQty * factor;

          let stockRecord = await queryRunner.manager.findOne(InventoryStock, {
            where: {
              warehouse: { id: centralWh.id },
              inventory: { id: detail.inventory.id }
            }
          });

          if (stockRecord) {
            stockRecord.quantity = Number(stockRecord.quantity) + convertedQuantity;
            await queryRunner.manager.save(stockRecord);
          } else {
            stockRecord = new InventoryStock();
            stockRecord.warehouse = centralWh;
            stockRecord.inventory = detail.inventory;
            stockRecord.quantity = convertedQuantity;
            stockRecord.minimumStock = 0;
            stockRecord.binLocation = 'Estantería General';
            await queryRunner.manager.save(stockRecord);
          }

          await this.historyService.recordMovement({
            inventoryId: Number(detail.inventory.id),
            warehouseId: Number(centralWh.id),
            movementType: 'INPUT',
            quantity: convertedQuantity,
            previousStock: stockRecord.quantity - convertedQuantity,
            currentStock: stockRecord.quantity,
            referenceType: 'PURCHASE_ORDER',
            referenceId: Number(po.id),
            notes: po.notes || `Recepción total en orden de compra ${po.purchaseOrderNumber}`,
          }, queryRunner.manager);

          const transaction = new InventoryTransaction();
          transaction.inventory = detail.inventory;
          transaction.warehouse = centralWh;
          transaction.transactionType = 'IN';
          transaction.quantity = convertedQuantity;
          transaction.referenceType = 'PURCHASE_ORDER';
          transaction.referenceId = Number(po.id);
          transaction.createdBy = receiver;
          await queryRunner.manager.save(transaction);

          if (po.supplier) {
            await queryRunner.manager.query(
              `UPDATE supplier_catalog SET last_purchase_cost = $1, updated_at = NOW()
               WHERE supplier_id = $2 AND inventory_id = $3`,
              [detail.unitPrice, po.supplier.id, detail.inventory.id]
            );
          }

          detail.quantityReceived = Number(detail.quantity);
          await queryRunner.manager.save(detail);
        }
      }

      // Check if order is fully completed
      const freshPo = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id },
        relations: ['items']
      });

      if (!freshPo) {
        throw new NotFoundException('Orden de compra no encontrada en la transacción');
      }

      let isFullyReceived = true;
      for (const item of freshPo.items) {
        if (Number(item.quantityReceived) < Number(item.quantity)) {
          isFullyReceived = false;
          break;
        }
      }

      if (isFullyReceived || closeOrder === true) {
        po.status = 'COMPLETED'; // Equivalente a RECEIVED
      } else {
        po.status = 'PARTIAL'; // Recepción parcial
      }

      await queryRunner.manager.save(po);

      // If the PO was linked to a requisition, and it's now completed, we auto-execute the transfer
      if (po.requisition && po.status === 'COMPLETED') {
        const requisition = await queryRunner.manager.findOne(Requisition, {
          where: { id: po.requisition.id },
          relations: ['sourceWarehouse', 'destinationWarehouse', 'items', 'items.inventory', 'items.inventory.uom']
        });

        if (requisition && requisition.status === 'PENDING') {
          // Determine next transfer number
          const nextIdResult = await queryRunner.manager.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM inventory_transfers');
          const nextId = Number(nextIdResult[0].next_id);
          const transferNumber = `TRA-${nextId.toString().padStart(4, '0')}`;

          const transfer = new InventoryTransfer();
          transfer.transferNumber = transferNumber;
          transfer.fromWarehouse = requisition.destinationWarehouse;
          transfer.toWarehouse = requisition.sourceWarehouse;
          transfer.requisition = requisition;
          transfer.dispatchedBy = receiver || ({ id: 1 } as any);
          transfer.status = 'COMPLETED';
          transfer.notes = `Despacho automático por recepción de Orden de Compra ${po.purchaseOrderNumber}`;

          const savedTransfer = await queryRunner.manager.save(transfer);

          const dispatchedItemsForExcel: any[] = [];

          for (const reqItem of requisition.items) {
            const qty = Number(reqItem.requestedQuantity || reqItem['requested_quantity'] || 0);
            if (qty <= 0) continue;

            const stockOrigen = await queryRunner.manager.findOne(InventoryStock, {
              where: {
                warehouse: { id: Number(requisition.destinationWarehouse.id) },
                inventory: { id: Number(reqItem.inventory.id) }
              },
              lock: { mode: 'pessimistic_write' }
            });

            if (stockOrigen) {
              const newQty = Number(stockOrigen.quantity) - qty;
              stockOrigen.quantity = parseFloat((Math.max(0, newQty)).toFixed(4));
              await queryRunner.manager.save(stockOrigen);

              await this.historyService.recordMovement({
                inventoryId: Number(reqItem.inventory.id),
                warehouseId: Number(requisition.destinationWarehouse.id),
                movementType: 'TRANSFER_OUT',
                quantity: qty,
                previousStock: stockOrigen.quantity + qty,
                currentStock: stockOrigen.quantity,
                referenceType: 'INVENTORY_TRANSFER',
                referenceId: Number(savedTransfer.id),
                notes: `Despacho automático por llegada de OC ${po.purchaseOrderNumber}`,
              }, queryRunner.manager);
            }

            /**
             * Almacen Principal
             */
            const stockOrigin = await queryRunner.manager.findOne(InventoryStock, {
              where: {
                warehouse: { id: 1 },
                inventory: { id: Number(reqItem.inventory.id) }
              }
            });

            if (stockOrigin) {
              stockOrigin.quantity = parseFloat((Number(stockOrigin.quantity) - qty).toFixed(4));
              await queryRunner.manager.save(stockOrigin);
            }

            // Ingreso al almacen de destino (Área Solicitante)
            let stockDestino = await queryRunner.manager.findOne(InventoryStock, {
              where: {
                warehouse: { id: Number(requisition.sourceWarehouse.id) },
                inventory: { id: Number(reqItem.inventory.id) }
              }
            });

            if (!stockDestino) {
              const newStock = new InventoryStock();
              newStock.warehouse = { id: Number(requisition.sourceWarehouse.id) } as any;
              newStock.inventory = { id: Number(reqItem.inventory.id) } as any;
              newStock.quantity = qty;
              newStock.minimumStock = Number(stockOrigin?.minimumStock || 0);
              newStock.maximumStock = Number(stockOrigin?.maximumStock || 0);
              newStock.projectedDailyDemand = Number(stockOrigin?.projectedDailyDemand || 0);
              newStock.projectedWeeklyDemand = Number(stockOrigin?.projectedWeeklyDemand || 0);
              newStock.projectedProduction = Number(stockOrigin?.projectedProduction || 0);
              newStock.binLocation = 'Ubicación Recibida';
              stockDestino = newStock;
            } else {
              stockDestino.quantity = parseFloat((Number(stockDestino.quantity) + qty).toFixed(4));
            }

            await queryRunner.manager.save(stockDestino);

            await this.historyService.recordMovement({
              inventoryId: Number(reqItem.inventory.id),
              warehouseId: Number(requisition.sourceWarehouse.id),
              movementType: 'TRANSFER_IN',
              quantity: qty,
              previousStock: Number(stockDestino.quantity) - qty,
              currentStock: Number(stockDestino.quantity),
              referenceType: 'INVENTORY_TRANSFER',
              referenceId: Number(savedTransfer.id),
              notes: `Despacho automático por llegada de OC ${po.purchaseOrderNumber}`,
            }, queryRunner.manager);

            const transferItem = new InventoryTransferItem();
            transferItem.transfer = savedTransfer;
            transferItem.inventory_id = Number(reqItem.inventory.id);
            transferItem.quantity_shipped = qty;
            transferItem.quantity_received = qty;
            transferItem.notes = reqItem.notes || null;

            await queryRunner.manager.save(transferItem);

            dispatchedItemsForExcel.push({
              name: reqItem.inventory.name,
              sku: reqItem.inventory.sku,
              qty: qty,
              uom: reqItem.customUom || reqItem.inventory.uom?.abbreviation || 'und',
              sourceWarehouse: requisition.destinationWarehouse.name,
              targetWarehouse: requisition.sourceWarehouse.name,
              requisitionNumber: requisition.requisitionNumber,
              transferNumber: transferNumber
            });
          }

          requisition.status = 'COMPLETED';
          requisition.approvedBy = receiver || ({ id: 1 } as any);
          await queryRunner.manager.save(requisition);

          console.log(`[AUTO-DESPACHO] Requisición ${requisition.requisitionNumber} aprobada y transferencia ${transferNumber} generada.`);

          // Generate Excel with the dispatched items
          if (dispatchedItemsForExcel.length > 0) {
            const headers = [
              'Insumo',
              'SKU',
              'Cantidad Despachada',
              'Unidad',
              'Almacén de Origen',
              'Almacén Solicitante',
              'Nro. Requisición',
              'Nro. Transferencia'
            ];

            const dataRows = dispatchedItemsForExcel.map(item => ({
              'Insumo': item.name,
              'SKU': item.sku,
              'Cantidad Despachada': item.qty,
              'Unidad': item.uom,
              'Almacén de Origen': item.sourceWarehouse,
              'Almacén Solicitante': item.targetWarehouse,
              'Nro. Requisición': item.requisitionNumber,
              'Nro. Transferencia': item.transferNumber
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: headers });
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Insumos Despachados');
            excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
          }
        }
      }

      await queryRunner.commitTransaction();

      // Trigger stock evaluation for each item received
      try {
        if (po.items && po.items.length > 0) {
          for (const detail of po.items) {
            if (detail.inventory?.id) {
              await this.alertsService.evaluateStock(Number(detail.inventory.id), Number(centralWh.id));
            }
          }
        }
      } catch (alertErr) {
        console.error('Error triggering stock evaluation after PO receipt:', alertErr);
      }

      // Emit event
      this.emitEvent('purchase_order_received', {
        id: Number(po.id),
        purchase_order_number: po.purchaseOrderNumber,
        status: po.status,
      });

      const result = await this.findOne(po.id);

      // Send Telegram notification
      try {
        const messageText =
          `📥 *Recepción de Orden de Compra*\n` +
          `• *Número:* ${result.purchase_order_number}\n` +
          `• *Proveedor:* ${result.supplier_name}\n` +
          `• *Estado Final:* ${result.status}\n` +
          `• *Recibido por:* ${result.created_by_user_name || 'Sistema'}`;

        if (excelBuffer) {
          const filename = `insumos_despachados_${result.purchase_order_number}.xlsx`;
          await this.telegramService.sendDocument(excelBuffer, filename, messageText);
        } else {
          await this.telegramService.sendMessage(messageText);
        }
      } catch (tgErr) {
        console.error('Failed to send Telegram notification for purchase order receipt:', tgErr);
      }

      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private emitEvent(eventName: string, payload: any) {
    try {
      if (this.gateway && this.gateway.server) {
        this.gateway.server.emit(eventName, payload);
      }
    } catch (e) {
      console.error(`Error emitting WS event ${eventName}`, e);
    }
  }

  private mapPurchaseOrder(po: PurchaseOrder) {
    return {
      id: Number(po.id),
      purchase_order_number: po.purchaseOrderNumber,
      requisition_id: po.requisition?.id ? Number(po.requisition.id) : null,
      requisition_number: po.requisition?.requisitionNumber || null,
      source_warehouse_name: po.requisition?.destinationWarehouse?.name || null,
      destination_warehouse_name: po.requisition?.sourceWarehouse?.name || null,
      supplier_id: po.supplier?.id ? Number(po.supplier.id) : null,
      supplier_name: po.supplierName,
      status: po.status,
      total_amount: Number(po.totalAmount),
      notes: po.notes,
      created_by: po.createdBy?.id ? Number(po.createdBy.id) : null,
      created_by_user_name: po.createdBy?.name || 'Sistema',
      created_at: po.createdAt,
      updated_at: po.updatedAt,
      items: po.items?.map(it => ({
        id: Number(it.id),
        inventory_id: it.inventory?.id ? Number(it.inventory.id) : null,
        productName: it.inventory?.name || 'N/A',
        sku: it.inventory?.sku || 'N/A',
        uom_id: it.uom?.id ? Number(it.uom.id) : null,
        uomAbbrev: it.uom?.abbreviation || it.inventory?.uom?.abbreviation || 'und',
        quantity: Number(it.quantity),
        quantity_received: Number(it.quantityReceived || 0),
        unit_price: Number(it.unitPrice),
        total_price: Number(it.totalPrice),
      })) || [],
      attachments: po.attachments?.map(at => ({
        id: Number(at.id),
        fileName: at.fileName,
        filePath: at.filePath,
        mimeType: at.mimeType,
        uploadedAt: at.uploadedAt,
      })) || []
    };
  }
}
