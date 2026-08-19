import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity({ name: 'refresh_token', schema: 'seguridad' })
export class RefreshToken {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({
    name: 'id_usuario',
    type: 'bigint',
    nullable: false,
  })
  @Index('idx_refresh_token_usuario')
  idUsuario: string;

  @Column({
    name: 'token_hash',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  @Index('idx_refresh_token_hash')
  tokenHash: string;

  @Column({
    name: 'fecha_expiracion',
    type: 'timestamp',
    nullable: false,
  })
  fechaExpiracion: Date;

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
    name: 'activo',
    type: 'bool',
    nullable: false,
    default: true,
  })
  activo: boolean;

  @Column({
    name: 'revocado',
    type: 'bool',
    nullable: false,
    default: false,
  })
  revocado: boolean;

  @Column({
    name: 'fecha_registro',
    type: 'timestamp',
    nullable: false,
    default: () => 'now()',
  })
  fechaRegistro: Date;

  @Column({
    name: 'fecha_revocacion',
    type: 'timestamp',
    nullable: true,
  })
  fechaRevocacion?: Date;

  // Relación ManyToOne con Usuario
  @ManyToOne(() => Usuario, (usuario) => usuario.refreshTokens)
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}
