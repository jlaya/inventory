import { IsNumber, IsOptional } from 'class-validator';

export class CreateInventoryStockDto {
  @IsNumber()
  @IsOptional()
  conteo?: number;
}
