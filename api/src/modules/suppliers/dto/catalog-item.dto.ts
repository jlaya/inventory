import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class AddCatalogItemDto {
  @IsNotEmpty()
  @IsNumber()
  inventoryId: number;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDays?: number;

  @IsOptional()
  @IsNumber()
  lastPurchaseCost?: number;
}
