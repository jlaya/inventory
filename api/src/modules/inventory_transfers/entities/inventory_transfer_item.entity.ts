import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryTransfer } from './inventory_transfer.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';

@Entity('inventory_transfer_items')
export class InventoryTransferItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => InventoryTransfer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: InventoryTransfer;

  @Column({ name: 'inventory_id', type: 'bigint' })
  inventory_id: number;

  @ManyToOne(() => Inventory, { eager: true })
  @JoinColumn({ name: 'inventory_id' })
  inventory: Inventory;

  @Column('numeric', { name: 'quantity_shipped', precision: 18, scale: 4, nullable: false })
  quantity_shipped: number;

  @Column('numeric', { name: 'quantity_received', precision: 18, scale: 4, default: 0 })
  quantity_received: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
