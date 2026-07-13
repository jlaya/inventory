import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { User } from '../../users/entities/user.entity';

@Entity('history')
@Index(['warehouse', 'movementDate'])
@Index(['inventory', 'movementDate'])
@Index(['referenceType', 'referenceId'])
export class History {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => Inventory, { eager: true })
  @JoinColumn({ name: 'inventory_id' })
  inventory: Inventory;

  @ManyToOne(() => Warehouse, { eager: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column({
    name: 'movement_type',
    type: 'varchar',
    length: 30,
  })
  movementType:
    | 'INPUT'
    | 'OUTPUT'
    | 'TRANSFER_IN'
    | 'TRANSFER_OUT'
    | 'PRODUCTION_CONSUMPTION'
    | 'PRODUCTION_YIELD'
    | 'SALE'
    | 'DECREASE'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT';

  @Column('numeric', {
    precision: 18,
    scale: 4,
    default: 0,
    transformer: { to: (val) => val, from: (val) => parseFloat(val) },
  })
  quantity: number;

  @Column('numeric', {
    name: 'previous_stock',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: { to: (val) => val, from: (val) => parseFloat(val) },
  })
  previousStock: number;

  @Column('numeric', {
    name: 'current_stock',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: { to: (val) => val, from: (val) => parseFloat(val) },
  })
  currentStock: number;

  @Column('numeric', {
    name: 'unit_cost',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: { to: (val) => val, from: (val) => parseFloat(val) },
  })
  unitCost: number;

  @Column('numeric', {
    name: 'total_cost',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: { to: (val) => val, from: (val) => parseFloat(val) },
  })
  totalCost: number;

  @Column({ name: 'reference_type', type: 'varchar', length: 50, nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'bigint', nullable: true })
  referenceId: number | null;

  @Column({ name: 'lot_number', type: 'varchar', length: 50, nullable: true })
  lotNumber: string | null;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: string | null; // format YYYY-MM-DD or Date

  @Column({ name: 'movement_date', type: 'date' })
  movementDate: string; // format YYYY-MM-DD

  @Column({ type: 'integer' })
  week: number;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @BeforeInsert()
  setAutomaticFields() {
    // Si no se especifica una fecha de movimiento, se usa la fecha actual
    const date = this.createdAt ? new Date(this.createdAt) : new Date();

    if (!this.movementDate) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      this.movementDate = `${yyyy}-${mm}-${dd}`;
    }

    if (this.week === undefined || this.week === null) {
      // Cálculo del número de semana ISO 8601
      const target = new Date(date.valueOf());
      const dayNr = (date.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      this.week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    }

    if (this.unitCost && this.quantity && (!this.totalCost || this.totalCost === 0)) {
      this.totalCost = Number(this.quantity) * Number(this.unitCost);
    }
  }
}
