import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('units_of_measure')
export class UnitOfMeasure {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ unique: true, length: 10, nullable: true})
  code: string;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 10 })
  abbreviation: string;
}
