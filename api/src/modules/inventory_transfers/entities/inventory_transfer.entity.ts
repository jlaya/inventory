import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { User } from '../../users/entities/user.entity';
import { Requisition } from '../../requisitions/entities/requisition.entity';

@Entity('inventory_transfers')
export class InventoryTransfer {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'transfer_number', unique: true, type: 'varchar', length: 30 })
  transferNumber: string;

  @ManyToOne(() => Requisition, { nullable: true, eager: true })
  @JoinColumn({ name: 'requisition_id' })
  requisition: Requisition | null;

  @ManyToOne(() => Warehouse, { eager: true })
  @JoinColumn({ name: 'from_warehouse_id' })
  fromWarehouse: Warehouse;

  @ManyToOne(() => Warehouse, { eager: true })
  @JoinColumn({ name: 'to_warehouse_id' })
  toWarehouse: Warehouse;

  @Column({ type: 'varchar', length: 20, default: 'IN_TRANSIT' })
  status: 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'dispatched_by' })
  dispatchedBy: User;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'received_by' })
  receivedBy: User | null;

  @CreateDateColumn({ name: 'dispatched_at' })
  dispatchedAt: Date;

  @Column({ name: 'received_at', type: 'timestamp', nullable: true })
  receivedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
