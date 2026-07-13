import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  code: string;

  @ManyToOne(() => Ingredient, { eager: true, nullable: true })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient;

  @Column({ type: 'numeric', precision: 18, scale: 4 })
  quantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  area: string;

  @Column('jsonb', { default: {} })
  items: Record<string, any>;

  @Column({ name: 'discount_status', type: 'varchar', length: 30, default: 'PENDING' })
  discountStatus: 'COMPLETED' | 'PENDING' | 'FAILED';

  @Column('jsonb', { name: 'discount_errors', nullable: true })
  discountErrors: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
