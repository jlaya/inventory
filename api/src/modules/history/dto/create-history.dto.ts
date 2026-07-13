import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';

export class CreateHistoryDto {
  @IsNotEmpty()
  @IsNumber()
  inventoryId: number;

  @IsNotEmpty()
  @IsNumber()
  warehouseId: number;

  @IsNotEmpty()
  @IsEnum([
    'INPUT',
    'OUTPUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'PRODUCTION_CONSUMPTION',
    'PRODUCTION_YIELD',
    'SALE',
    'DECREASE',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
  ])
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

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsNumber()
  previousStock?: number;

  @IsOptional()
  @IsNumber()
  currentStock?: number;

  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @IsOptional()
  @IsNumber()
  totalCost?: number;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsNumber()
  referenceId?: number;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  @IsOptional()
  @IsString()
  expirationDate?: string;

  @IsOptional()
  @IsString()
  movementDate?: string;

  @IsOptional()
  @IsNumber()
  week?: number;

  @IsOptional()
  @IsNumber()
  createdById?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
