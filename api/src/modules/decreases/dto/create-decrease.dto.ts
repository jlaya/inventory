import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDecreaseDto {
  @IsNotEmpty()
  @IsNumber()
  stock_id: number;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  cause: number;

  @IsNotEmpty()
  @IsString()
  motive: string;

  @IsNotEmpty()
  @IsNumber()
  area_id: number;
}
