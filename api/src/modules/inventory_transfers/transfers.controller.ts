import { Controller, Post, Body, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryTransfersService } from './inventory_transfers.service';
import { Requisition } from '../requisitions/entities/requisition.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

@Controller('transfers')
export class TransfersController {
  constructor(
    private readonly transfersService: InventoryTransfersService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Post('execute')
  async executeRequisitionTransfer(
    @Body() body: { requisition_id: number; dispatched_by: number },
  ) {
    const requisition = await this.dataSource.getRepository(Requisition).findOne({
      where: { id: body.requisition_id },
      relations: ['sourceWarehouse', 'destinationWarehouse', 'items', 'items.inventory'],
    });

    if (!requisition) {
      throw new NotFoundException('Requisición no encontrada');
    }

    // Determine transfer items: prefer Excel file if available
    let transferItems = requisition.items.map((it) => ({
      inventoryId: Number(it.inventory.id),
      quantityShipped: Number(it.requestedQuantity || it['requested_quantity'] || 0),
      notes: it.notes || 'Reabastecimiento de insumos',
    }));

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
          if (rows && rows.length) {
            transferItems = rows.map((row) => {
              let id = 0;
              let cantidad = 0;
              let insumo = '';
              for (const key of Object.keys(row)) {
                const k = key.toLowerCase().trim();
                if (k === 'id') {
                  id = Number(row[key]);
                } else if (k === 'cantidad' || k === 'quantity' || k === 'cantidad_enviada' || k === 'requested_quantity') {
                  cantidad = Number(row[key]);
                } else if (k === 'insumo' || k === 'nombre' || k === 'sku') {
                  insumo = String(row[key]).trim();
                }
              }
              return {
                inventoryId: id,
                quantityShipped: cantidad,
                notes: insumo || 'Reabastecimiento de insumos',
              };
            });
          }
        }
      } catch (e) {
        // If Excel parsing fails, fallback to default items
        console.error('Error leyendo Excel de requisición:', e);
      }
    }

    transferItems = transferItems.filter(
      (item) => item.inventoryId > 0 && item.quantityShipped > 0,
    );

    const createTransferDto: CreateTransferDto = {
      fromWarehouseId: Number(requisition.destinationWarehouse.id),
      toWarehouseId: Number(requisition.sourceWarehouse.id),
      requisitionId: Number(requisition.id),
      userId: body.dispatched_by || 1,
      notes: requisition.notes || `Ejecutado de requisición ${requisition.requisitionNumber}`,
      items: transferItems,
    };

    return this.transfersService.executeTransfer(createTransferDto);
  }

  @Post('resolve-adjustment')
  async resolveAdjustment(
    @Body() body: { requisition_id: number; dispatched_by: number; adjustments: { inventoryId: number; adjustedQuantity: number }[] }
  ) {
    return this.transfersService.executeTransferWithAdjustment(
      Number(body.requisition_id),
      Number(body.dispatched_by || 1),
      body.adjustments
    );
  }
}
