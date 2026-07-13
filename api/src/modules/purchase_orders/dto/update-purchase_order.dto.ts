import { IsOptional, IsString } from 'class-validator';

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  supplier_name?: string;

  @IsOptional()
  supplier_id?: any;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'APPROVED' | 'DESPATCHED' | 'RECEIVED';
}
