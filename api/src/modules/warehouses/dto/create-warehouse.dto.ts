import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import { WarehouseType } from '../entities/warehouse.entity';

export class CreateWarehouseDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    code?: string;

    @IsEnum(WarehouseType)
    @IsOptional()
    warehouse_type?: WarehouseType;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;

    @IsNumber()
    @IsOptional()
    parent_warehouse_id?: number;
}