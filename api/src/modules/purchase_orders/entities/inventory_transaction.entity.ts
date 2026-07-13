import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { User } from '../../users/entities/user.entity';

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Inventory, { eager: true })
  @JoinColumn({ name: 'inventory_id' })
  inventory: Inventory;

  @ManyToOne(() => Warehouse, { eager: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column({ name: 'transaction_type', type: 'varchar', length: 20 })
  transactionType: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';

  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: { to: (val) => val, from: (val) => parseFloat(val) } })
  quantity: number;

  @Column({ name: 'reference_type', type: 'varchar', length: 50, nullable: true })
  referenceType: string | null; // e.g. 'PURCHASE_ORDER', 'REQUISITION', 'DECREASE'

  @Column({ name: 'reference_id', type: 'bigint', nullable: true })
  referenceId: number | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
