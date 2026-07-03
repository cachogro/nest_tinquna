import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { RolPermiso } from './rol-permiso.entity';

@Entity({ name: 'permiso', schema: 'seguridad' })
export class Permiso extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({
    name: 'codigo',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  codigo: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 150,
    nullable: false,
  })
  nombre: string;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  descripcion?: string;

  @Column({
    name: 'modulo',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  modulo: string;

  // Relación inversa: un permiso puede estar en muchos rol_permiso
  @OneToMany(() => RolPermiso, (rolPermiso) => rolPermiso.permiso)
  rolPermisos: RolPermiso[];

}