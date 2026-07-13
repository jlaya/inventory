import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) { }

  async create(dto: any) {
    const u = new User();
    u.name = dto.name;
    u.userName = dto.userName;
    u.charge = dto.charge;
    u.avatar = dto.avatar;
    u.status = dto.status;
    if (dto.roleId) {
      u.roleId = Number(dto.roleId);
      u.role = { id: Number(dto.roleId) } as any;
    }
    if (dto.warehouseId) {
      u.warehouseId = Number(dto.warehouseId);
      u.warehouse = { id: Number(dto.warehouseId) } as any;
    }
    if (dto.password) {
      u.password = await argon2.hash(dto.password);
    }

    return this.dataSource.getRepository(User).save(u);
  }

  async findAll() {
    return this.dataSource.getRepository(User).find({
      relations: ['role', 'warehouse']
    });
  }

  async findOne(id: number) {
    const u = await this.dataSource.getRepository(User).findOne({
      where: { id },
      relations: ['role', 'warehouse']
    });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  async update(id: number, dto: any) {
    const u = await this.findOne(id);
    if (dto.name !== undefined) u.name = dto.name;
    if (dto.userName !== undefined) u.userName = dto.userName;
    if (dto.charge !== undefined) u.charge = dto.charge;
    if (dto.avatar !== undefined) u.avatar = dto.avatar;
    if (dto.status !== undefined) u.status = dto.status;
    if (dto.roleId !== undefined) {
      u.roleId = dto.roleId ? Number(dto.roleId) : null;
      u.role = dto.roleId ? ({ id: Number(dto.roleId) } as any) : null;
    }
    if (dto.warehouseId !== undefined) {
      u.warehouseId = dto.warehouseId ? Number(dto.warehouseId) : null;
      u.warehouse = dto.warehouseId ? ({ id: Number(dto.warehouseId) } as any) : null;
    }
    if (dto.password !== undefined && dto.password !== '') {
      u.password = await argon2.hash(dto.password);
    }

    return this.dataSource.getRepository(User).save(u);
  }

  async login(userName: string, password?: string, warehouseId?: number) {
    if (!userName || !password) {
      throw new BadRequestException('El usuario y la contraseña son requeridos');
    }

    const user = await this.dataSource.getRepository(User)
      .createQueryBuilder('user')
      .where('user.userName = :userName', { userName })
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.warehouse', 'warehouse')
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (!user.status) {
      throw new UnauthorizedException('El usuario está suspendido');
    }

    const isPasswordValid = await argon2.verify(user.password || '', password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (user.warehouseId && warehouseId && Number(user.warehouseId) !== Number(warehouseId)) {
      throw new UnauthorizedException('No pertenece al área seleccionada');
    }

    if (warehouseId) {
      user.warehouseId = Number(warehouseId);
      user.warehouse = { id: Number(warehouseId) } as any;
      await this.dataSource.getRepository(User).save(user);
      // Reload warehouse details
      user.warehouse = await this.dataSource.getRepository(Warehouse).findOne({ where: { id: Number(warehouseId) } }) as any;
    }

    delete user.password;

    const payload = { sub: user.id, userName: user.userName, roleId: user.roleId, warehouseId: user.warehouseId };
    const token = this.jwtService.sign(payload);

    return {
      success: true,
      user,
      token,
    };
  }

  async refreshToken(userId: number) {
    const user = await this.findOne(userId);
    if (!user.status) {
      throw new UnauthorizedException('El usuario está suspendido');
    }
    const payload = { sub: user.id, userName: user.userName, roleId: user.roleId, warehouseId: user.warehouseId };
    const token = this.jwtService.sign(payload);
    return {
      success: true,
      user,
      token,
    };
  }

  async remove(id: number) {
    const u = await this.findOne(id);
    await this.dataSource.getRepository(User).remove(u);
    return { success: true };
  }
}

