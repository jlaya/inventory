import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Inventory } from '../../inventory/entities/inventory.entity';

@Entity('units_of_measure')
export class UnitOfMeasure {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  abbreviation: string;

  @OneToMany(() => Inventory, (inventory) => inventory.uom)
  inventory_items: Inventory[];
}