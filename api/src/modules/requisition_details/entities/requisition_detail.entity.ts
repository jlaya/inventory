import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Requisition } from '../../requisitions/entities/requisition.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';

@Entity('requisition_details')
export class RequisitionDetail {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Requisition, (requisition) => requisition.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requisition_id' })
  requisition: Requisition;

  @ManyToOne(() => Inventory, { eager: true })
  @JoinColumn({ name: 'inventory_id' })
  inventory: Inventory;

  @Column('numeric', { name: 'requested_quantity', precision: 18, scale: 4, default: 0 })
  requestedQuantity: number;

  @Column('numeric', { name: 'approved_quantity', precision: 18, scale: 4, default: 0 })
  approvedQuantity: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'custom_uom', type: 'varchar', length: 50, nullable: true })
  customUom: string | null;
}
