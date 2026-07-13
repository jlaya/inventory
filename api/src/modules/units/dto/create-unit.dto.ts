import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Length, Min } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  code: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 10)
  abbreviation: string;
}