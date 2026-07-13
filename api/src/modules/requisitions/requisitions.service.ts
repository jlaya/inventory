import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Requisition } from './entities/requisition.entity';
import { RequisitionDetail } from '../requisition_details/entities/requisition_detail.entity';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { User } from '../users/entities/user.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryGateway } from '../inventory/inventory.gateway';
import * as XLSX from 'xlsx';
import { join } from 'path';
import * as fs from 'fs';
import { TelegramService } from '../alerts/telegram.service';

@Injectable()
export class RequisitionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly gateway: InventoryGateway,
    private readonly telegramService: TelegramService,
  ) { }

  async create(dto: CreateRequisitionDto, excelPath?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Fetch source and destination warehouses
      const source = await queryRunner.manager.findOne(Warehouse, { where: { id: dto.source_warehouse_id } });
      const dest = await queryRunner.manager.findOne(Warehouse, { where: { id: dto.destination_warehouse_id } });
      if (!source || !dest) throw new NotFoundException('Almacén no encontrado');

      // Fetch requester user
      const requester = await queryRunner.manager.findOne(User, { where: { id: dto.requested_by || 1 } });

      // Determine next requisition number
      const nextIdResult = await queryRunner.manager.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM requisitions');
      const nextId = Number(nextIdResult[0].next_id);
      const reqNum = `REQ-${nextId.toString().padStart(4, '0')}`;

      // Generate Excel file with requested items
      const rows: { id: number; insumo: string; cantidad: number }[] = [];
      for (const it of dto.items) {
        const prod = await queryRunner.manager.findOne(Inventory, { where: { id: it.inventory_id } });
        if (!prod) throw new NotFoundException(`Insumo ID ${it.inventory_id} no encontrado`);
        rows.push({ id: it.inventory_id, insumo: prod.name, cantidad: Number(it.requested_quantity || it['requestedQuantity'] || 0) });
      }
      const uploadsDir = join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const excelFileName = `requisition_${Date.now()}.xlsx`;
      const excelFilePath = join(uploadsDir, excelFileName);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Requisition');
      XLSX.writeFile(wb, excelFilePath);
      // Set excelPath for later use and download URL
      excelPath = `/uploads/${excelFileName}`;

      const requisition = new Requisition();
      requisition.requisitionNumber = reqNum;
      requisition.sourceWarehouse = source;
      requisition.destinationWarehouse = dest;
      requisition.requestedBy = requester || ({ id: 1 } as any);
      requisition.notes = dto.notes || null;
      requisition.status = 'PENDING';
      requisition.excelPath = excelPath || null;

      const savedReq = await queryRunner.manager.save(requisition);

      for (const item of dto.items) {
        const product = await queryRunner.manager.findOne(Inventory, { where: { id: item.inventory_id } });
        if (!product) throw new NotFoundException(`Insumo ID ${item.inventory_id} no encontrado`);

        const detail = new RequisitionDetail();
        detail.requisition = savedReq;
        detail.inventory = product;
        detail.requestedQuantity = Number(item.requested_quantity || item['requestedQuantity'] || 0);
        detail.approvedQuantity = 0;
        detail.notes = item.notes === undefined ? null : item.notes;
        detail.customUom = item.custom_uom || null;

        await queryRunner.manager.save(detail);
      }

      await queryRunner.commitTransaction();

      // Emit real-time WebSocket event
      try {
        if (this.gateway && this.gateway.server) {
          const excelDownloadUrl = excelPath ? `/uploads/${excelPath.replace(/\\/g, '/').split('/').pop()}` : null;
          this.gateway.server.emit('requisition_created', {
            id: Number(savedReq.id),
            requisition_number: savedReq.requisitionNumber,
            fecha_hora: savedReq.createdAt ? savedReq.createdAt.toISOString() : new Date().toISOString(),
            origen: source.name,
            destino: dest.name,
            notas: dto.notes || null,
            excel_url: excelDownloadUrl
          });
        }
      } catch (wsErr) {
        console.error('Failed to emit WebSocket event', wsErr);
      }

      // Send Telegram notification
      try {
        const fullReq = await this.findOne(savedReq.id);
        const sourceName = fullReq.sourceWarehouseName;
        const destName = fullReq.destinationWarehouseName;
        const requestedByName = fullReq.requestedByUserName;
        const itemsCount = fullReq.items?.length || 0;

        await this.telegramService.sendMessage(
          `📝 *REQUISICION ENVIADA A ALMACEN CENTRAL*\n` +
          `• *Número:* ${fullReq.requisition_number}\n` +
          `• *Origen:* ${sourceName}\n` +
          `• *Destino:* ${destName}\n` +
          `• *Solicitado por:* ${requestedByName}\n` +
          `• *Detalles:* ${itemsCount} insumos`
        );
      } catch (tgErr) {
        console.error('Failed to send Telegram notification for requisition creation:', tgErr);
      }

      return this.findOne(savedReq.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async createFromExcel(file: Express.Multer.File, dto: any) {
    if (!file) throw new Error('No se adjuntó ningún archivo de Excel');

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as any[];

    const items: any[] = [];

    for (const row of rows) {
      let id: any = null;
      let insumo: string = '';
      let cantidad: number = 0;

      for (const key of Object.keys(row)) {
        const k = key.toLowerCase().trim();
        if (k === 'id') {
          id = row[key];
        } else if (k === 'insumo' || k === 'nombre' || k === 'sku') {
          insumo = String(row[key]).trim();
        } else if (k === 'cantidad' || k === 'quantity') {
          cantidad = Number(row[key]);
        }
      }

      if (!cantidad || cantidad <= 0) continue;

      let matchedInventoryId: number | null = null;

      // 1. Match by ID
      if (id && !isNaN(Number(id))) {
        const prod = await this.dataSource.getRepository(Inventory).findOne({ where: { id: Number(id) } });
        if (prod) matchedInventoryId = Number(prod.id);
      }

      // 2. Match by SKU
      if (!matchedInventoryId && insumo) {
        const prod = await this.dataSource.getRepository(Inventory).findOne({ where: { sku: insumo } });
        if (prod) matchedInventoryId = Number(prod.id);
      }

      // 3. Match by Name
      if (!matchedInventoryId && insumo) {
        const prod = await this.dataSource.getRepository(Inventory).findOne({ where: { name: insumo } });
        if (prod) matchedInventoryId = Number(prod.id);
      }

      if (matchedInventoryId) {
        items.push({
          inventory_id: matchedInventoryId,
          requested_quantity: cantidad,
          notes: insumo ? `Excel: ${insumo}` : 'Excel'
        });
      }
    }

    if (items.length === 0) {
      throw new Error('No se encontraron insumos válidos en el archivo Excel');
    }

    const createDto: CreateRequisitionDto = {
      source_warehouse_id: Number(dto.source_warehouse_id),
      destination_warehouse_id: Number(dto.destination_warehouse_id),
      requested_by: dto.requested_by ? Number(dto.requested_by) : 1,
      notes: dto.notes || 'Requisición cargada desde archivo Excel',
      items
    };

    return this.create(createDto, file.path);
  }

  async findAll() {
    const reqs = await this.dataSource.getRepository(Requisition).find({
      relations: [
        'sourceWarehouse',
        'destinationWarehouse',
        'requestedBy',
        'approvedBy',
        'items',
        'items.inventory',
        'items.inventory.uom'
      ],
      order: { createdAt: 'DESC' }
    });

    return reqs.map(r => this.mapRequisition(r));
  }

  async findAllByStatus(status: Requisition['status']) {
    const reqs = await this.dataSource.getRepository(Requisition).find({
      where: { status: status as any },
      relations: [
        'sourceWarehouse',
        'destinationWarehouse',
        'requestedBy',
        'approvedBy',
        'items',
        'items.inventory',
        'items.inventory.uom'
      ],
      order: { createdAt: 'DESC' }
    });
    return reqs.map(r => this.mapRequisition(r));
  }

  async findOne(id: number) {
    const req = await this.dataSource.getRepository(Requisition).findOne({
      where: { id },
      relations: [
        'sourceWarehouse',
        'destinationWarehouse',
        'requestedBy',
        'approvedBy',
        'items',
        'items.inventory',
        'items.inventory.uom'
      ]
    });

    if (!req) throw new NotFoundException('Requisición no encontrada');
    return this.mapRequisition(req);
  }

  async update(id: number, dto: any) {
    const req = await this.dataSource.getRepository(Requisition).findOne({ where: { id } });
    if (!req) throw new NotFoundException('Requisición no encontrada');

    if (dto.status !== undefined) req.status = dto.status;
    if (dto.notes !== undefined) req.notes = dto.notes || null;
    if (dto.approved_by !== undefined) {
      req.approvedBy = dto.approved_by ? ({ id: Number(dto.approved_by) } as any) : null;
    }

    const saved = await this.dataSource.getRepository(Requisition).save(req);
    const result = await this.findOne(Number(saved.id));

    // Send Telegram notification
    try {
      await this.telegramService.sendMessage(
        `🔄 *Requisición Actualizada*\n` +
        `• *Número:* ${result.requisition_number}\n` +
        `• *Nuevo Estado:* ${result.status}\n` +
        `• *Aprobado por:* ${result.approvedByUserName || 'Pendiente'}`
      );
    } catch (tgErr) {
      console.error('Failed to send Telegram notification for requisition update:', tgErr);
    }

    return result;
  }

  async remove(id: number) {
    const req = await this.dataSource.getRepository(Requisition).findOne({ where: { id } });
    if (!req) throw new NotFoundException('Requisición no encontrada');
    await this.dataSource.getRepository(Requisition).remove(req);

    // Send Telegram notification
    try {
      await this.telegramService.sendMessage(
        `🗑️ *Requisición Eliminada*\n` +
        `• *Número:* ${req.requisitionNumber}`
      );
    } catch (tgErr) {
      console.error('Failed to send Telegram notification for requisition removal:', tgErr);
    }

    return { success: true };
  }

  private mapRequisition(req: Requisition) {
    return {
      id: Number(req.id),
      requisition_number: req.requisitionNumber,
      source_warehouse_id: req.sourceWarehouse?.id ? Number(req.sourceWarehouse.id) : null,
      destination_warehouse_id: req.destinationWarehouse?.id ? Number(req.destinationWarehouse.id) : null,
      status: req.status,
      requested_by: req.requestedBy?.id ? Number(req.requestedBy.id) : null,
      approved_by: req.approvedBy?.id ? Number(req.approvedBy.id) : null,
      notes: req.notes,
      excel_path: req.excelPath,
      created_at: req.createdAt,
      updated_at: req.updatedAt,
      sourceWarehouseName: req.sourceWarehouse?.name || 'Desconocido',
      destinationWarehouseName: req.destinationWarehouse?.name || 'Desconocido',
      requestedByUserName: req.requestedBy?.name || 'Sistema',
      approvedByUserName: req.approvedBy?.name || 'Pendiente',
      items: req.items?.map(it => ({
        id: Number(it.id),
        requisition_id: Number(req.id),
        inventory_id: it.inventory?.id ? Number(it.inventory.id) : null,
        requested_quantity: Number(it.requestedQuantity),
        approved_quantity: Number(it.approvedQuantity),
        notes: it.notes,
        productName: it.inventory?.name || 'N/A',
        sku: it.inventory?.sku || 'N/A',
        uomAbbrev: it.customUom || it.inventory?.uom?.abbreviation || 'und'
      })) || []
    };
  }
}
