import { PartialType } from '@nestjs/mapped-types';
import { CreateStockMovementDto } from './create-stock_movement.dto';

export class UpdateStockMovementDto extends PartialType(CreateStockMovementDto) {}
