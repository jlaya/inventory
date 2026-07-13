import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { User } from '../../users/entities/user.entity';
import { RequisitionDetail } from '../../requisition_details/entities/requisition_detail.entity';

@Entity('requisitions')
export class Requisition {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'requisition_number', unique: true, type: 'varchar', length: 30 })
  requisitionNumber: string;

  @ManyToOne(() => Warehouse, { eager: true })
  @JoinColumn({ name: 'source_warehouse_id' })
  sourceWarehouse: Warehouse;

  @ManyToOne(() => Warehouse, { eager: true })
  @JoinColumn({ name: 'destination_warehouse_id' })
  destinationWarehouse: Warehouse;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'requested_by' })
  requestedBy: User;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'excel_path', type: 'varchar', length: 255, nullable: true })
  excelPath: string | null;

  @OneToMany(() => RequisitionDetail, (detail) => detail.requisition, { cascade: true })
  items: RequisitionDetail[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
