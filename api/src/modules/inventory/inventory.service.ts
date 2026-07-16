import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { InventoryGateway } from './inventory.gateway';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { AlertsService } from '../alerts/alerts.service';
import { TelegramService } from '../alerts/telegram.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    private readonly inventoryGateway: InventoryGateway,
    @Inject(forwardRef(() => AlertsService))
    private readonly alertsService: AlertsService,
    private readonly telegramService: TelegramService,
  ) { }

  async findAll(categoryId?: number, operationalDestination?: string, page?: number, limit?: number) {
    let query = `
      SELECT 
        i.id, i.sku, i.barcode, i.name, i.description, i.product_type, 
        i.operational_destination, i.tracks_inventory, i.tracks_lot, 
        i.tracks_expiration, i.reference_cost, i.is_active,
        c.id AS category_id, c.name AS category_name,
        u.id AS uom_id, u.name AS uom_name, u.abbreviation AS uom_abbreviation,
        s.id AS stock_id, s.warehouse_id, s.quantity, s.minimum_stock, s.maximum_stock, s.bin_location,
        s.projected_daily_demand, s.projected_weekly_demand, s.projected_production
      FROM inventory i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units_of_measure u ON i.uom_id = u.id
      LEFT JOIN inventory_stock s ON s.inventory_id = i.id AND (s.warehouse_id = 1 OR s.warehouse_id IS NULL)
      WHERE i.is_active = true
    `;
    const params: any[] = [];
    if (categoryId) {
      params.push(categoryId);
      query += ` AND i.category_id = $${params.length}`;
    }
    if (operationalDestination) {
      params.push(operationalDestination);
      query += ` AND i.operational_destination = $${params.length}`;
    }
    query += ` ORDER BY i.name ASC`;

    if (page && limit) {
      const offset = (page - 1) * limit;
      params.push(limit);
      query += ` LIMIT $${params.length}`;
      params.push(offset);
      query += ` OFFSET $${params.length}`;
    }

    const rows = await this.inventoryRepo.manager.query(query, params);

    return rows.map(row => ({
      id: Number(row.id),
      sku: row.sku,
      barcode: row.barcode,
      name: row.name,
      description: row.description,
      product_type: row.product_type,
      operational_destination: row.operational_destination,
      tracks_inventory: row.tracks_inventory,
      tracks_lot: row.tracks_lot,
      tracks_expiration: row.tracks_expiration,
      reference_cost: Number(row.reference_cost),
      is_active: row.is_active,
      category: row.category_id ? {
        id: Number(row.category_id),
        name: row.category_name
      } : null,
      uom: row.uom_id ? {
        id: Number(row.uom_id),
        name: row.uom_name,
        abbreviation: row.uom_abbreviation
      } : null,
      inventory_stock: row.stock_id ? {
        id: Number(row.stock_id),
        warehouse_id: Number(row.warehouse_id),
        quantity: Number(row.quantity),
        minimum_stock: Number(row.minimum_stock),
        maximum_stock: Number(row.maximum_stock),
        projected_daily_demand: Number(row.projected_daily_demand || 0),
        projected_weekly_demand: Number(row.projected_weekly_demand || 0),
        projected_production: Number(row.projected_production || 0),
        bin_location: row.bin_location
      } : null
    }));
  }

  async findOne(id: number) {
    if (!id || isNaN(id)) {
      return null;
    }
    const query = `
      SELECT 
        i.id, i.sku, i.barcode, i.name, i.description, i.product_type, 
        i.operational_destination, i.tracks_inventory, i.tracks_lot, 
        i.tracks_expiration, i.reference_cost, i.is_active,
        c.id AS category_id, c.name AS category_name,
        u.id AS uom_id, u.name AS uom_name, u.abbreviation AS uom_abbreviation,
        s.id AS stock_id, s.warehouse_id, s.quantity, s.minimum_stock, s.maximum_stock, s.bin_location
      FROM inventory i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units_of_measure u ON i.uom_id = u.id
      LEFT JOIN inventory_stock s ON s.inventory_id = i.id AND (s.warehouse_id = 1 OR s.warehouse_id IS NULL)
      WHERE i.id = $1
    `;
    const rows = await this.inventoryRepo.manager.query(query, [id]);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: Number(row.id),
      sku: row.sku,
      barcode: row.barcode,
      name: row.name,
      description: row.description,
      product_type: row.product_type,
      operational_destination: row.operational_destination,
      tracks_inventory: row.tracks_inventory,
      tracks_lot: row.tracks_lot,
      tracks_expiration: row.tracks_expiration,
      reference_cost: Number(row.reference_cost),
      is_active: row.is_active,
      category: row.category_id ? {
        id: Number(row.category_id),
        name: row.category_name
      } : null,
      uom: row.uom_id ? {
        id: Number(row.uom_id),
        name: row.uom_name,
        abbreviation: row.uom_abbreviation
      } : null,
      inventory_stock: row.stock_id ? {
        id: Number(row.stock_id),
        warehouse_id: Number(row.warehouse_id),
        quantity: Number(row.quantity),
        minimum_stock: Number(row.minimum_stock),
        maximum_stock: Number(row.maximum_stock),
        bin_location: row.bin_location
      } : null
    };
  }

  async create(createInventoryDto: any) {
    const { inventory_stock, inventory_costs, ...inventoryData } = createInventoryDto;

    // Create and save inventory item first
    const product = this.inventoryRepo.create(inventoryData as any);
    const savedProduct: any = await this.inventoryRepo.save(product);

    // Save stock if provided
    if (inventory_stock) {
      await this.inventoryRepo.manager.query(
        `INSERT INTO inventory_stock (warehouse_id, inventory_id, quantity, minimum_stock, maximum_stock, projected_daily_demand, projected_weekly_demand, projected_production, bin_location, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          inventory_stock.warehouse_id,
          savedProduct.id,
          inventory_stock.quantity || 0,
          inventory_stock.minimum_stock || 0,
          inventory_stock.maximum_stock || 0,
          inventory_stock.projected_daily_demand || 0,
          inventory_stock.projected_weekly_demand || 0,
          inventory_stock.projected_production || 0,
          inventory_stock.bin_location || 'Estantería General'
        ]
      ).then(async () => {
        await this.alertsService.evaluateStock(Number(savedProduct.id), Number(inventory_stock.warehouse_id));
      }).catch(err => {
        console.error('Error inserting inventory_stock:', err);
      });
    }

    // Save costs if provided
    if (inventory_costs) {
      await this.inventoryRepo.manager.query(
        `INSERT INTO inventory_costs (inventory_id, last_cost, average_cost, replacement_cost, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (inventory_id) DO UPDATE SET
         last_cost = EXCLUDED.last_cost,
         average_cost = EXCLUDED.average_cost,
         replacement_cost = EXCLUDED.replacement_cost,
         updated_at = NOW()`,
        [
          savedProduct.id,
          inventory_costs.last_cost || savedProduct.reference_cost || 0,
          inventory_costs.average_cost || savedProduct.reference_cost || 0,
          inventory_costs.replacement_cost || savedProduct.reference_cost || 0
        ]
      ).catch(async (err) => {
        // If the table doesn't have unique constraint on inventory_id or doesn't support conflict
        console.warn('Upsert failed, trying clean insert for inventory_costs:', err.message);
        await this.inventoryRepo.manager.query(
          `INSERT INTO inventory_costs (inventory_id, last_cost, average_cost, replacement_cost)
           VALUES ($1, $2, $3, $4)`,
          [
            savedProduct.id,
            inventory_costs.last_cost || savedProduct.reference_cost || 0,
            inventory_costs.average_cost || savedProduct.reference_cost || 0,
            inventory_costs.replacement_cost || savedProduct.reference_cost || 0
          ]
        ).catch(innerErr => {
          console.error('Failed simple insert for inventory_costs:', innerErr.message);
        });
      });
    }

    const result = await this.findOne(savedProduct.id);

    // Send Telegram notification
    try {
      if (result) {
        await this.telegramService.sendMessage(
          `📦 *Nuevo Insumo Registrado*\n` +
          `• *Nombre:* ${result.name}\n` +
          `• *SKU:* ${result.sku}\n` +
          `• *Tipo:* ${result.product_type || 'N/A'}\n` +
          `• *Costo Ref:* $${Number(result.reference_cost || 0).toFixed(2)}\n` +
          `• *Categoría:* ${result.category?.name || 'N/A'}`
        );
      }
    } catch (tgErr) {
      console.error('Failed to send Telegram notification for inventory item creation:', tgErr);
    }

    return result;
  }

  async update(id: number, updateInventoryDto: any) {
    const { inventory_stock, inventory_costs, ...inventoryData } = updateInventoryDto;

    if (Object.keys(inventoryData).length > 0) {
      await this.inventoryRepo.update(id, inventoryData);
    }

    // Update/Insert stock
    if (inventory_stock) {
      const existingStock = await this.inventoryRepo.manager.query(
        `SELECT id FROM inventory_stock WHERE warehouse_id = $1 AND inventory_id = $2`,
        [inventory_stock.warehouse_id, id]
      );
      if (existingStock.length > 0) {
        await this.inventoryRepo.manager.query(
          `UPDATE inventory_stock SET 
             quantity = $1, 
             minimum_stock = $2, 
             maximum_stock = $3, 
             projected_daily_demand = $4, 
             projected_weekly_demand = $5, 
             projected_production = $6, 
             bin_location = $7, 
             updated_at = NOW()
           WHERE warehouse_id = $8 AND inventory_id = $9`,
          [
            inventory_stock.quantity || 0,
            inventory_stock.minimum_stock || 0,
            inventory_stock.maximum_stock || 0,
            inventory_stock.projected_daily_demand || 0,
            inventory_stock.projected_weekly_demand || 0,
            inventory_stock.projected_production || 0,
            inventory_stock.bin_location || 'Estantería General',
            inventory_stock.warehouse_id,
            id
          ]
        ).then(async () => {
          await this.alertsService.evaluateStock(Number(id), Number(inventory_stock.warehouse_id));
        }).catch(err => console.error('Error updating stock:', err));
      } else {
        await this.inventoryRepo.manager.query(
          `INSERT INTO inventory_stock (warehouse_id, inventory_id, quantity, minimum_stock, maximum_stock, projected_daily_demand, projected_weekly_demand, projected_production, bin_location, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            inventory_stock.warehouse_id,
            id,
            inventory_stock.quantity || 0,
            inventory_stock.minimum_stock || 0,
            inventory_stock.maximum_stock || 0,
            inventory_stock.projected_daily_demand || 0,
            inventory_stock.projected_weekly_demand || 0,
            inventory_stock.projected_production || 0,
            inventory_stock.bin_location || 'Estantería General'
          ]
        ).then(async () => {
          await this.alertsService.evaluateStock(Number(id), Number(inventory_stock.warehouse_id));
        }).catch(err => console.error('Error inserting stock on update:', err));
      }
    }

    // Update/Insert costs
    if (inventory_costs) {
      const existingCost = await this.inventoryRepo.manager.query(
        `SELECT inventory_id FROM inventory_costs WHERE inventory_id = $1`,
        [id]
      );
      if (existingCost.length > 0) {
        await this.inventoryRepo.manager.query(
          `UPDATE inventory_costs SET last_cost = $1, average_cost = $2, replacement_cost = $3, updated_at = NOW()
           WHERE inventory_id = $4`,
          [
            inventory_costs.last_cost || 0,
            inventory_costs.average_cost || 0,
            inventory_costs.replacement_cost || 0,
            id
          ]
        ).catch(async (err) => {
          // Fallback if updated_at doesn't exist
          await this.inventoryRepo.manager.query(
            `UPDATE inventory_costs SET last_cost = $1, average_cost = $2, replacement_cost = $3
             WHERE inventory_id = $4`,
            [
              inventory_costs.last_cost || 0,
              inventory_costs.average_cost || 0,
              inventory_costs.replacement_cost || 0,
              id
            ]
          ).catch(innerErr => console.error('Error updating costs fallback:', innerErr));
        });
      } else {
        await this.inventoryRepo.manager.query(
          `INSERT INTO inventory_costs (inventory_id, last_cost, average_cost, replacement_cost)
           VALUES ($1, $2, $3, $4)`,
          [
            id,
            inventory_costs.last_cost || 0,
            inventory_costs.average_cost || 0,
            inventory_costs.replacement_cost || 0
          ]
        ).catch(err => console.error('Error inserting costs on update:', err));
      }
    }

    const result = await this.findOne(id);

    // Send Telegram notification
    try {
      if (result) {
        await this.telegramService.sendMessage(
          `✏️ *Insumo Actualizado*\n` +
          `• *ID:* ${result.id}\n` +
          `• *Nombre:* ${result.name}\n` +
          `• *SKU:* ${result.sku}\n` +
          `• *Tipo:* ${result.product_type || 'N/A'}\n` +
          `• *Costo Ref:* $${Number(result.reference_cost || 0).toFixed(2)}`
        );
      }
    } catch (tgErr) {
      console.error('Failed to send Telegram notification for inventory item update:', tgErr);
    }

    return result;
  }

  async remove(id: number) {
    const product = await this.inventoryRepo.findOne({ where: { id: id as any } });
    if (product) {
      const removed = await this.inventoryRepo.remove(product);

      // Send Telegram notification
      try {
        await this.telegramService.sendMessage(
          `🗑️ *Insumo Eliminado*\n` +
          `• *Nombre:* ${product.name}\n` +
          `• *SKU:* ${product.sku}`
        );
      } catch (tgErr) {
        console.error('Failed to send Telegram notification for inventory item removal:', tgErr);
      }

      return removed;
    }
    return null;
  }

  async generateTemplateExcel() {
    const list = await this.findAll();
    const data = list.map(item => ({
      id: Number(item.id),
      insumo: item.name,
      cantidad: Number(item.inventory_stock?.quantity || 0),
      stock_minimo: Number(item.inventory_stock?.minimum_stock || 0),
      stock_maximo: Number(item.inventory_stock?.maximum_stock || 0),
      demanda_diaria_proyectada: Number(item.inventory_stock?.projected_daily_demand || 0),
      demanda_semanal_proyectada: Number(item.inventory_stock?.projected_weekly_demand || 0),
      produccion_proyectada: Number(item.inventory_stock?.projected_production || 0)
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async generateBulkTemplate(mode: 'register' | 'update'): Promise<Buffer> {
    const headers = mode === 'update' ? [
      'Actualizar',
      'ID',
      'SKU',
      'Código de Barras',
      'Nombre',
      'Descripción',
      'Categoría',
      'Subcategoría',
      'Unidad de Medida',
      'Tipo de Producto',
      'Destino Operacional',
      'Inventariable',
      'Control Lotes',
      'Control Vencimiento',
      'Costo Referencia',
      'Último Costo',
      'Costo Promedio',
      'Costo Reemplazo',
      'Almacén Inicial',
      'Cantidad Inicial',
      'Stock Mínimo',
      'Stock Máximo',
      'Demanda Diaria Proyectada',
      'Demanda Semanal Proyectada',
      'Producción Proyectada',
      'Ubicación Bin',
      'Activo'
    ] : [
      'SKU',
      'Código de Barras',
      'Nombre',
      'Descripción',
      'Categoría',
      'Subcategoría',
      'Unidad de Medida',
      'Tipo de Producto',
      'Destino Operacional',
      'Inventariable',
      'Control Lotes',
      'Control Vencimiento',
      'Costo Referencia',
      'Último Costo',
      'Costo Promedio',
      'Costo Reemplazo',
      'Almacén Inicial',
      'Cantidad Inicial',
      'Stock Mínimo',
      'Stock Máximo',
      'Demanda Diaria Proyectada',
      'Demanda Semanal Proyectada',
      'Producción Proyectada',
      'Ubicación Bin',
      'Activo'
    ];

    const rows: any[] = [];

    if (mode === 'register') {
      // Se descarga vacía sin datos de prueba, solo con los encabezados
    } else {
      const data = await this.inventoryRepo.manager.query(`
        SELECT 
          i.id,
          i.sku,
          i.barcode,
          i.name,
          i.description,
          c.name AS category_name,
          sc.name AS subcategory_name,
          u.id AS uom_id,
          u.name AS uom_name,
          u.abbreviation AS uom_abbr,
          i.product_type,
          i.operational_destination,
          i.tracks_inventory,
          i.tracks_lot,
          i.tracks_expiration,
          i.reference_cost,
          i.is_active,
          ic.last_cost,
          ic.average_cost,
          ic.replacement_cost,
          w.name AS warehouse_name,
          ist.quantity,
          ist.minimum_stock,
          ist.maximum_stock,
          ist.projected_daily_demand,
          ist.projected_weekly_demand,
          ist.projected_production,
          ist.bin_location
        FROM inventory i
        LEFT JOIN categories c ON i.category_id = c.id
        LEFT JOIN categories sc ON i.subcategory_id = sc.id
        LEFT JOIN units_of_measure u ON i.uom_id = u.id
        LEFT JOIN inventory_costs ic ON i.id = ic.inventory_id
        LEFT JOIN inventory_stock ist ON i.id = ist.inventory_id
        LEFT JOIN warehouses w ON ist.warehouse_id = w.id
        ORDER BY i.id ASC
      `);

      for (const item of data) {
        let productTypeName = '';
        if (item.product_type === 'MP') productTypeName = 'Materia Prima';
        else if (item.product_type === 'PT') productTypeName = 'Producto Terminado';
        else if (item.product_type === 'SE') productTypeName = 'Semi-Elaborado';
        else if (item.product_type === 'INS') productTypeName = 'Insumo';
        else if (item.product_type === 'ACT') productTypeName = 'Activo Fijo';
        else if (item.product_type === 'SRV') productTypeName = 'Servicio';

        const uomDisplay = item.uom_id ? `${item.uom_id} - ${item.uom_name || ''} (${item.uom_abbr || ''})` : (item.uom_abbr || '');

        rows.push({
          'Actualizar': 'No',
          'ID': Number(item.id),
          'SKU': item.sku || '',
          'Código de Barras': item.barcode || '',
          'Nombre': item.name || '',
          'Descripción': item.description || '',
          'Categoría': item.category_name || '',
          'Subcategoría': item.subcategory_name || '',
          'Unidad de Medida': uomDisplay,
          'Tipo de Producto': productTypeName,
          'Destino Operacional': item.operational_destination || '',
          'Inventariable': item.tracks_inventory ? 'Sí' : 'No',
          'Control Lotes': item.tracks_lot ? 'Sí' : 'No',
          'Control Vencimiento': item.tracks_expiration ? 'Sí' : 'No',
          'Costo Referencia': item.reference_cost ? Number(item.reference_cost) : 0,
          'Último Costo': item.last_cost ? Number(item.last_cost) : 0,
          'Costo Promedio': item.average_cost ? Number(item.average_cost) : 0,
          'Costo Reemplazo': item.replacement_cost ? Number(item.replacement_cost) : 0,
          'Almacén Inicial': item.warehouse_name || 'Almacén Central',
          'Cantidad Inicial': item.quantity ? Number(item.quantity) : 0,
          'Stock Mínimo': item.minimum_stock ? Number(item.minimum_stock) : 0,
          'Stock Máximo': item.maximum_stock ? Number(item.maximum_stock) : 0,
          'Demanda Diaria Proyectada': item.projected_daily_demand ? Number(item.projected_daily_demand) : 0,
          'Demanda Semanal Proyectada': item.projected_weekly_demand ? Number(item.projected_weekly_demand) : 0,
          'Producción Proyectada': item.projected_production ? Number(item.projected_production) : 0,
          'Ubicación Bin': item.bin_location || 'Estantería General',
          'Activo': item.is_active ? 'Sí' : 'No'
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Catálogo');

    // Add Units of Measure reference sheet
    const uoms: any[] = await this.inventoryRepo.manager.query('SELECT id, name, abbreviation FROM units_of_measure');
    const uomRows = uoms.map(u => ({
      'ID (Escribir en el excel)': Number(u.id),
      'Nombre': u.name,
      'Abreviación': u.abbreviation,
      'Texto para la Celda': `${u.id} - ${u.name} (${u.abbreviation})`
    }));
    const uomWorksheet = XLSX.utils.json_to_sheet(uomRows);
    XLSX.utils.book_append_sheet(workbook, uomWorksheet, 'Unidades de Medida');

    const wscols = headers.map(h => ({ wch: Math.max(h.length + 3, 12) }));
    worksheet['!cols'] = wscols;

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async processBulkUpload(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: '' });

    if (rawRows.length === 0) {
      return {
        success: false,
        message: 'El archivo está vacío.',
        errors: [{ row: 1, sku: 'N/A', message: 'No se encontraron filas con datos.' }],
        insertedCount: 0,
        updatedCount: 0
      };
    }

    const categories: any[] = await this.inventoryRepo.manager.query('SELECT id, name FROM categories WHERE is_active = true');
    const uoms: any[] = await this.inventoryRepo.manager.query('SELECT id, name, abbreviation FROM units_of_measure');
    const warehouses: any[] = await this.inventoryRepo.manager.query('SELECT id, name FROM warehouses WHERE is_active = true OR is_active IS NULL');

    const categoryMap = new Map<string, number>();
    for (const c of categories) {
      if (c.name) {
        categoryMap.set(c.name.trim().toLowerCase(), Number(c.id));
      }
    }

    const uomMap = new Map<string, number>();
    for (const u of uoms) {
      if (u.name) {
        uomMap.set(u.name.trim().toLowerCase(), Number(u.id));
      }
      if (u.abbreviation) {
        uomMap.set(u.abbreviation.trim().toLowerCase(), Number(u.id));
      }
    }

    const warehouseMap = new Map<string, number>();
    for (const w of warehouses) {
      if (w.name) {
        warehouseMap.set(w.name.trim().toLowerCase(), Number(w.id));
      }
    }

    const productTypeMap: Record<string, string> = {
      'materia prima': 'MP',
      'producto terminado': 'PT',
      'semi-elaborado': 'SE',
      'insumo': 'INS',
      'activo fijo': 'ACT',
      'servicio': 'SRV',
      'mp': 'MP',
      'pt': 'PT',
      'se': 'SE',
      'ins': 'INS',
      'act': 'ACT',
      'srv': 'SRV'
    };

    const errors: { row: number; sku: string; message: string }[] = [];
    const sanitizedRows: any[] = [];
    const excelSkus = new Set<string>();

    const parseBool = (val: any, defaultVal: boolean) => {
      if (val === null || val === undefined || val === '') return defaultVal;
      const s = String(val).trim().toLowerCase();
      return s === 'sí' || s === 'si' || s === 's' || s === 'true' || s === '1' || s === 'yes' || s === 'y';
    };

    const getRowVal = (row: any, keys: string[]) => {
      for (const key of keys) {
        if (key in row) return row[key];
      }
      return undefined;
    };

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const rowNum = index + 2;

      const idStr = String(row['ID'] || '').trim();
      const hasActualizarColumn = 'Actualizar' in row;
      const shouldUpdate = hasActualizarColumn ? parseBool(row['Actualizar'], false) : true;
      if (!shouldUpdate) {
        continue;
      }

      let id: number | null = null;
      let existingProduct: any = null;
      if (idStr) {
        id = Number(idStr);
        if (isNaN(id) || id <= 0) {
          errors.push({ row: rowNum, sku: 'N/A', message: `El ID '${idStr}' no es válido.` });
          continue;
        }
        existingProduct = await this.inventoryRepo.findOne({
          where: { id: id as any },
          relations: ['category', 'uom']
        });
        if (!existingProduct) {
          errors.push({ row: rowNum, sku: 'N/A', message: `El ID del insumo '${id}' no existe en la base de datos.` });
          continue;
        }
      }

      const sku = ('SKU' in row) ? String(row['SKU'] || '').trim() : (existingProduct ? existingProduct.sku : '');
      const name = ('Nombre' in row) ? String(row['Nombre'] || '').trim() : (existingProduct ? existingProduct.name : '');

      if (!sku && !name) {
        continue;
      }

      if (!sku) {
        errors.push({ row: rowNum, sku: 'N/A', message: 'El SKU es obligatorio.' });
        continue;
      }

      if (!name) {
        errors.push({ row: rowNum, sku, message: 'El Nombre es obligatorio.' });
        continue;
      }

      const skuLower = sku.toLowerCase();
      if (excelSkus.has(skuLower)) {
        errors.push({ row: rowNum, sku, message: `El SKU '${sku}' está duplicado dentro de este archivo Excel.` });
        continue;
      }
      excelSkus.add(skuLower);

      if (idStr) {
        // If updating SKU, check if it's already used by another product
        if ('SKU' in row) {
          const newSku = String(row['SKU'] || '').trim();
          if (newSku && newSku.toLowerCase() !== existingProduct.sku.toLowerCase()) {
            const skuExists = await this.inventoryRepo.findOne({ where: { sku: newSku } });
            if (skuExists) {
              errors.push({ row: rowNum, sku: newSku, message: `El SKU '${newSku}' ya está registrado para otro insumo.` });
              continue;
            }
          }
        }
      } else {
        const skuExists = await this.inventoryRepo.findOne({ where: { sku } });
        if (skuExists) {
          errors.push({ row: rowNum, sku, message: `El SKU '${sku}' ya está registrado en el catálogo. Use la plantilla de actualización si desea modificarlo.` });
          continue;
        }
      }

      let categoryId: number | null = null;
      let categoryName: string | null = null;
      if ('Categoría' in row) {
        categoryName = String(row['Categoría'] || '').trim();
        if (!categoryName) {
          errors.push({ row: rowNum, sku, message: 'La Categoría es obligatoria.' });
          continue;
        }
        categoryId = categoryMap.get(categoryName.toLowerCase()) || null;
      } else if (existingProduct) {
        categoryId = existingProduct.category ? Number(existingProduct.category.id) : null;
        categoryName = existingProduct.category ? existingProduct.category.name : null;
      }

      let subcategoryId: number | null = null;
      if ('Subcategoría' in row) {
        const subcatName = String(row['Subcategoría'] || '').trim();
        if (subcatName) {
          subcategoryId = categoryMap.get(subcatName.toLowerCase()) || null;
          if (!subcategoryId) {
            errors.push({ row: rowNum, sku, message: `La Subcategoría '${subcatName}' no existe.` });
            continue;
          }
        }
      } else if (existingProduct) {
        subcategoryId = existingProduct.subcategory ? Number(existingProduct.subcategory.id) : null;
      }

      let uomId: number | null = null;
      if ('Unidad de Medida' in row) {
        const uomName = String(row['Unidad de Medida'] || '').trim();
        if (!uomName) {
          errors.push({ row: rowNum, sku, message: 'La Unidad de Medida es obligatoria.' });
          continue;
        }

        // Try to extract ID from prefix (e.g., "1 - Kilogramo" -> 1)
        const matchId = uomName.match(/^(\d+)/);
        if (matchId) {
          const parsedId = Number(matchId[1]);
          const idExists = uoms.some(u => Number(u.id) === parsedId);
          if (idExists) {
            uomId = parsedId;
          }
        }

        // Fallback to name/abbreviation lookup
        if (!uomId) {
          uomId = uomMap.get(uomName.toLowerCase()) || null;
        }

        if (!uomId) {
          errors.push({ row: rowNum, sku, message: `La Unidad de Medida '${uomName}' no existe o no es válida.` });
          continue;
        }
      } else if (existingProduct) {
        uomId = existingProduct.uom ? Number(existingProduct.uom.id) : null;
      }

      let productType = '';
      if ('Tipo de Producto' in row) {
        const typeStr = String(row['Tipo de Producto'] || '').trim().toLowerCase();
        if (!typeStr) {
          errors.push({ row: rowNum, sku, message: 'El Tipo de Producto es obligatorio.' });
          continue;
        }
        productType = productTypeMap[typeStr] || '';
        if (!productType) {
          errors.push({ row: rowNum, sku, message: `El Tipo de Producto '${row['Tipo de Producto']}' no es válido. Valores permitidos: Materia Prima, Producto Terminado, Semi-Elaborado, Insumo, Activo Fijo, Servicio.` });
          continue;
        }
      } else if (existingProduct) {
        productType = existingProduct.product_type;
      }

      let operationalDestination = '';
      if ('Destino Operacional' in row) {
        operationalDestination = String(row['Destino Operacional'] || '').trim();
        if (!operationalDestination) {
          errors.push({ row: rowNum, sku, message: 'El Destino Operacional es obligatorio.' });
          continue;
        }
      } else if (existingProduct) {
        operationalDestination = existingProduct.operational_destination;
      }

      let lastCost = 0;
      let avgCost = 0;
      let repCost = 0;
      if (existingProduct) {
        const existingCosts = await this.inventoryRepo.manager.query(
          `SELECT last_cost, average_cost, replacement_cost FROM inventory_costs WHERE inventory_id = $1`,
          [id]
        );
        if (existingCosts.length > 0) {
          lastCost = Number(existingCosts[0].last_cost);
          avgCost = Number(existingCosts[0].average_cost);
          repCost = Number(existingCosts[0].replacement_cost);
        }
      }

      let refCost = 0;
      if ('Costo Referencia' in row) {
        refCost = Number(row['Costo Referencia'] || 0);
      } else if (existingProduct) {
        refCost = existingProduct.reference_cost ? Number(existingProduct.reference_cost) : 0;
      }

      if ('Último Costo' in row) lastCost = Number(row['Último Costo'] || 0);
      else if (!existingProduct) lastCost = refCost;

      if ('Costo Promedio' in row) avgCost = Number(row['Costo Promedio'] || 0);
      else if (!existingProduct) avgCost = refCost;

      if ('Costo Reemplazo' in row) repCost = Number(row['Costo Reemplazo'] || 0);
      else if (!existingProduct) repCost = refCost;

      const hasQty = getRowVal(row, ['Cantidad Inicial']) !== undefined;
      const hasMin = getRowVal(row, ['Stock minimo', 'Stock Mínimo']) !== undefined;
      const hasMax = getRowVal(row, ['Stock maximo', 'Stock Máximo']) !== undefined;
      const hasDailyDemand = getRowVal(row, ['Demanda Diaria Proyectada', 'Demanda diaria proyectada']) !== undefined;
      const hasWeeklyDemand = getRowVal(row, ['Demanda Semanal Proyectada', 'Demanda semanal proyectada']) !== undefined;
      const hasProduction = getRowVal(row, ['Producción Proyectada', 'Producción proyectada', 'Produccion Proyectada', 'Produccion proyectada']) !== undefined;
      const hasBin = getRowVal(row, ['Ubicación Bin']) !== undefined;
      const hasWh = getRowVal(row, ['Almacén Inicial']) !== undefined;

      let warehouseId: number | null = null;
      let qty = 0;
      let minStock = 0;
      let maxStock = 0;
      let dailyDemand = 0;
      let weeklyDemand = 0;
      let production = 0;
      let binLocation = 'Estantería General';

      if (existingProduct) {
        const existingStock = await this.inventoryRepo.manager.query(
          `SELECT warehouse_id, quantity, minimum_stock, maximum_stock, projected_daily_demand, projected_weekly_demand, projected_production, bin_location FROM inventory_stock WHERE inventory_id = $1 LIMIT 1`,
          [id]
        );
        if (existingStock.length > 0) {
          warehouseId = Number(existingStock[0].warehouse_id);
          qty = Number(existingStock[0].quantity);
          minStock = Number(existingStock[0].minimum_stock);
          maxStock = Number(existingStock[0].maximum_stock);
          dailyDemand = Number(existingStock[0].projected_daily_demand || 0);
          weeklyDemand = Number(existingStock[0].projected_weekly_demand || 0);
          production = Number(existingStock[0].projected_production || 0);
          binLocation = existingStock[0].bin_location || 'Estantería General';
        }
      }

      if (hasWh) {
        const whName = String(getRowVal(row, ['Almacén Inicial']) || '').trim();
        if (whName) {
          warehouseId = warehouseMap.get(whName.toLowerCase()) || null;
          if (!warehouseId) {
            errors.push({ row: rowNum, sku, message: `El Almacén '${whName}' no existe.` });
            continue;
          }
        }
      } else if (!warehouseId && (hasQty || hasMin || hasMax)) {
        if (warehouses.length > 0) {
          warehouseId = Number(warehouses[0].id);
        }
      }

      // Al importar el excel, el almacén en inventory_stock debe ser almacenado bajo el valor 1
      if (warehouseId !== null) {
        warehouseId = 1;
      }

      if (hasQty) qty = Number(getRowVal(row, ['Cantidad Inicial']) || 0);
      if (hasMin) minStock = Number(getRowVal(row, ['Stock minimo', 'Stock Mínimo']) || 0);
      if (hasMax) maxStock = Number(getRowVal(row, ['Stock maximo', 'Stock Máximo']) || 0);
      if (hasDailyDemand) dailyDemand = Number(getRowVal(row, ['Demanda Diaria Proyectada', 'Demanda diaria proyectada']) || 0);
      if (hasWeeklyDemand) weeklyDemand = Number(getRowVal(row, ['Demanda Semanal Proyectada', 'Demanda semanal proyectada']) || 0);
      if (hasProduction) production = Number(getRowVal(row, ['Producción Proyectada', 'Producción proyectada', 'Produccion Proyectada', 'Produccion proyectada']) || 0);
      if (hasBin) binLocation = String(getRowVal(row, ['Ubicación Bin']) || '').trim() || 'Estantería General';

      if (isNaN(refCost) || refCost < 0) {
        errors.push({ row: rowNum, sku, message: 'El Costo Referencia debe ser un número positivo.' });
        continue;
      }
      if (isNaN(lastCost) || lastCost < 0) {
        errors.push({ row: rowNum, sku, message: 'El Último Costo debe ser un número positivo.' });
        continue;
      }
      if (isNaN(avgCost) || avgCost < 0) {
        errors.push({ row: rowNum, sku, message: 'El Costo Promedio debe ser un número positivo.' });
        continue;
      }
      if (isNaN(repCost) || repCost < 0) {
        errors.push({ row: rowNum, sku, message: 'El Costo Reemplazo debe ser un número positivo.' });
        continue;
      }
      if (isNaN(qty) || qty < 0) {
        errors.push({ row: rowNum, sku, message: 'La Cantidad Inicial debe ser un número positivo.' });
        continue;
      }
      if (isNaN(minStock) || minStock < 0) {
        errors.push({ row: rowNum, sku, message: 'El Stock Mínimo debe ser un número positivo.' });
        continue;
      }
      if (isNaN(maxStock) || maxStock < 0) {
        errors.push({ row: rowNum, sku, message: 'El Stock Máximo debe ser un número positivo.' });
        continue;
      }
      if (isNaN(dailyDemand) || dailyDemand < 0) {
        errors.push({ row: rowNum, sku, message: 'La Demanda Diaria Proyectada debe ser un número positivo o cero.' });
        continue;
      }
      if (isNaN(weeklyDemand) || weeklyDemand < 0) {
        errors.push({ row: rowNum, sku, message: 'La Demanda Semanal Proyectada debe ser un número positivo o cero.' });
        continue;
      }
      if (isNaN(production) || production < 0) {
        errors.push({ row: rowNum, sku, message: 'La Producción Proyectada debe ser un número positivo o cero.' });
        continue;
      }

      const tracksInventory = ('Inventariable' in row) ? parseBool(row['Inventariable'], true) : (existingProduct ? existingProduct.tracks_inventory : true);
      const tracksLot = ('Control Lotes' in row) ? parseBool(row['Control Lotes'], false) : (existingProduct ? existingProduct.tracks_lot : false);
      const tracksExpiration = ('Control Vencimiento' in row) ? parseBool(row['Control Vencimiento'], false) : (existingProduct ? existingProduct.tracks_expiration : false);
      const isActive = ('Activo' in row) ? parseBool(row['Activo'], true) : (existingProduct ? existingProduct.is_active : true);
      const barcode = ('Código de Barras' in row) ? (String(row['Código de Barras'] || '').trim() || null) : (existingProduct ? existingProduct.barcode : null);
      const description = ('Descripción' in row) ? (String(row['Descripción'] || '').trim() || null) : (existingProduct ? existingProduct.description : null);

      sanitizedRows.push({
        id,
        sku,
        barcode,
        name,
        description,
        categoryId,
        categoryName,
        subcategoryId,
        uomId,
        productType,
        operationalDestination,
        tracksInventory,
        tracksLot,
        tracksExpiration,
        referenceCost: refCost,
        isActive,
        costs: {
          lastCost,
          averageCost: avgCost,
          replacementCost: repCost
        },
        stock: warehouseId ? {
          warehouseId,
          quantity: qty,
          minimumStock: minStock,
          maximumStock: maxStock,
          projectedDailyDemand: dailyDemand,
          projectedWeeklyDemand: weeklyDemand,
          projectedProduction: production,
          binLocation
        } : null
      });
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: 'Se encontraron errores de validación en el archivo.',
        errors,
        insertedCount: 0,
        updatedCount: 0
      };
    }

    if (sanitizedRows.length === 0 && rawRows.length > 0) {
      return {
        success: true,
        message: 'No se seleccionó ningún insumo para procesar. Recuerda marcar "Sí" en la columna "Actualizar" para los registros que deseas cargar o modificar.',
        insertedCount: 0,
        updatedCount: 0,
        errors: []
      };
    }

    let insertedCount = 0;
    let updatedCount = 0;

    try {
      await this.inventoryRepo.manager.transaction(async (transactionManager) => {
        for (const data of sanitizedRows) {
          let productId: number;
          let finalCategoryId = data.categoryId;

          if (data.categoryName && !finalCategoryId) {
            const existingCat = await transactionManager.query(
              'SELECT id FROM categories WHERE LOWER(name) = $1',
              [data.categoryName.toLowerCase()]
            );
            if (existingCat.length > 0) {
              finalCategoryId = Number(existingCat[0].id);
            } else {
              const code = `CAT-${data.categoryName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}`;
              const insertCat = await transactionManager.query(`
                INSERT INTO categories (name, code, is_active)
                VALUES ($1, $2, true)
                RETURNING id
              `, [data.categoryName, code]);
              finalCategoryId = Number(insertCat[0].id);
            }
          }

          if (data.id) {
            await transactionManager.query(`
              UPDATE inventory SET
                sku = $1,
                barcode = $2,
                name = $3,
                description = $4,
                category_id = $5,
                subcategory_id = $6,
                uom_id = $7,
                product_type = $8,
                operational_destination = $9,
                tracks_inventory = $10,
                tracks_lot = $11,
                tracks_expiration = $12,
                reference_cost = $13,
                is_active = $14,
                updated_at = NOW()
              WHERE id = $15
            `, [
              data.sku,
              data.barcode,
              data.name,
              data.description,
              finalCategoryId,
              data.subcategoryId,
              data.uomId,
              data.productType,
              data.operationalDestination,
              data.tracksInventory,
              data.tracksLot,
              data.tracksExpiration,
              data.referenceCost,
              data.isActive,
              data.id
            ]);

            productId = data.id;
            updatedCount++;
          } else {
            const insertResult = await transactionManager.query(`
              INSERT INTO inventory (
                sku, barcode, name, description, category_id, subcategory_id, uom_id,
                product_type, operational_destination, tracks_inventory, tracks_lot,
                tracks_expiration, reference_cost, is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
              RETURNING id
            `, [
              data.sku,
              data.barcode,
              data.name,
              data.description,
              finalCategoryId,
              data.subcategoryId,
              data.uomId,
              data.productType,
              data.operationalDestination,
              data.tracksInventory,
              data.tracksLot,
              data.tracksExpiration,
              data.referenceCost,
              data.isActive
            ]);

            productId = Number(insertResult[0].id);
            insertedCount++;
          }

          await transactionManager.query(`
            INSERT INTO inventory_costs (inventory_id, last_cost, average_cost, replacement_cost, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (inventory_id) DO UPDATE SET
              last_cost = EXCLUDED.last_cost,
              average_cost = EXCLUDED.average_cost,
              replacement_cost = EXCLUDED.replacement_cost,
              updated_at = NOW()
          `, [
            productId,
            data.costs.lastCost,
            data.costs.averageCost,
            data.costs.replacementCost
          ]).catch(async () => {
            const exists = await transactionManager.query('SELECT 1 FROM inventory_costs WHERE inventory_id = $1', [productId]);
            if (exists.length > 0) {
              await transactionManager.query(`
                UPDATE inventory_costs SET
                  last_cost = $1,
                  average_cost = $2,
                  replacement_cost = $3,
                  updated_at = NOW()
                WHERE inventory_id = $4
              `, [data.costs.lastCost, data.costs.averageCost, data.costs.replacementCost, productId]);
            } else {
              await transactionManager.query(`
                INSERT INTO inventory_costs (inventory_id, last_cost, average_cost, replacement_cost)
                VALUES ($1, $2, $3, $4)
              `, [productId, data.costs.lastCost, data.costs.averageCost, data.costs.replacementCost]);
            }
          });

          if (data.stock) {
            await transactionManager.query(`
              INSERT INTO inventory_stock (warehouse_id, inventory_id, quantity, minimum_stock, maximum_stock, projected_daily_demand, projected_weekly_demand, projected_production, bin_location, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
              ON CONFLICT (warehouse_id, inventory_id) DO UPDATE SET
                quantity = EXCLUDED.quantity,
                minimum_stock = EXCLUDED.minimum_stock,
                maximum_stock = EXCLUDED.maximum_stock,
                projected_daily_demand = EXCLUDED.projected_daily_demand,
                projected_weekly_demand = EXCLUDED.projected_weekly_demand,
                projected_production = EXCLUDED.projected_production,
                bin_location = EXCLUDED.bin_location,
                updated_at = NOW()
            `, [
              data.stock.warehouseId,
              productId,
              data.stock.quantity,
              data.stock.minimumStock,
              data.stock.maximumStock,
              data.stock.projectedDailyDemand,
              data.stock.projectedWeeklyDemand,
              data.stock.projectedProduction,
              data.stock.binLocation
            ]).catch(async () => {
              const exists = await transactionManager.query('SELECT 1 FROM inventory_stock WHERE warehouse_id = $1 AND inventory_id = $2', [data.stock.warehouseId, productId]);
              if (exists.length > 0) {
                await transactionManager.query(`
                  UPDATE inventory_stock SET
                    quantity = $1,
                    minimum_stock = $2,
                    maximum_stock = $3,
                    projected_daily_demand = $4,
                    projected_weekly_demand = $5,
                    projected_production = $6,
                    bin_location = $7,
                    updated_at = NOW()
                  WHERE warehouse_id = $8 AND inventory_id = $9
                `, [data.stock.quantity, data.stock.minimumStock, data.stock.maximumStock, data.stock.projectedDailyDemand, data.stock.projectedWeeklyDemand, data.stock.projectedProduction, data.stock.binLocation, data.stock.warehouseId, productId]);
              } else {
                await transactionManager.query(`
                  INSERT INTO inventory_stock (warehouse_id, inventory_id, quantity, minimum_stock, maximum_stock, projected_daily_demand, projected_weekly_demand, projected_production, bin_location)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [data.stock.warehouseId, productId, data.stock.quantity, data.stock.minimumStock, data.stock.maximumStock, data.stock.projectedDailyDemand, data.stock.projectedWeeklyDemand, data.stock.projectedProduction, data.stock.binLocation]);
              }
            });
          }
        }
      });

      // Send Telegram summary notification
      try {
        await this.telegramService.sendMessage(
          `📊 *Carga Masiva de Inventario Procesada*\n` +
          `• *Insumos Creados:* ${insertedCount}\n` +
          `• *Insumos Actualizados:* ${updatedCount}`
        );
      } catch (tgErr) {
        console.error('Failed to send Telegram notification for bulk upload summary:', tgErr);
      }

      return {
        success: true,
        message: 'Archivo procesado e importado con éxito.',
        insertedCount,
        updatedCount,
        errors: []
      };
    } catch (err) {
      console.error('Error in bulk upload transaction:', err);
      return {
        success: false,
        message: 'Ocurrió un error al persistir los datos. Se canceló toda la operación.',
        errors: [{ row: 0, sku: 'N/A', message: err.message || 'Error interno de base de datos' }],
        insertedCount: 0,
        updatedCount: 0
      };
    }
  }
  async processPhysicalCountUpload(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: true });

    let updatedCount = 0;

    for (const row of rows) {
      const id = Number(row['id'] || row['ID']);
      const quantity = Number(row['cantidad'] || row['Cantidad'] || 0);

      const minStockRaw = row['stock_minimo'] !== undefined ? row['stock_minimo'] : row['Stock Minimo'] !== undefined ? row['Stock Minimo'] : row['Stock Mínimo'] !== undefined ? row['Stock Mínimo'] : null;
      const maxStockRaw = row['stock_maximo'] !== undefined ? row['stock_maximo'] : row['Stock Maximo'] !== undefined ? row['Stock Maximo'] : row['Stock Máximo'] !== undefined ? row['Stock Máximo'] : null;

      const dailyDemandRaw = row['demanda_diaria_proyectada'] !== undefined ? row['demanda_diaria_proyectada'] : row['projected_daily_demand'] !== undefined ? row['projected_daily_demand'] : null;
      const weeklyDemandRaw = row['demanda_semanal_proyectada'] !== undefined ? row['demanda_semanal_proyectada'] : row['projected_weekly_demand'] !== undefined ? row['projected_weekly_demand'] : null;
      const productionRaw = row['produccion_proyectada'] !== undefined ? row['produccion_proyectada'] : row['projected_production'] !== undefined ? row['projected_production'] : null;

      if (isNaN(id) || isNaN(quantity)) {
        continue;
      }

      const minStock = minStockRaw !== null ? Number(minStockRaw) : null;
      const maxStock = maxStockRaw !== null ? Number(maxStockRaw) : null;
      const dailyDemand = dailyDemandRaw !== null ? Number(dailyDemandRaw) : null;
      const weeklyDemand = weeklyDemandRaw !== null ? Number(weeklyDemandRaw) : null;
      const production = productionRaw !== null ? Number(productionRaw) : null;

      // Update inventory_stock quantity for this inventory_id in warehouse 1
      const existing = await this.inventoryRepo.manager.query(
        `SELECT id, minimum_stock, maximum_stock, projected_daily_demand, projected_weekly_demand, projected_production 
         FROM inventory_stock WHERE inventory_id = $1 AND warehouse_id = 1`,
        [id]
      );

      if (existing.length > 0) {
        const finalMinStock = minStock !== null && !isNaN(minStock) ? minStock : Number(existing[0].minimum_stock || 0);
        const finalMaxStock = maxStock !== null && !isNaN(maxStock) ? maxStock : Number(existing[0].maximum_stock || 0);
        const finalDailyDemand = dailyDemand !== null && !isNaN(dailyDemand) ? dailyDemand : Number(existing[0].projected_daily_demand || 0);
        const finalWeeklyDemand = weeklyDemand !== null && !isNaN(weeklyDemand) ? weeklyDemand : Number(existing[0].projected_weekly_demand || 0);
        const finalProduction = production !== null && !isNaN(production) ? production : Number(existing[0].projected_production || 0);

        await this.inventoryRepo.manager.query(
          `UPDATE inventory_stock SET 
             quantity = $1, 
             minimum_stock = $2, 
             maximum_stock = $3, 
             projected_daily_demand = $4,
             projected_weekly_demand = $5,
             projected_production = $6,
             updated_at = NOW() 
           WHERE inventory_id = $7 AND warehouse_id = 1`,
          [quantity, finalMinStock, finalMaxStock, finalDailyDemand, finalWeeklyDemand, finalProduction, id]
        );
      } else {
        const finalMinStock = minStock !== null && !isNaN(minStock) ? minStock : 0;
        const finalMaxStock = maxStock !== null && !isNaN(maxStock) ? maxStock : 80;
        const finalDailyDemand = dailyDemand !== null && !isNaN(dailyDemand) ? dailyDemand : 0;
        const finalWeeklyDemand = weeklyDemand !== null && !isNaN(weeklyDemand) ? weeklyDemand : 0;
        const finalProduction = production !== null && !isNaN(production) ? production : 0;

        await this.inventoryRepo.manager.query(
          `INSERT INTO inventory_stock (warehouse_id, inventory_id, quantity, minimum_stock, maximum_stock, projected_daily_demand, projected_weekly_demand, projected_production, updated_at)
           VALUES (1, $1, $2, $3, $4, $5, $6, $7, NOW())`,
          [id, quantity, finalMinStock, finalMaxStock, finalDailyDemand, finalWeeklyDemand, finalProduction]
        );
      }

      updatedCount++;
    }

    return {
      success: true,
      message: `Se actualizaron ${updatedCount} insumos desde el archivo Excel.`,
      updatedCount
    };
  }

}