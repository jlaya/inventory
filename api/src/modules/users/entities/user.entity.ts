import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'roleid', nullable: true })
  roleId: number | null;

  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: 'roleid' })
  role: Role;

  @Column({ name: 'warehouse_id', nullable: true })
  warehouseId: number | null;

  @ManyToOne(() => Warehouse, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse | null;

  @Column({ nullable: true })
  name: string;

  @Column({ name: 'username', nullable: true })
  userName: string;

  @Column({ nullable: true, select: false })
  password?: string;

  @Column({ nullable: true })
  charge: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: true })
  status: boolean;
}

