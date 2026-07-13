import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { History } from '../history/entities/history.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Decrease } from '../decreases/entities/decrease.entity';

@Injectable()
export class DashboardService implements OnModuleInit {
  private readonly logger = new Logger(DashboardService.name);
  
  // In-memory caching system
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes cache lifetime

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.createMaterializedViewIfNotExists();
  }

  /**
   * Safe initialization of PostgreSQL Materialized View
   */
  async createMaterializedViewIfNotExists() {
    try {
      const checkView = await this.dataSource.query(`
        SELECT COUNT(*) 
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'm' AND n.nspname = 'public' AND c.relname = 'mv_inventory_stock_valuation'
      `);

      if (Number(checkView[0].count) === 0) {
        this.logger.log('Creating materialized view mv_inventory_stock_valuation...');
        await this.dataSource.query(`
          CREATE MATERIALIZED VIEW mv_inventory_stock_valuation AS
          SELECT 
            s.id AS stock_id,
            w.id AS warehouse_id,
            w.name AS warehouse_name,
            w.warehouse_type AS warehouse_type,
            w.parent_warehouse_id AS parent_warehouse_id,
            i.id AS inventory_id,
            i.sku AS sku,
            i.name AS inventory_name,
            i.product_type AS product_type,
            i.reference_cost AS reference_cost,
            COALESCE(c.average_cost, i.reference_cost, 0) AS average_cost,
            COALESCE(c.last_cost, i.reference_cost, 0) AS last_cost,
            COALESCE(c.replacement_cost, i.reference_cost, 0) AS replacement_cost,
            s.quantity AS quantity,
            s.minimum_stock AS minimum_stock,
            (s.quantity * COALESCE(c.average_cost, i.reference_cost, 0)) AS total_value_average,
            (s.quantity * COALESCE(c.last_cost, i.reference_cost, 0)) AS total_value_last,
            (s.quantity * COALESCE(c.replacement_cost, i.reference_cost, 0)) AS total_value_replacement
          FROM inventory_stock s
          JOIN inventory i ON s.inventory_id = i.id
          JOIN warehouses w ON s.warehouse_id = w.id
          LEFT JOIN (
            SELECT DISTINCT ON (inventory_id)
              inventory_id,
              last_cost,
              average_cost,
              replacement_cost
            FROM inventory_costs
            ORDER BY inventory_id
          ) c ON i.id = c.inventory_id;
        `);

        await this.dataSource.query(`
          CREATE UNIQUE INDEX idx_mv_inventory_stock_val ON mv_inventory_stock_valuation (stock_id);
        `);
        
        this.logger.log('Materialized view mv_inventory_stock_valuation created successfully.');
      }
    } catch (err) {
      this.logger.error('Error creating materialized view:', err);
    }
  }

  /**
   * Refreshes the database materialized view
   */
  async refreshMaterializedView(): Promise<void> {
    this.logger.log('Refreshing materialized view mv_inventory_stock_valuation...');
    try {
      await this.dataSource.query(`
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_stock_valuation
      `);
      this.logger.log('Materialized view refreshed concurrently.');
    } catch (err) {
      this.logger.warn('Concurrent refresh failed, executing standard refresh:', err.message);
      await this.dataSource.query(`
        REFRESH MATERIALIZED VIEW mv_inventory_stock_valuation
      `);
      this.logger.log('Materialized view refreshed using standard refresh.');
    }
  }

  /**
   * Clears the cache and forces a database materialized view refresh
   */
  async forceRefresh(): Promise<{ success: boolean; message: string }> {
    this.cache.clear();
    await this.refreshMaterializedView();
    return { success: true, message: 'El caché ha sido limpiado y la vista materializada ha sido actualizada.' };
  }

  /**
   * Helper to retrieve cached data or compute and cache if expired/missing
   */
  private async getOrSetCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    forceRefresh = false
  ): Promise<{ data: T; cached: boolean }> {
    const cachedItem = this.cache.get(key);
    const now = Date.now();
    
    if (cachedItem && cachedItem.expiry > now && !forceRefresh) {
      return { data: cachedItem.data, cached: true };
    }

    const data = await fetchFn();
    this.cache.set(key, { data, expiry: now + this.cacheTTL });
    return { data, cached: false };
  }

  /**
   * Scorecard summary metric counts
   */
  async getSummary(forceRefresh = false) {
    return this.getOrSetCache('summary', async () => {
      // 1. Total Valuation (Average Cost)
      const valResult = await this.dataSource.query(`
        SELECT COALESCE(SUM(quantity * average_cost), 0) AS total_val 
        FROM mv_inventory_stock_valuation
      `);
      const totalValuation = Number(valResult[0].total_val);

      // 2. Count of reorder alerts
      const alertsResult = await this.dataSource.query(`
        SELECT COUNT(*) AS count 
        FROM inventory_stock 
        WHERE quantity < minimum_stock
      `);
      const activeAlerts = Number(alertsResult[0].count);

      // 3. Count of pending requisitions
      const reqsResult = await this.dataSource.query(`
        SELECT COUNT(*) AS count 
        FROM requisitions 
        WHERE status = 'PENDING'
      `);
      const pendingRequisitions = Number(reqsResult[0].count);

      // 4. Latest Closure Gross Margin
      const closureResult = await this.dataSource.query(`
        SELECT total_revenue, total_cost 
        FROM closure_logs 
        ORDER BY date_time DESC 
        LIMIT 1
      `);
      let latestClosureMargin = 0;
      if (closureResult.length > 0) {
        const rev = Number(closureResult[0].total_revenue);
        const cost = Number(closureResult[0].total_cost);
        latestClosureMargin = rev > 0 ? ((rev - cost) / rev) * 100 : 0;
      }

      // 5. Active items count in catalog
      const itemsCountResult = await this.dataSource.query(`
        SELECT COUNT(*) AS count 
        FROM inventory 
        WHERE is_active = true
      `);
      const catalogItems = Number(itemsCountResult[0].count);

      // 6. Active warehouses count
      const whResult = await this.dataSource.query(`
        SELECT COUNT(*) AS count 
        FROM warehouses 
        WHERE is_active = true OR is_active IS NULL
      `);
      const activeWarehouses = Number(whResult[0].count);

      // 7. Average Purchase Order Lead Time
      const poLeadTimeResult = await this.dataSource.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(received_at, updated_at) - created_at)) / 3600) AS avg_lead
        FROM (
          SELECT po.created_at, po.updated_at, MAX(t.created_at) AS received_at
          FROM purchase_orders po
          LEFT JOIN inventory_transactions t ON t.reference_type = 'PURCHASE_ORDER' AND t.reference_id = po.id
          WHERE po.status IN ('RECEIVED', 'COMPLETED', 'PARTIAL')
          GROUP BY po.id
        ) po_summary
      `);
      const averageLeadTimeHours = poLeadTimeResult[0].avg_lead ? Number(Number(poLeadTimeResult[0].avg_lead).toFixed(2)) : 0;

      return {
        totalValuation: Number(totalValuation.toFixed(4)),
        activeAlerts,
        pendingRequisitions,
        latestClosureMargin: Number(latestClosureMargin.toFixed(2)),
        catalogItems,
        activeWarehouses,
        averageLeadTimeHours,
      };
    }, forceRefresh);
  }

  /**
   * 1.1 Reporte de Distribución de Stock por Capa (Almacén Central vs Mini-Almacenes vs Puntos de Venta)
   */
  async getInventoryDistribution(forceRefresh = false) {
    return this.getOrSetCache('inventory-distribution', async () => {
      const rows = await this.dataSource.query(`
        SELECT * FROM mv_inventory_stock_valuation
      `);

      const layers = {
        central: {
          name: 'Capa 1: Almacén Central',
          total_items: 0,
          total_quantity: 0,
          total_value_average: 0,
          total_value_replacement: 0,
          warehouses: {} as Record<string, any>
        },
        sub_warehouse: {
          name: 'Capa 2: Mini-Almacenes / Intermedios',
          total_items: 0,
          total_quantity: 0,
          total_value_average: 0,
          total_value_replacement: 0,
          warehouses: {} as Record<string, any>
        },
        production: {
          name: 'Capa 3: Puntos de Venta / Producción',
          total_items: 0,
          total_quantity: 0,
          total_value_average: 0,
          total_value_replacement: 0,
          warehouses: {} as Record<string, any>
        }
      };

      for (const row of rows) {
        const qty = Number(row.quantity);
        const valAvg = Number(row.total_value_average);
        const valRepl = Number(row.total_value_replacement);
        const parentId = row.parent_warehouse_id;
        const type = row.warehouse_type;
        const whId = row.warehouse_id.toString();
        const whName = row.warehouse_name;

        // Classify Layer
        let targetLayerKey: 'central' | 'sub_warehouse' | 'production' = 'production';
        if (!parentId || type === 'CENTRAL') {
          targetLayerKey = 'central';
        } else if (type === 'PRODUCTION_STATION') {
          targetLayerKey = 'production';
        } else {
          targetLayerKey = 'sub_warehouse';
        }

        const currentLayer = layers[targetLayerKey];
        currentLayer.total_quantity += qty;
        currentLayer.total_value_average += valAvg;
        currentLayer.total_value_replacement += valRepl;

        if (!currentLayer.warehouses[whId]) {
          currentLayer.warehouses[whId] = {
            id: Number(whId),
            name: whName,
            type: type,
            distinct_skus: new Set<string>(),
            total_quantity: 0,
            total_value_average: 0,
            total_value_replacement: 0
          };
        }

        const whObj = currentLayer.warehouses[whId];
        whObj.distinct_skus.add(row.sku);
        whObj.total_quantity += qty;
        whObj.total_value_average += valAvg;
        whObj.total_value_replacement += valRepl;
      }

      // Format output maps to arrays
      return Object.keys(layers).map(key => {
        const layer = layers[key];
        const formattedWarehouses = Object.values(layer.warehouses).map((wh: any) => ({
          id: wh.id,
          name: wh.name,
          type: wh.type,
          item_count: wh.distinct_skus.size,
          total_quantity: Number(wh.total_quantity.toFixed(4)),
          total_value_average: Number(wh.total_value_average.toFixed(4)),
          total_value_replacement: Number(wh.total_value_replacement.toFixed(4))
        }));

        const totalItems = formattedWarehouses.reduce((sum, wh) => sum + wh.item_count, 0);

        return {
          layer_key: key,
          layer_name: layer.name,
          total_items: totalItems,
          total_quantity: Number(layer.total_quantity.toFixed(4)),
          total_value_average: Number(layer.total_value_average.toFixed(4)),
          total_value_replacement: Number(layer.total_value_replacement.toFixed(4)),
          warehouses: formattedWarehouses
        };
      });
    }, forceRefresh);
  }

  /**
   * 1.2 Reporte de Alertas de Reposición (Reorder Point) with surplus suggestions
   */
  async getReorderAlerts(forceRefresh = false) {
    return this.getOrSetCache('reorder-alerts', async () => {
      // Find all stock below minimum
      const stockAlerts = await this.dataSource.query(`
        SELECT 
          s.id AS stock_id,
          s.inventory_id AS inventory_id,
          s.warehouse_id AS warehouse_id,
          s.quantity AS quantity,
          s.minimum_stock AS minimum_stock,
          i.sku AS sku,
          i.name AS inventory_name,
          w.name AS warehouse_name,
          u.abbreviation AS uom_abbr
        FROM inventory_stock s
        JOIN inventory i ON s.inventory_id = i.id
        JOIN warehouses w ON s.warehouse_id = w.id
        LEFT JOIN units_of_measure u ON i.uom_id = u.id
        WHERE s.quantity < s.minimum_stock AND i.is_active = true
        ORDER BY (s.minimum_stock - s.quantity) DESC
      `);

      // Find potential warehouses with excess stock
      const allStock = await this.dataSource.query(`
        SELECT 
          s.inventory_id,
          s.warehouse_id,
          w.name AS warehouse_name,
          s.quantity,
          s.minimum_stock,
          (s.quantity - s.minimum_stock) AS surplus
        FROM inventory_stock s
        JOIN warehouses w ON s.warehouse_id = w.id
        WHERE s.quantity > s.minimum_stock
      `);

      const surplusMap = new Map<number, Array<{ warehouse_id: number; warehouse_name: string; surplus: number }>>();
      for (const st of allStock) {
        const invId = Number(st.inventory_id);
        let list = surplusMap.get(invId);
        if (!list) {
          list = [];
          surplusMap.set(invId, list);
        }
        list.push({
          warehouse_id: Number(st.warehouse_id),
          warehouse_name: st.warehouse_name,
          surplus: Number(st.surplus)
        });
      }

      return stockAlerts.map(alert => {
        const invId = Number(alert.inventory_id);
        const qty = Number(alert.quantity);
        const minStock = Number(alert.minimum_stock);
        const deficit = minStock - qty;

        const options = surplusMap.get(invId) || [];
        // Sort options by surplus descending
        const sortedOptions = options.sort((a, b) => b.surplus - a.surplus);
        
        let suggestion: any = null;
        if (sortedOptions.length > 0) {
          const source = sortedOptions[0];
          suggestion = {
            source_warehouse_id: source.warehouse_id,
            source_warehouse_name: source.warehouse_name,
            available_surplus: Number(source.surplus.toFixed(4)),
            suggested_transfer_qty: Number(Math.min(deficit, source.surplus).toFixed(4))
          };
        }

        return {
          stock_id: Number(alert.stock_id),
          inventory_id: invId,
          sku: alert.sku,
          inventory_name: alert.inventory_name,
          warehouse_id: Number(alert.warehouse_id),
          warehouse_name: alert.warehouse_name,
          uom: alert.uom_abbr || 'und',
          current_stock: Number(qty.toFixed(4)),
          minimum_stock: Number(minStock.toFixed(4)),
          deficit: Number(deficit.toFixed(4)),
          suggested_requisition: suggestion
        };
      });
    }, forceRefresh);
  }

  /**
   * 1.3 Reporte de Discrepancias en Transferencias
   */
  async getTransferDiscrepancies(forceRefresh = false) {
    return this.getOrSetCache('transfer-discrepancies', async () => {
      const items = await this.dataSource.query(`
        SELECT 
          t.id AS transfer_id,
          t.transfer_number AS transfer_number,
          fw.name AS from_warehouse_name,
          tw.name AS to_warehouse_name,
          t.dispatched_at AS dispatched_at,
          t.received_at AS received_at,
          u_disp.name AS dispatched_by_name,
          u_recv.name AS received_by_name,
          ti.id AS item_id,
          i.sku AS sku,
          i.name AS product_name,
          ti.quantity_shipped AS quantity_shipped,
          ti.quantity_received AS quantity_received,
          (ti.quantity_shipped - ti.quantity_received) AS discrepancy
        FROM inventory_transfers t
        JOIN inventory_transfer_items ti ON t.id = ti.transfer_id
        JOIN inventory i ON ti.inventory_id = i.id
        JOIN warehouses fw ON t.from_warehouse_id = fw.id
        JOIN warehouses tw ON t.to_warehouse_id = tw.id
        LEFT JOIN users u_disp ON t.dispatched_by = u_disp.id
        LEFT JOIN users u_recv ON t.received_by = u_recv.id
        WHERE t.status = 'COMPLETED' AND (ti.quantity_shipped - ti.quantity_received) > 0
        ORDER BY t.received_at DESC
      `);

      const transfersMap = new Map<number, any>();

      for (const row of items) {
        const tId = Number(row.transfer_id);
        const qtyShipped = Number(row.quantity_shipped);
        const qtyReceived = Number(row.quantity_received);
        const disc = Number(row.discrepancy);

        let trans = transfersMap.get(tId);
        if (!trans) {
          trans = {
            transfer_id: tId,
            transfer_number: row.transfer_number,
            from_warehouse: row.from_warehouse_name,
            to_warehouse: row.to_warehouse_name,
            dispatched_at: row.dispatched_at,
            received_at: row.received_at,
            dispatched_by: row.dispatched_by_name || 'Sistema',
            received_by: row.received_by_name || 'Sistema',
            total_items_with_discrepancy: 0,
            total_shipped: 0,
            total_received: 0,
            total_discrepancy: 0,
            items: []
          };
          transfersMap.set(tId, trans);
        }

        trans.total_items_with_discrepancy += 1;
        trans.total_shipped += qtyShipped;
        trans.total_received += qtyReceived;
        trans.total_discrepancy += disc;

        trans.items.push({
          item_id: Number(row.item_id),
          sku: row.sku,
          product_name: row.product_name,
          quantity_shipped: qtyShipped,
          quantity_received: qtyReceived,
          discrepancy: disc,
          discrepancy_percentage: qtyShipped > 0 ? Number(((disc / qtyShipped) * 100).toFixed(2)) : 0
        });
      }

      // Convert to array and enrich totals
      return Array.from(transfersMap.values()).map(t => {
        t.total_shipped = Number(t.total_shipped.toFixed(4));
        t.total_received = Number(t.total_received.toFixed(4));
        t.total_discrepancy = Number(t.total_discrepancy.toFixed(4));
        t.merma_percentage = t.total_shipped > 0 ? Number(((t.total_discrepancy / t.total_shipped) * 100).toFixed(2)) : 0;
        return t;
      });
    }, forceRefresh);
  }

  /**
   * 2.1 Dashboard de Cierres de Caja y Márgenes (Daily Snapshot)
   */
  async getFinancials(forceRefresh = false) {
    return this.getOrSetCache('financials', async () => {
      const closures = await this.dataSource.query(`
        SELECT 
          id,
          date_time,
          total_revenue,
          total_cost,
          week
        FROM closure_logs
        ORDER BY date_time ASC
        LIMIT 30
      `);

      let aggregateRevenue = 0;
      let aggregateCost = 0;

      const items = closures.map(c => {
        const rev = Number(c.total_revenue || 0);
        const cost = Number(c.total_cost || 0);
        const profit = rev - cost;
        const margin = rev > 0 ? (profit / rev) * 100 : 0;

        aggregateRevenue += rev;
        aggregateCost += cost;

        return {
          id: c.id,
          date_time: c.date_time,
          total_revenue: Number(rev.toFixed(4)),
          total_cost: Number(cost.toFixed(4)),
          gross_profit: Number(profit.toFixed(4)),
          gross_margin: Number(margin.toFixed(2)),
          week: c.week
        };
      });

      const aggregateProfit = aggregateRevenue - aggregateCost;
      const aggregateMargin = aggregateRevenue > 0 ? (aggregateProfit / aggregateRevenue) * 100 : 0;

      return {
        aggregate: {
          period_total_revenue: Number(aggregateRevenue.toFixed(4)),
          period_total_cost: Number(aggregateCost.toFixed(4)),
          period_gross_profit: Number(aggregateProfit.toFixed(4)),
          period_average_margin: Number(aggregateMargin.toFixed(2))
        },
        closures_trend: items
      };
    }, forceRefresh);
  }

  /**
   * 2.2 Valoración de Inventario en Tiempo Real (Grouped by warehouse & category)
   */
  async getValuation(forceRefresh = false) {
    return this.getOrSetCache('valuation', async () => {
      // 1. Overall Valuation Totals
      const totalResult = await this.dataSource.query(`
        SELECT 
          COALESCE(SUM(quantity * average_cost), 0) AS avg_val,
          COALESCE(SUM(quantity * last_cost), 0) AS last_val,
          COALESCE(SUM(quantity * replacement_cost), 0) AS repl_val,
          COALESCE(SUM(quantity), 0) AS total_qty
        FROM mv_inventory_stock_valuation
      `);

      // 2. Valuation Grouped by Category
      const categoryResult = await this.dataSource.query(`
        SELECT 
          COALESCE(c.name, 'Sin Categoría') AS category_name,
          SUM(mv.quantity * mv.average_cost) AS total_value_average,
          SUM(mv.quantity * mv.last_cost) AS total_value_last,
          SUM(mv.quantity * mv.replacement_cost) AS total_value_replacement,
          COUNT(DISTINCT mv.inventory_id) AS distinct_items,
          SUM(mv.quantity) AS total_quantity
        FROM mv_inventory_stock_valuation mv
        JOIN inventory i ON mv.inventory_id = i.id
        LEFT JOIN categories c ON i.category_id = c.id
        GROUP BY c.name
        ORDER BY total_value_average DESC
      `);

      // 3. Valuation Grouped by Warehouse
      const warehouseResult = await this.dataSource.query(`
        SELECT 
          warehouse_id,
          warehouse_name,
          SUM(quantity * average_cost) AS total_value_average,
          SUM(quantity * last_cost) AS total_value_last,
          SUM(quantity * replacement_cost) AS total_value_replacement,
          COUNT(DISTINCT inventory_id) AS distinct_items,
          SUM(quantity) AS total_quantity
        FROM mv_inventory_stock_valuation
        GROUP BY warehouse_id, warehouse_name
        ORDER BY total_value_average DESC
      `);

      return {
        totals: {
          valuation_average: Number(Number(totalResult[0].avg_val).toFixed(4)),
          valuation_last: Number(Number(totalResult[0].last_val).toFixed(4)),
          valuation_replacement: Number(Number(totalResult[0].repl_val).toFixed(4)),
          total_stock_quantity: Number(Number(totalResult[0].total_qty).toFixed(4))
        },
        by_category: categoryResult.map(cat => ({
          category_name: cat.category_name,
          distinct_items: Number(cat.distinct_items),
          total_quantity: Number(Number(cat.total_quantity).toFixed(4)),
          value_average: Number(Number(cat.total_value_average).toFixed(4)),
          value_last: Number(Number(cat.total_value_last).toFixed(4)),
          value_replacement: Number(Number(cat.total_value_replacement).toFixed(4))
        })),
        by_warehouse: warehouseResult.map(wh => ({
          warehouse_id: Number(wh.warehouse_id),
          warehouse_name: wh.warehouse_name,
          distinct_items: Number(wh.distinct_items),
          total_quantity: Number(Number(wh.total_quantity).toFixed(4)),
          value_average: Number(Number(wh.total_value_average).toFixed(4)),
          value_last: Number(Number(wh.total_value_last).toFixed(4)),
          value_replacement: Number(Number(wh.total_value_replacement).toFixed(4))
        }))
      };
    }, forceRefresh);
  }

  /**
   * 2.3 Análisis de Costos de Recetas/Productos (Ingredients component costs fluctuation)
   */
  async getRecipeCosts(forceRefresh = false) {
    return this.getOrSetCache('recipe-costs', async () => {
      // Get all recipes
      const ingredients = await this.dataSource.query(`
        SELECT id, name, code, categorie, items FROM ingredients
      `);

      // Load all product costs into an in-memory lookup map
      const inventoryCosts = await this.dataSource.query(`
        SELECT 
          i.id,
          i.name,
          i.reference_cost,
          COALESCE(ic.replacement_cost, i.reference_cost, 0) AS replacement_cost,
          COALESCE(ic.average_cost, i.reference_cost, 0) AS average_cost,
          COALESCE(ic.last_cost, i.reference_cost, 0) AS last_cost
        FROM inventory i
        LEFT JOIN inventory_costs ic ON i.id = ic.inventory_id
      `);

      const costLookup = new Map<number, any>();
      for (const ic of inventoryCosts) {
        costLookup.set(Number(ic.id), {
          name: ic.name,
          reference: Number(ic.reference_cost),
          replacement: Number(ic.replacement_cost),
          average: Number(ic.average_cost),
          last: Number(ic.last_cost)
        });
      }

      const list: any[] = [];

      for (const recipe of ingredients) {
        const recipeItems = Array.isArray(recipe.items) ? recipe.items : [];
        let costReference = 0;
        let costReplacement = 0;
        let costAverage = 0;
        let costLast = 0;
        const details: any[] = [];

        for (const item of recipeItems) {
          const invId = Number(item.inventory_id);
          const qty = Number(item.quantity || 0);
          const lookup = costLookup.get(invId);

          if (lookup) {
            const refPart = qty * lookup.reference;
            const replPart = qty * lookup.replacement;
            const avgPart = qty * lookup.average;
            const lastPart = qty * lookup.last;

            costReference += refPart;
            costReplacement += replPart;
            costAverage += avgPart;
            costLast += lastPart;

            details.push({
              inventory_id: invId,
              name: lookup.name,
              quantity: qty,
              unit: item.unit || 'und',
              reference_cost: lookup.reference,
              replacement_cost: lookup.replacement,
              average_cost: lookup.average,
              total_reference: Number(refPart.toFixed(4)),
              total_replacement: Number(replPart.toFixed(4))
            });
          }
        }

        const fluctuation = costReference > 0 ? ((costReplacement - costReference) / costReference) * 100 : 0;
        const fluctuationVsAverage = costAverage > 0 ? ((costReplacement - costAverage) / costAverage) * 100 : 0;

        // Trigger alert if replacement cost is over 5% higher than reference cost
        const alert = costReplacement > costReference * 1.05;

        list.push({
          id: Number(recipe.id),
          name: recipe.name,
          code: recipe.code,
          category: recipe.categorie,
          cost_reference: Number(costReference.toFixed(4)),
          cost_replacement: Number(costReplacement.toFixed(4)),
          cost_average: Number(costAverage.toFixed(4)),
          cost_last: Number(costLast.toFixed(4)),
          fluctuation_percentage: Number(fluctuation.toFixed(2)),
          fluctuation_vs_average_percentage: Number(fluctuationVsAverage.toFixed(2)),
          alert,
          components_count: details.length,
          components: details
        });
      }

      // Sort by fluctuation percentage descending to highlight high-risk recipes first
      return list.sort((a, b) => b.fluctuation_percentage - a.fluctuation_percentage);
    }, forceRefresh);
  }

  /**
   * 3.1 Trazabilidad y Cumplimiento de Órdenes de Compra (PO Lead Time & Quantity Compliance)
   */
  async getSourcingCompliance(forceRefresh = false) {
    return this.getOrSetCache('sourcing-compliance', async () => {
      const orders = await this.dataSource.query(`
        SELECT 
          po.id AS id,
          po.purchase_order_number AS purchase_order_number,
          po.supplier_name AS supplier_name,
          po.status AS status,
          po.total_amount AS total_amount,
          po.created_at AS created_at,
          po.updated_at AS updated_at,
          (
            SELECT COALESCE(MAX(t.created_at), po.updated_at) 
            FROM inventory_transactions t 
            WHERE t.reference_type = 'PURCHASE_ORDER' AND t.reference_id = po.id
          ) AS received_at,
          (
            SELECT SUM(pod.quantity) 
            FROM purchase_order_details pod 
            WHERE pod.purchase_order_id = po.id
          ) AS quantity_requested,
          (
            SELECT COALESCE(SUM(t.quantity), 0) 
            FROM inventory_transactions t 
            WHERE t.reference_type = 'PURCHASE_ORDER' AND t.reference_id = po.id
          ) AS quantity_received
        FROM purchase_orders po
        ORDER BY po.created_at DESC
      `);

      let totalLeadTimeHours = 0;
      let receivedOrdersCount = 0;
      let totalQtyRequested = 0;
      let totalQtyReceived = 0;

      const formattedOrders = orders.map(o => {
        const qtyReq = Number(o.quantity_requested || 0);
        const qtyRec = Number(o.quantity_received || 0);
        const createdAt = new Date(o.created_at);
        
        let leadTimeHours: number | null = null;
        if (o.status === 'RECEIVED' || o.status === 'COMPLETED' || o.status === 'PARTIAL') {
          const receivedAt = o.received_at ? new Date(o.received_at) : new Date(o.updated_at);
          const timeDiffMs = receivedAt.getTime() - createdAt.getTime();
          leadTimeHours = Number((timeDiffMs / (1000 * 60 * 60)).toFixed(2));
          
          totalLeadTimeHours += leadTimeHours;
          receivedOrdersCount++;
          
          totalQtyRequested += qtyReq;
          totalQtyReceived += qtyRec;
        }

        return {
          id: Number(o.id),
          purchase_order_number: o.purchase_order_number,
          supplier_name: o.supplier_name,
          status: o.status,
          total_amount: Number(Number(o.total_amount).toFixed(4)),
          created_at: o.created_at,
          received_at: (o.status === 'RECEIVED' || o.status === 'COMPLETED' || o.status === 'PARTIAL') ? o.received_at : null,
          quantity_requested: qtyReq,
          quantity_received: qtyRec,
          fulfillment_rate: qtyReq > 0 ? Number(((qtyRec / qtyReq) * 100).toFixed(2)) : 0,
          lead_time_hours: leadTimeHours
        };
      });

      const avgLeadTimeHours = receivedOrdersCount > 0 ? Number((totalLeadTimeHours / receivedOrdersCount).toFixed(2)) : 0;
      const globalFulfillmentRate = totalQtyRequested > 0 ? Number(((totalQtyReceived / totalQtyRequested) * 100).toFixed(2)) : 0;

      return {
        summary: {
          total_orders: orders.length,
          received_orders: receivedOrdersCount,
          average_lead_time_hours: avgLeadTimeHours,
          global_fulfillment_rate: globalFulfillmentRate
        },
        orders: formattedOrders
      };
    }, forceRefresh);
  }

  /**
   * 3.2 Cuello de Botella de Requisiciones (Requisition to Transfer Lead Times)
   */
  async getRequisitionBottlenecks(forceRefresh = false) {
    return this.getOrSetCache('requisition-bottlenecks', async () => {
      const flows = await this.dataSource.query(`
        SELECT 
          r.id AS id,
          r.requisition_number AS requisition_number,
          sw.name AS source_warehouse_name,
          dw.name AS destination_warehouse_name,
          r.status AS status,
          r.created_at AS created_at,
          t.transfer_number AS transfer_number,
          t.dispatched_at AS dispatched_at,
          t.status AS transfer_status
        FROM requisitions r
        JOIN inventory_transfers t ON t.requisition_id = r.id
        ORDER BY r.created_at DESC
      `);

      let totalDispatchTimeHours = 0;
      let count = 0;

      const list = flows.map(f => {
        const reqCreated = new Date(f.created_at);
        const transDispatched = new Date(f.dispatched_at);
        const diffMs = transDispatched.getTime() - reqCreated.getTime();
        const hours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));

        totalDispatchTimeHours += hours;
        count++;

        return {
          requisition_id: Number(f.id),
          requisition_number: f.requisition_number,
          source_warehouse: f.source_warehouse_name,
          destination_warehouse: f.destination_warehouse_name,
          requisition_status: f.status,
          created_at: f.created_at,
          transfer_number: f.transfer_number,
          dispatched_at: f.dispatched_at,
          transfer_status: f.transfer_status,
          dispatch_time_hours: hours
        };
      });

      const avgDispatchTimeHours = count > 0 ? Number((totalDispatchTimeHours / count).toFixed(2)) : 0;

      return {
        average_dispatch_time_hours: avgDispatchTimeHours,
        total_requisitions_linked: count,
        flows: list
      };
    }, forceRefresh);
  }

  /**
   * 4.1 Matriz de Movimientos por Usuario (Auditoría)
   */
  async getUserAudit(forceRefresh = false) {
    return this.getOrSetCache('user-audit', async () => {
      const dbRows = await this.dataSource.query(`
        SELECT 
          u.id AS user_id,
          u.name AS user_name,
          u.username AS username,
          u.charge AS charge,
          t.transaction_type AS transaction_type,
          COUNT(t.id) AS transaction_count,
          SUM(t.quantity) AS transaction_quantity
        FROM users u
        JOIN inventory_transactions t ON t.created_by = u.id
        GROUP BY u.id, u.name, u.username, u.charge, t.transaction_type
        ORDER BY u.name ASC
      `);

      const usersMap = new Map<number, any>();

      for (const row of dbRows) {
        const uId = Number(row.user_id);
        let user = usersMap.get(uId);
        if (!user) {
          user = {
            user_id: uId,
            name: row.user_name || 'N/A',
            username: row.username || 'N/A',
            charge: row.charge || 'Operador',
            total_transactions_count: 0,
            total_items_quantity: 0,
            activity_matrix: {
              IN: { count: 0, quantity: 0 },
              OUT: { count: 0, quantity: 0 },
              TRANSFER: { count: 0, quantity: 0 },
              ADJUSTMENT: { count: 0, quantity: 0 }
            }
          };
          usersMap.set(uId, user);
        }

        const type = row.transaction_type as 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
        const cnt = Number(row.transaction_count);
        const qty = Number(row.transaction_quantity);

        user.total_transactions_count += cnt;
        user.total_items_quantity += qty;

        if (user.activity_matrix[type]) {
          user.activity_matrix[type].count = cnt;
          user.activity_matrix[type].quantity = Number(qty.toFixed(4));
        }
      }

      return Array.from(usersMap.values()).map(user => {
        user.total_items_quantity = Number(user.total_items_quantity.toFixed(4));
        return user;
      });
    }, forceRefresh);
  }

  /**
   * 4.2 Trazabilidad de Lotes y Operaciones (Transaction Audit Trail)
   */
  async getTraceability(inventoryId?: number) {
    // Audit trails are queried in real-time bypassing the general cache because audit actions should update instantly
    const params: any[] = [];
    let query = `
      SELECT 
        t.id AS transaction_id,
        t.created_at AS created_at,
        t.transaction_type AS transaction_type,
        t.quantity AS quantity,
        t.reference_type AS reference_type,
        t.reference_id AS reference_id,
        i.sku AS sku,
        i.name AS product_name,
        w.name AS warehouse_name,
        u.name AS user_name
      FROM inventory_transactions t
      JOIN inventory i ON t.inventory_id = i.id
      JOIN warehouses w ON t.warehouse_id = w.id
      LEFT JOIN users u ON t.created_by = u.id
    `;

    if (inventoryId) {
      query += ` WHERE t.inventory_id = $1`;
      params.push(inventoryId);
    }

    query += ` ORDER BY t.created_at DESC LIMIT 100`;

    const list = await this.dataSource.query(query, params);
    
    return list.map(item => ({
      transaction_id: Number(item.transaction_id),
      created_at: item.created_at,
      transaction_type: item.transaction_type,
      quantity: Number(Number(item.quantity).toFixed(4)),
      sku: item.sku,
      product_name: item.product_name,
      warehouse_name: item.warehouse_name,
      user_name: item.user_name || 'Sistema',
      reference: item.reference_type ? {
        type: item.reference_type,
        id: Number(item.reference_id)
      } : null
    }));
  }

  async getNewMetrics() {
    const rawMetrics = await this.dataSource.getRepository(History)
      .createQueryBuilder('h')
      .select('COUNT(h.id)', 'totalTransactions')
      .addSelect('SUM(CAST(h.quantity AS numeric))', 'accumulatedQuantity')
      .addSelect('SUM(CAST(h.totalCost AS numeric))', 'totalCostValue')
      .where("h.createdAt >= DATE_TRUNC('week', CURRENT_DATE)")
      .getRawOne();

    return {
      totalTransactions: parseInt(rawMetrics.totalTransactions || '0', 10),
      accumulatedQuantity: parseFloat(rawMetrics.accumulatedQuantity || '0'),
      totalCostValue: parseFloat(rawMetrics.totalCostValue || '0'),
    };
  }

  async getNewCharts() {
    // Chart 1: Volume of Transactions by Warehouse (Cocina vs Almacen)
    const rawVolume = await this.dataSource.getRepository(History)
      .createQueryBuilder('h')
      .leftJoin('h.warehouse', 'w')
      .select('w.name', 'warehouseName')
      .addSelect('w.warehouseType', 'warehouseType')
      .addSelect('COUNT(h.id)', 'count')
      .where("h.createdAt >= DATE_TRUNC('week', CURRENT_DATE)")
      .groupBy('w.id')
      .addGroupBy('w.name')
      .addGroupBy('w.warehouseType')
      .getRawMany();

    let cocinaCount = 0;
    let almacenCount = 0;
    const chart1Details = rawVolume.map(v => {
      const count = parseInt(v.count || '0', 10);
      const isCocina = v.warehouseType === 'PRODUCTION_STATION' || 
                        v.warehouseType === 'POINT_OF_SALE' || 
                        String(v.warehouseName).toLowerCase().includes('cocina');
      if (isCocina) {
        cocinaCount += count;
      } else {
        almacenCount += count;
      }
      return {
        warehouseName: v.warehouseName,
        warehouseType: v.warehouseType,
        count,
        category: isCocina ? 'Cocina' : 'Almacen'
      };
    });

    const totalVolume = cocinaCount + almacenCount || 1;
    const chart1 = [
      { area: 'Cocina', count: cocinaCount, percentage: parseFloat(((cocinaCount / totalVolume) * 100).toFixed(2)) },
      { area: 'Almacen', count: almacenCount, percentage: parseFloat(((almacenCount / totalVolume) * 100).toFixed(2)) }
    ];

    // Chart 2: Inflow vs Outflow by Warehouse (Grouped Bars) - Valued in Currency
    const rawTransfers = await this.dataSource.getRepository(History)
      .createQueryBuilder('h')
      .leftJoin('h.warehouse', 'w')
      .select('w.name', 'warehouseName')
      .addSelect('h.movementType', 'movementType')
      .addSelect('SUM(CAST(h.totalCost AS numeric))', 'totalValue')
      .where('h.movementType IN (:...types)', { types: ['TRANSFER_IN', 'TRANSFER_OUT'] })
      .andWhere("h.createdAt >= DATE_TRUNC('week', CURRENT_DATE)")
      .groupBy('w.id')
      .addGroupBy('w.name')
      .addGroupBy('h.movementType')
      .getRawMany();

    const transfersMap = new Map<string, { warehouseName: string; entries: number; exits: number }>();
    rawTransfers.forEach(t => {
      const whName = t.warehouseName || 'Desconocido';
      const val = parseFloat(t.totalValue || '0');
      if (!transfersMap.has(whName)) {
        transfersMap.set(whName, { warehouseName: whName, entries: 0, exits: 0 });
      }
      const record = transfersMap.get(whName)!;
      if (t.movementType === 'TRANSFER_IN') {
        record.entries = val;
      } else if (t.movementType === 'TRANSFER_OUT') {
        record.exits = val;
      }
    });
    const chart2 = Array.from(transfersMap.values());

    // Chart 3: Operating Performance (Ventas vs Mermas)
    // Sales sum from items -> 'Venta Neta' in the sales table (strictly manual entry)
    const rawSales = await this.dataSource.getRepository(Sale)
      .createQueryBuilder('s')
      .select("SUM(CAST(COALESCE(s.items->>'Venta Neta', '0') AS numeric))", 'totalSales')
      .where("s.createdAt >= DATE_TRUNC('week', CURRENT_DATE)")
      .getRawOne();
    
    // Mermas sum from totalCost of DECREASE in History
    const rawMermas = await this.dataSource.getRepository(History)
      .createQueryBuilder('h')
      .select('SUM(CAST(h.totalCost AS numeric))', 'totalMermas')
      .where("h.movementType = 'DECREASE'")
      .andWhere("h.createdAt >= DATE_TRUNC('week', CURRENT_DATE)")
      .getRawOne();

    const totalSalesVal = parseFloat(rawSales?.totalSales || '0');
    const totalMermasVal = parseFloat(rawMermas?.totalMermas || '0');
    const totalPerformance = totalSalesVal + totalMermasVal || 1;

    const chart3 = {
      salesValue: totalSalesVal,
      mermasValue: totalMermasVal,
      salesPercentage: parseFloat(((totalSalesVal / totalPerformance) * 100).toFixed(2)),
      mermasPercentage: parseFloat(((totalMermasVal / totalPerformance) * 100).toFixed(2))
    };

    // New additions: topProducts (weekly) and sales vs mermas comparisons (weekly & monthly)
    let topProducts = [];
    let comparison = {
      sales_qty_this_week: 0,
      sales_val_this_week: 0,
      sales_qty_last_week: 0,
      sales_val_last_week: 0,
      sales_qty_this_month: 0,
      sales_val_this_month: 0,
      sales_qty_last_month: 0,
      sales_val_last_month: 0,
      mermas_qty_this_week: 0,
      mermas_val_this_week: 0,
      mermas_qty_last_week: 0,
      mermas_val_last_week: 0,
      mermas_qty_this_month: 0,
      mermas_val_this_month: 0,
      mermas_qty_last_month: 0,
      mermas_val_last_month: 0
    };

    try {
      const topProductsResult = await this.dataSource.query(`
        SELECT 
          i.id AS id,
          i.name AS name,
          i.code AS code,
          COALESCE(SUM(s.quantity), 0)::float AS quantity_sold,
          COALESCE(SUM(CAST(COALESCE(s.items->>'Venta Neta', '0') AS numeric)), 0)::float AS total_revenue
        FROM sales s
        JOIN ingredients i ON s.ingredient_id = i.id
        WHERE s.created_at >= DATE_TRUNC('week', CURRENT_DATE)
        GROUP BY i.id, i.name, i.code
        ORDER BY quantity_sold DESC
        LIMIT 10
      `);
      if (topProductsResult && topProductsResult.length > 0) {
        topProducts = topProductsResult;
      } else {
        // Fallback to all time if this week is empty (for demo environments)
        topProducts = await this.dataSource.query(`
          SELECT 
            i.id AS id,
            i.name AS name,
            i.code AS code,
            COALESCE(SUM(s.quantity), 0)::float AS quantity_sold,
            COALESCE(SUM(CAST(COALESCE(s.items->>'Venta Neta', '0') AS numeric)), 0)::float AS total_revenue
          FROM sales s
          JOIN ingredients i ON s.ingredient_id = i.id
          GROUP BY i.id, i.name, i.code
          ORDER BY quantity_sold DESC
          LIMIT 10
        `);
      }
    } catch (e) {
      this.logger.error('Error fetching top weekly products:', e);
    }

    try {
      const salesRes = await this.dataSource.query(`
        SELECT
          COALESCE(SUM(CASE WHEN s.created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN s.quantity ELSE 0 END), 0)::float AS sales_qty_this_week,
          COALESCE(SUM(CASE WHEN s.created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN CAST(COALESCE(s.items->>'Venta Neta', '0') AS numeric) ELSE 0 END), 0)::float AS sales_val_this_week,
          
          COALESCE(SUM(CASE WHEN s.created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND s.created_at < DATE_TRUNC('week', CURRENT_DATE) THEN s.quantity ELSE 0 END), 0)::float AS sales_qty_last_week,
          COALESCE(SUM(CASE WHEN s.created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND s.created_at < DATE_TRUNC('week', CURRENT_DATE) THEN CAST(COALESCE(s.items->>'Venta Neta', '0') AS numeric) ELSE 0 END), 0)::float AS sales_val_last_week,
          
          COALESCE(SUM(CASE WHEN s.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN s.quantity ELSE 0 END), 0)::float AS sales_qty_this_month,
          COALESCE(SUM(CASE WHEN s.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN CAST(COALESCE(s.items->>'Venta Neta', '0') AS numeric) ELSE 0 END), 0)::float AS sales_val_this_month,
          
          COALESCE(SUM(CASE WHEN s.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND s.created_at < DATE_TRUNC('month', CURRENT_DATE) THEN s.quantity ELSE 0 END), 0)::float AS sales_qty_last_month,
          COALESCE(SUM(CASE WHEN s.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND s.created_at < DATE_TRUNC('month', CURRENT_DATE) THEN CAST(COALESCE(s.items->>'Venta Neta', '0') AS numeric) ELSE 0 END), 0)::float AS sales_val_last_month
        FROM sales s
      `);

      const mermasRes = await this.dataSource.query(`
        SELECT
          COALESCE(SUM(CASE WHEN h.created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN h.quantity ELSE 0 END), 0)::float AS mermas_qty_this_week,
          COALESCE(SUM(CASE WHEN h.created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN CAST(h.total_cost AS numeric) ELSE 0 END), 0)::float AS mermas_val_this_week,
          
          COALESCE(SUM(CASE WHEN h.created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND h.created_at < DATE_TRUNC('week', CURRENT_DATE) THEN h.quantity ELSE 0 END), 0)::float AS mermas_qty_last_week,
          COALESCE(SUM(CASE WHEN h.created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND h.created_at < DATE_TRUNC('week', CURRENT_DATE) THEN CAST(h.total_cost AS numeric) ELSE 0 END), 0)::float AS mermas_val_last_week,
          
          COALESCE(SUM(CASE WHEN h.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN h.quantity ELSE 0 END), 0)::float AS mermas_qty_this_month,
          COALESCE(SUM(CASE WHEN h.created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN CAST(h.total_cost AS numeric) ELSE 0 END), 0)::float AS mermas_val_this_month,
          
          COALESCE(SUM(CASE WHEN h.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND h.created_at < DATE_TRUNC('month', CURRENT_DATE) THEN h.quantity ELSE 0 END), 0)::float AS mermas_qty_last_month,
          COALESCE(SUM(CASE WHEN h.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND h.created_at < DATE_TRUNC('month', CURRENT_DATE) THEN CAST(h.total_cost AS numeric) ELSE 0 END), 0)::float AS mermas_val_last_month
        FROM history h
        WHERE h.movement_type = 'DECREASE'
      `);

      if (salesRes && salesRes[0] && mermasRes && mermasRes[0]) {
        comparison = {
          ...salesRes[0],
          ...mermasRes[0]
        };
      }
    } catch (e) {
      this.logger.error('Error fetching weekly/monthly comparisons:', e);
    }

    return {
      chart1,
      chart1Details,
      chart2,
      chart3,
      topProducts,
      comparison
    };
  }

  async getNewTraceability(page: number, limit: number) {
    const queryBuilder = this.dataSource.getRepository(History)
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.inventory', 'inventory')
      .leftJoinAndSelect('h.warehouse', 'warehouse')
      .leftJoinAndSelect('h.createdBy', 'createdBy')
      .where("h.createdAt >= DATE_TRUNC('week', CURRENT_DATE)")
      .orderBy('h.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [historyItems, total] = await Promise.all([
      queryBuilder.getMany(),
      queryBuilder.getCount()
    ]);

    const combinations = historyItems.map(item => ({
      inventoryId: Number(item.inventory?.id),
      warehouseId: Number(item.warehouse?.id)
    })).filter(c => c.inventoryId && c.warehouseId);

    const stockMap = new Map<string, any>();
    if (combinations.length > 0) {
      // Deduplicate conditions
      const uniqueCombs = Array.from(new Set(combinations.map(c => `${c.inventoryId}_${c.warehouseId}`)))
        .map(key => {
          const [invId, whId] = key.split('_');
          return { inventoryId: parseInt(invId), warehouseId: parseInt(whId) };
        });

      const conditions = uniqueCombs.map(c => `(s.inventory_id = ${c.inventoryId} AND s.warehouse_id = ${c.warehouseId})`).join(' OR ');
      const stocks = await this.dataSource.query(`
        SELECT s.inventory_id, s.warehouse_id, s.quantity, s.minimum_stock, s.projected_daily_demand, s.projected_weekly_demand, s.projected_production
        FROM inventory_stock s
        WHERE ${conditions}
      `);

      stocks.forEach((st: any) => {
        const key = `${st.inventory_id}_${st.warehouse_id}`;
        stockMap.set(key, {
          quantity: parseFloat(st.quantity || '0'),
          minimumStock: parseFloat(st.minimum_stock || '0'),
          projectedDailyDemand: parseFloat(st.projected_daily_demand || '0'),
          projectedWeeklyDemand: parseFloat(st.projected_weekly_demand || '0'),
          projectedProduction: parseFloat(st.projected_production || '0')
        });
      });
    }

    const items = historyItems.map(item => {
      const invId = item.inventory?.id;
      const whId = item.warehouse?.id;
      const stock = stockMap.get(`${invId}_${whId}`);

      let day_stock = 0;
      let days_to_critical = 0;
      let alertSeverity = 'NORMAL';

      if (stock && item.inventory?.tracks_inventory) {
        const stockActual = stock.quantity;
        const projectedDailyDemand = stock.projectedDailyDemand;
        const projectedWeeklyDemand = stock.projectedWeeklyDemand;
        const projectedProduction = stock.projectedProduction;
        const minimumStock = stock.minimumStock;
        const isCentral = item.warehouse?.warehouseType === 'CENTRAL';

        // Daily demand definition based on alerts.service.ts
        let dailyDemand = projectedDailyDemand > 0 ? projectedDailyDemand : 0;
        if (dailyDemand <= 0) {
          dailyDemand = minimumStock > 0 ? minimumStock / 3 : 5.0;
        }

        day_stock = dailyDemand > 0 ? parseFloat((stockActual / dailyDemand).toFixed(2)) : 0;
        days_to_critical = dailyDemand > 0 ? parseFloat(((stockActual - 3 * dailyDemand) / dailyDemand).toFixed(2)) : 0;

        // Apply same business thresholds
        if (isCentral) {
          if (stockActual < projectedDailyDemand * 3) {
            alertSeverity = 'CRITICAL';
          } else if (stockActual > projectedWeeklyDemand * 1.3) {
            alertSeverity = 'OVERPRODUCTION';
          } else if (projectedProduction < projectedWeeklyDemand) {
            alertSeverity = 'PREVENTIVE';
          }
        } else {
          if (stockActual < dailyDemand * 3) {
            alertSeverity = 'CRITICAL';
          } else if (stockActual + projectedProduction < dailyDemand * 7) {
            alertSeverity = 'PREVENTIVE';
          } else if (stockActual > dailyDemand * 7 * 1.3) {
            alertSeverity = 'OVERPRODUCTION';
          }
        }
      }

      return {
        id: Number(item.id),
        date: item.movementDate,
        movementType: item.movementType,
        sku: item.inventory?.sku || 'N/A',
        productName: item.inventory?.name || 'Desconocido',
        warehouseName: item.warehouse?.name || 'Desconocido',
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        userName: item.createdBy?.name || 'Sistema',
        notes: item.notes || '',
        day_stock,
        days_to_critical,
        alertSeverity
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
