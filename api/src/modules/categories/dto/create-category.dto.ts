import { IsString, IsNotEmpty, IsOptional, IsBoolean, Length, IsInt } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @Length(0, 30)
  classification?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsInt()
  @IsOptional()
  parent_id?: number;

  @IsInt()
  @IsOptional()
  parentId?: number;
}