import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  categorie?: string;

  @IsOptional()
  items?: any;

  @IsString()
  @IsOptional()
  image?: string;
}
