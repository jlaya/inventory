import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { Role } from './modules/roles/entities/role.entity';
import { User } from './modules/users/entities/user.entity';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

  getHello(): string {
    return 'Welcome to the Restaurant API!';
  }

  async onApplicationBootstrap() {
    console.log('Verificando inicialización de la base de datos...');
    try {
      const roleRepo = this.dataSource.getRepository(Role);
      const userRepo = this.dataSource.getRepository(User);

      // 1. Seed Roles if they do not exist
      let adminRole = await roleRepo.findOne({ where: { name: 'Administrador' } });
      if (!adminRole) {
        console.log('Sembrando rol de Administrador por defecto...');
        adminRole = new Role();
        adminRole.name = 'Administrador';
        adminRole.permissions = {
          users: true,
          inventory: true,
          warehouses: true,
          recipes: true,
          pos: true,
          finance: true
        };
        adminRole.status = true;
        adminRole = await roleRepo.save(adminRole);
      }

      // 2. Seed Users if table is empty
      const userCount = await userRepo.count();
      if (userCount === 0) {
        console.log('Sembrando usuario administrador por defecto...');
        const adminUser = new User();
        adminUser.name = 'Jesús Gerard';
        adminUser.userName = 'admin';
        adminUser.charge = 'Super-Administrador';
        adminUser.avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150';
        adminUser.status = true;
        adminUser.roleId = adminRole.id;
        adminUser.password = await argon2.hash('admin123');
        await userRepo.save(adminUser);
        console.log('Usuario administrador sembrado con éxito: admin / admin123');
      }
    } catch (err) {
      console.error('Error al inicializar datos del sistema:', err);
    }
  }
}