import { Controller, Get, Post, Body, Patch, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase_orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase_order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase_order.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `po-${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  create(
    @Body() dto: CreatePurchaseOrderDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.service.create(dto, file);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('suggestions')
  getSuggestions() {
    return this.service.getSuggestions();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto
  ) {
    return this.service.update(+id, dto);
  }

  @Post(':id/receive')
  receive(
    @Param('id') id: string,
    @Body() body: { userId?: number; closeOrder?: boolean; receivedItems?: Array<{ detailId: number; quantityReceived: number }> }
  ) {
    return this.service.receive(+id, body.userId, body.closeOrder, body.receivedItems);
  }
}
