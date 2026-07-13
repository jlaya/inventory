import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateTransferDto {
  @IsNotEmpty()
  @IsNumber()
  fromWarehouseId: number;

  @IsNotEmpty()
  @IsNumber()
  toWarehouseId: number;

  @IsOptional()
  @IsNumber()
  requisitionId?: number;

  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsArray()
  items: Array<{
    inventoryId: number;
    quantityShipped: number;
    notes?: string;
  }>;
}
