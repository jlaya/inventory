import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrdersController } from './purchase_orders.controller';
import { PurchaseOrdersService } from './purchase_orders.service';
import { PurchaseOrder } from './entities/purchase_order.entity';
import { PurchaseOrderDetail } from './entities/purchase_order_detail.entity';
import { PurchaseOrderAttachment } from './entities/purchase_order_attachment.entity';
import { InventoryTransaction } from './entities/inventory_transaction.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { AlertsModule } from '../alerts/alerts.module';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderDetail,
      PurchaseOrderAttachment,
      InventoryTransaction
    ]),
    InventoryModule,
    AlertsModule,
    HistoryModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}

