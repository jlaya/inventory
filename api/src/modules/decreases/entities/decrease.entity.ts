import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryStock } from '../../inventory_stock/entities/inventory_stock.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

@Entity('decreases')
export class Decrease {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Column({ name: 'stock_id', type: 'bigint' })
  stock_id: number;

  @ManyToOne(() => InventoryStock, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock: InventoryStock;

  @Column('numeric', { precision: 18, scale: 4, default: 0 })
  quantity: number;

  @Column({ type: 'integer', default: 1 })
  cause: number;

  @Column({ type: 'text' })
  motive: string;

  @Column({ name: 'area_id', type: 'bigint' })
  area_id: number;

  @ManyToOne(() => Warehouse, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'area_id' })
  warehouse: Warehouse;

  @Column({ type: 'integer', nullable: true })
  week: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
