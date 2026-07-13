import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as argon2 from 'argon2';
import { Role } from '../modules/roles/entities/role.entity';
import { User } from '../modules/users/entities/user.entity';

// Load environment configuration
dotenv.config({ path: path.join(__dirname, '../../.env') });

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'restaurant_erp',
  entities: [Role, User],
  synchronize: false,
});

async function run() {
  console.log('Iniciando proceso de siembra de base de datos (seeding)...');

  try {
    await AppDataSource.initialize();

    const roleRepo = AppDataSource.getRepository(Role);
    const userRepo = AppDataSource.getRepository(User);

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

    // 2. Seed Users if admin does not exist
    const existingAdmin = await userRepo.findOne({ where: { userName: 'admin' } });
    if (!existingAdmin) {
      console.log('Sembrando usuario administrador por defecto...');
      const adminUser = new User();
      adminUser.name = 'Administrador';
      adminUser.userName = 'admin';
      adminUser.charge = 'Super-Administrador';
      adminUser.avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150';
      adminUser.status = true;
      adminUser.roleId = adminRole.id;
      adminUser.password = await argon2.hash('admin123');
      await userRepo.save(adminUser);
      console.log('Usuario administrador sembrado con éxito: admin / admin123');
    } else {
      console.log('El usuario administrador (admin) ya existe en la base de datos.');
    }
  } catch (error) {
    console.error('Error durante la siembra de la base de datos:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    console.log('Proceso de siembra finalizado.');
  }
}

run();
