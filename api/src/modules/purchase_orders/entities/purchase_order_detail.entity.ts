import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './purchase_order.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { UnitOfMeasure } from '../../units/entities/unit.entity';

@Entity('purchase_order_details')
export class PurchaseOrderDetail {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @ManyToOne(() => Inventory, { eager: true })
  @JoinColumn({ name: 'inventory_id' })
  inventory: Inventory;

  @ManyToOne(() => UnitOfMeasure, { eager: true, nullable: true })
  @JoinColumn({ name: 'uom_id' })
  uom: UnitOfMeasure | null;

  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: { to: (val) => val, from: (val) => parseFloat(val) } })
  quantity: number;

  @Column('numeric', { name: 'quantity_received', precision: 18, scale: 4, default: 0, transformer: { to: (val) => val, from: (val) => parseFloat(val) } })
  quantityReceived: number;

  @Column('numeric', { name: 'unit_price', precision: 18, scale: 4, default: 0, transformer: { to: (val) => val, from: (val) => parseFloat(val) } })
  unitPrice: number;

  @Column('numeric', { name: 'total_price', precision: 18, scale: 4, default: 0, transformer: { to: (val) => val, from: (val) => parseFloat(val) } })
  totalPrice: number;
}
