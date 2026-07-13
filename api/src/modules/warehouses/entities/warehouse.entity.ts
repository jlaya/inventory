import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

export enum WarehouseType {
  CENTRAL = 'CENTRAL',
  PRODUCTION_STATION = 'PRODUCTION_STATION',
  POINT_OF_SALE = 'POINT_OF_SALE',
  BODEGA = 'BODEGA',
}

@Entity('warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.children)
  @JoinColumn({ name: 'parent_warehouse_id' })
  parentWarehouse: Warehouse;

  @OneToMany(() => Warehouse, (warehouse) => warehouse.parentWarehouse)
  children: Warehouse[];

  @Column({ unique: true, length: 20 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'warehouse_type', default: WarehouseType.PRODUCTION_STATION })
  warehouseType: WarehouseType;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
