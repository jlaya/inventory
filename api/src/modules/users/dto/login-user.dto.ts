import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class LoginUserDto {
  @IsNotEmpty()
  @IsString()
  userName: string;

  @IsNotEmpty()
  @IsString()
  password?: string;

  @IsOptional()
  @IsNumber()
  warehouseId?: number;
}

