import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 250, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: false, default: 'S/C' })
  code: string;

  @Column({ type: 'varchar', length: 150, default: 'General' })
  categorie: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image: string | null;

  @Column('jsonb', { default: [] })
  items: { inventory_id: number; quantity: number; unit: string; name?: string }[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
