import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Length, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryStockDto {
  @IsNumber()
  @IsNotEmpty()
  warehouse_id: number;

  @IsNumber()
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @IsOptional()
  minimum_stock?: number;

  @IsNumber()
  @IsOptional()
  maximum_stock?: number;

  @IsNumber()
  @IsOptional()
  projected_daily_demand?: number;

  @IsNumber()
  @IsOptional()
  projected_weekly_demand?: number;

  @IsNumber()
  @IsOptional()
  projected_production?: number;

  @IsString()
  @IsOptional()
  bin_location?: string;
}

export class CreateInventoryCostDto {
  @IsNumber()
  @IsOptional()
  last_cost?: number;

  @IsNumber()
  @IsOptional()
  average_cost?: number;

  @IsNumber()
  @IsOptional()
  replacement_cost?: number;
}

export class CreateInventoryDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  sku: string;

  @IsString()
  @IsOptional()
  @Length(0, 50)
  barcode?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 250)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  category_id: number;

  @IsNumber()
  @IsOptional()
  subcategory_id?: number;

  @IsNumber()
  @IsNotEmpty()
  uom_id: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 5)
  product_type: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  operational_destination: string;

  @IsBoolean()
  @IsOptional()
  tracks_inventory?: boolean;

  @IsBoolean()
  @IsOptional()
  tracks_lot?: boolean;

  @IsBoolean()
  @IsOptional()
  tracks_expiration?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  reference_cost?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateInventoryStockDto)
  inventory_stock?: CreateInventoryStockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateInventoryCostDto)
  inventory_costs?: CreateInventoryCostDto;
}