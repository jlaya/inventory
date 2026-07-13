import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('units_of_measure')
export class UnitOfMeasure {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 10, nullable: true })
  @Index({ unique: true })
  code: string;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 10 })
  abbreviation: string;
}