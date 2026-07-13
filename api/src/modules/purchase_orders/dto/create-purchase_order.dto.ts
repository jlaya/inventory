import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreatePurchaseOrderDto {
  @IsString()
  supplier_name: string;

  @IsOptional()
  supplier_id?: any;

  @IsOptional()
  requisition_id?: any;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  created_by?: any;

  @IsNotEmpty()
  @IsString()
  items: string; // Will support JSON string representation of details
}
