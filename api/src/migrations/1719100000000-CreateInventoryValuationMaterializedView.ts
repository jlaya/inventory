import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryValuationMaterializedView1719100000000 implements MigrationInterface {
  name = 'CreateInventoryValuationMaterializedView1719100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_stock_valuation AS
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

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_inventory_stock_val ON mv_inventory_stock_valuation (stock_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_mv_inventory_stock_val`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_inventory_stock_valuation`);
  }
}
