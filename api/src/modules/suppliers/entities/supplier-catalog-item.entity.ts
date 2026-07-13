import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Supplier } from './supplier.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';

@Entity('supplier_catalog')
@Unique(['supplier', 'inventory'])
export class SupplierCatalogItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Supplier, (supplier) => supplier.catalogItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => Inventory, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'inventory_id' })
  inventory: Inventory;

  @Column('numeric', { name: 'estimated_delivery_days', precision: 10, scale: 4, default: 1.0000, transformer: { to: (val) => val, from: (val) => parseFloat(val) } })
  estimatedDeliveryDays: number;

  @Column('numeric', { name: 'last_purchase_cost', precision: 12, scale: 4, default: 0.0000, transformer: { to: (val) => val, from: (val) => parseFloat(val) } })
  lastPurchaseCost: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
