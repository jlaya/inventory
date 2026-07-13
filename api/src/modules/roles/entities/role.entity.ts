import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column('jsonb')
  permissions: any;

  @Column({ default: true })
  status: boolean;

  @OneToMany(() => User, (user) => user.role)
  users: User[];
}
