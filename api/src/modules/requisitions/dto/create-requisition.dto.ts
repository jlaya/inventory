import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateRequisitionDto {
  @IsNotEmpty()
  @IsNumber()
  source_warehouse_id: number;

  @IsNotEmpty()
  @IsNumber()
  destination_warehouse_id: number;

  @IsOptional()
  @IsNumber()
  requested_by?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsArray()
  items: Array<{
    inventory_id: number;
    requested_quantity: number;
    notes?: string;
    custom_uom?: string;
  }>;
}
