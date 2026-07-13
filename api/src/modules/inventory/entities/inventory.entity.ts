import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { UnitOfMeasure } from '../../units/entities/unit.entity';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  barcode: string;

  @Column({ type: 'varchar', length: 250 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Relaciones (Foreign Keys)
  @ManyToOne(() => Category, { eager: true })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ManyToOne(() => UnitOfMeasure, { eager: true })
  @JoinColumn({ name: 'uom_id' })
  uom: UnitOfMeasure;

  @ManyToOne(() => Category, { eager: true })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory: Category;

  @Column({ type: 'varchar', length: 5 })
  product_type: string; // 'MP', 'PT', 'INS'

  @Column({ type: 'varchar', length: 30 })
  operational_destination: string;

  @Column({ type: 'boolean', default: true })
  tracks_inventory: boolean;

  @Column({ type: 'boolean', default: false })
  tracks_lot: boolean;

  @Column({ type: 'boolean', default: false })
  tracks_expiration: boolean;

  @Column({ type: 'numeric', default: 0.000000, transformer: { to: (val) => val, from: (val) => parseFloat(val) } })
  reference_cost: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  inventory_stock?: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn({ nullable: true })
  updated_at: Date;
}