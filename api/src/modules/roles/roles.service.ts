import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(dto: any) {
    const r = new Role();
    r.name = dto.name;
    r.permissions = dto.permissions || {};
    r.status = dto.status !== undefined ? dto.status : true;

    return this.dataSource.getRepository(Role).save(r);
  }

  async findAll() {
    return this.dataSource.getRepository(Role).find();
  }

  async findOne(id: number) {
    const r = await this.dataSource.getRepository(Role).findOne({ where: { id } });
    if (!r) throw new NotFoundException('Rol no encontrado');
    return r;
  }

  async update(id: number, dto: any) {
    const r = await this.findOne(id);
    if (dto.name !== undefined) r.name = dto.name;
    if (dto.permissions !== undefined) r.permissions = dto.permissions;
    if (dto.status !== undefined) r.status = dto.status;

    return this.dataSource.getRepository(Role).save(r);
  }

  async remove(id: number) {
    const r = await this.findOne(id);
    await this.dataSource.getRepository(Role).remove(r);
    return { success: true };
  }
}
