import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity({ name: 'bitacora_acceso', schema: 'seguridad' })
export class BitacoraAcceso {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    nullable: true,
  })
  @Index('idx_bitacora_acceso_usuario')
  idUsuario?: string;

  // Nombre de usuario tal como se escribió en el intento de login. Se guarda
  // aparte de `id_usuario` porque cuando el usuario no existe (o se escribió
  // mal) no hay id que referenciar, y porque conserva el valor histórico aun
  // si el usuario luego cambia su nombre.
  @Column({
    name: 'usuario_ingresado',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  usuarioIngresado?: string;

  @Column({
    name: 'tipo_evento',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  tipoEvento: string;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  descripcion?: string;

  @Column({
    name: 'ip',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  ip?: string;

  @Column({
    name: 'user_agent',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userAgent?: string;

  @Column({
    name: 'exitoso',
    type: 'bool',
    nullable: false,
    default: false,
  })
  exitoso: boolean;

  @Column({
    name: 'fecha_registro',
    type: 'timestamp',
    nullable: false,
    default: () => 'now()',
  })
  fechaRegistro: Date;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario?: Usuario;
}
