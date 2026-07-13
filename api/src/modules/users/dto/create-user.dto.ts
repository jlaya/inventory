import { IsNotEmpty, IsString, MinLength, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateUserDto {
    @IsNotEmpty()
    @IsNumber()
    roleId: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    userName: string;

    @IsString()
    @IsOptional()
    @MinLength(6)
    password?: string;

    @IsString()
    charge: string;

    @IsString()
    avatar?: string;

    @IsBoolean()
    @IsOptional()
    status?: boolean;

    @IsOptional()
    @IsNumber()
    warehouseId?: number;
}