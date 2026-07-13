import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { InventoryTransfersService } from './inventory_transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { CompleteTransferDto } from './dto/complete-transfer.dto';

@Controller('inventory-transfers')
export class InventoryTransfersController {
  constructor(private readonly transfersService: InventoryTransfersService) {}

  @Post()
  async createTransfer(@Body() createTransferDto: CreateTransferDto) {
    return this.transfersService.executeTransfer(createTransferDto);
  }

  @Patch('/:id/complete')
  async completeTransfer(
    @Param('id') id: string,
    @Body() completeTransferDto: CompleteTransferDto,
  ) {
    return this.transfersService.completeTransfer(+id, completeTransferDto);
  }

  @Get()
  async findAll() {
    return this.transfersService.findAll();
  }

  @Get('/:id')
  async findOne(@Param('id') id: string) {
    return this.transfersService.findOne(+id);
  }
}
