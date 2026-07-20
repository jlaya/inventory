import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConteoToInventoryStock1721200000000 implements MigrationInterface {
  name = 'AddConteoToInventoryStock1721200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_stock" 
      ADD COLUMN "conteo" numeric(18,4) DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_stock" 
      DROP COLUMN "conteo"
    `);
  }
}
