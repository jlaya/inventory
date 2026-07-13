import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { UnitOfMeasure } from './unit.entity';

@Entity('uom_conversions')
@Unique(['inventory', 'fromUom', 'toUom'])
export class UomConversion {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Inventory, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'inventory_id' })
  inventory: Inventory;

  @ManyToOne(() => UnitOfMeasure, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'from_uom_id' })
  fromUom: UnitOfMeasure;

  @ManyToOne(() => UnitOfMeasure, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'to_uom_id' })
  toUom: UnitOfMeasure;

  @Column('numeric', { precision: 12, scale: 4, default: 1.0000, transformer: { to: (val) => val, from: (val) => parseFloat(val) } })
  factor: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
