import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryTransferDto } from './create-inventory_transfer.dto';

export class UpdateInventoryTransferDto extends PartialType(CreateInventoryTransferDto) {}
