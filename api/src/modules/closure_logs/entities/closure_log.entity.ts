import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('closure_logs')
export class ClosureLog {
  @PrimaryColumn({ length: 100 })
  id: string;

  @Column({ name: 'date_time', type: 'timestamp' })
  dateTime: Date;

  @Column('numeric', { name: 'total_revenue', nullable: true })
  totalRevenue: number;

  @Column('numeric', { name: 'total_cost', nullable: true })
  totalCost: number;

  @Column('jsonb', { name: 'store_snapshot', nullable: true })
  storeSnapshot: any;

  @Column({ nullable: true })
  week: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
