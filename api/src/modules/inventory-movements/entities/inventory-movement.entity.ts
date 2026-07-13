import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'recipe_code', type: 'varchar', length: 100 })
  recipeCode: string;

  @Column({ name: 'recipe_id', type: 'bigint' })
  recipeId: number;

  @Column({ name: 'quantity_sold', type: 'numeric', precision: 18, scale: 4 })
  quantitySold: number;

  @Column('jsonb', { default: [] })
  items: Array<{
    inventory_id: number;
    name: string;
    consumed_quantity: number;
    previous_stock: number;
    current_stock: number;
    uom: string;
  }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
