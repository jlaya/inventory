import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';

@Entity('inventory_stock')
@Unique(['warehouse', 'inventory'])
export class InventoryStock {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @ManyToOne(() => Inventory)
  @JoinColumn({ name: 'inventory_id' })
  inventory: Inventory;

  @Column('numeric', { precision: 18, scale: 4, default: 0 })
  quantity: number;

  @Column('numeric', { precision: 18, scale: 4, default: 0, nullable: true })
  conteo: number;

  @Column({ name: 'minimum_stock', type: 'numeric', default: 0 })
  minimumStock: number;

  @Column({ name: 'maximum_stock', type: 'numeric', default: 0 })
  maximumStock: number;

  @Column({ name: 'projected_daily_demand', type: 'numeric', precision: 18, scale: 4, default: 0 })
  projectedDailyDemand: number;

  @Column({ name: 'projected_weekly_demand', type: 'numeric', precision: 18, scale: 4, default: 0 })
  projectedWeeklyDemand: number;

  @Column({ name: 'projected_production', type: 'numeric', precision: 18, scale: 4, default: 0 })
  projectedProduction: number;

  @Column({ name: 'bin_location', length: 50, nullable: true })
  binLocation: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
