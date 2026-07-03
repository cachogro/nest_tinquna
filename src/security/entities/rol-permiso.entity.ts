import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Rol } from './rol.entity';
import { Permiso } from './permiso.entity';

@Entity({ name: 'rol_permiso', schema: 'seguridad' })
export class RolPermiso {
  @PrimaryColumn({
    name: 'id_rol',
    type: 'bigint',
  })
  idRol: string;

  @ManyToOne(() => Rol, (rol) => rol.rolPermisos)
  @JoinColumn({ name: 'id_rol' })
  rol: Rol;

  @PrimaryColumn({
    name: 'id_permiso',
    type: 'bigint',
  })
  idPermiso: string;

  @ManyToOne(() => Permiso, (permiso) => permiso.rolPermisos)
  @JoinColumn({ name: 'id_permiso' })
  permiso: Permiso;

  @Column({
    name: 'usuario_registro',
    type: 'varchar',
    length: 50,
    nullable: false,
    default: () => 'CURRENT_USER',
  })
  usuarioRegistro: string;

  @Column({
    name: 'fecha_registro',
    type: 'timestamp',
    nullable: false,
    default: () => 'now()',
  })
  fechaRegistro: Date;
}
