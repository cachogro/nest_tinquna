import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { UsuarioRol } from './usuario-rol.entity';
import { RolPermiso } from './rol-permiso.entity';

@Entity({ name: 'rol', schema: 'seguridad' })
export class Rol {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  nombre?: string;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  descripcion?: string;


    @Column({
    name: 'codigo',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  codigo?: string;


  @Column({
    name: 'activo',
    type: 'bool',
    nullable: false,
    default: true,
  })
  activo: boolean;

// Rol ya tiene:
// @OneToMany(() => UsuarioRol, (usuarioRol) => usuarioRol.rol)
// usuarioRoles: UsuarioRol[];

@OneToMany(() => RolPermiso, (rolPermiso) => rolPermiso.rol)
rolPermisos: RolPermiso[];
}