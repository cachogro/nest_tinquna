import { Auditoria } from 'src/common/entities/auditoria.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  OneToOne,
} from 'typeorm';
import { Persona } from './persona.entity';
import { RefreshToken } from './refresh-token.entity';
import { Rol } from './rol.entity';

@Entity({ name: 'usuario', schema: 'seguridad' })
export class Usuario extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({
    name: 'usuario',
    type: 'varchar',
    length: 50,
    nullable: false,
    unique: true,
  })
  usuario: string;

  @Column({
    name: 'contrasena',
    type: 'varchar',
    length: 60,
    nullable: false,
    select: false,
  })
  contrasena?: string;

  @Column({
    name: 'cambio_clave',
    type: 'bool',
    nullable: false,
    default: true,
  })
  cambioClave?: boolean;

  @Column({
    name: 'bloqueado_hasta',
    type: 'timestamp',
    nullable: true,
    select: false,
  })
  bloqueadoHasta?: Date;

  @Column({
    name: 'intentos_fallidos',
    type: 'int',
    nullable: false,
    default: 0,
    select: false,
  })
  intentosFallidos?: number;

  @Column({
    name: 'ultimo_acceso',
    type: 'timestamp',
    nullable: true,
  })
  ultimoAcceso?: Date;

  @OneToOne(() => Persona, { eager: true })
  @JoinColumn({ name: 'id_persona', referencedColumnName: 'id' })
  persona?: Persona;

  // @OneToMany(() => UsuarioRol, (usuarioRol) => usuarioRol.usuario)
  // usuarioRoles?: UsuarioRol[];

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.usuario)
  refreshTokens?: RefreshToken[];

  @ManyToMany(() => Rol, { eager: true })
  @JoinTable({
    name: 'usuario_rol',
    joinColumn: {
      name: 'id_usuario',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'id_rol',
      referencedColumnName: 'id',
    },
  })
  roles: Rol[];
}
