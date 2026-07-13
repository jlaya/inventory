import { IsNotEmpty, IsString, IsBoolean, IsObject, IsOptional } from 'class-validator';

export class CreateRoleDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsObject()
    @IsOptional()
    permissions: Record<string, boolean>;

    @IsBoolean()
    @IsOptional()
    status?: boolean;
}