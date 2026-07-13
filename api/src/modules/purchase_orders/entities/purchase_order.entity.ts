import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Requisition } from '../../requisitions/entities/requisition.entity';
import { User } from '../../users/entities/user.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { PurchaseOrderDetail } from './purchase_order_detail.entity';
import { PurchaseOrderAttachment } from './purchase_order_attachment.entity';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'purchase_order_number', unique: true, type: 'varchar', length: 30 })
  purchaseOrderNumber: string;

  @ManyToOne(() => Requisition, { nullable: true, eager: true })
  @JoinColumn({ name: 'requisition_id' })
  requisition: Requisition | null;

  @ManyToOne(() => Supplier, { nullable: true, eager: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @Column({ name: 'supplier_name', type: 'varchar', length: 100 })
  supplierName: string;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'APPROVED' | 'DESPATCHED' | 'RECEIVED';

  @Column({ name: 'total_amount', type: 'numeric', precision: 18, scale: 4, default: 0, transformer: { to: (val) => val, from: (val) => parseFloat(val) } })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @OneToMany(() => PurchaseOrderDetail, (detail) => detail.purchaseOrder, { cascade: true })
  items: PurchaseOrderDetail[];

  @OneToMany(() => PurchaseOrderAttachment, (attachment) => attachment.purchaseOrder, { cascade: true })
  attachments: PurchaseOrderAttachment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
