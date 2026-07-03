import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Usuario } from './usuario.entity';
import { IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

@Entity({ name: 'persona', schema: 'seguridad' })
export class Persona extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({
    name: 'celular',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  celular?: string;

  @Column({
    name: 'correo_electronico',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  correoElectronico?: string;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    name: 'fecha_nacimiento',
  })
  fechaNacimiento: string; // Ahora se almacena como texto puro

  @Column({
    name: 'id_lugar_emision_documento',
    type: 'bigint',
    nullable: true,
  })
  idLugarEmisionDocumento?: string;

  @Column({
    name: 'id_tipo_documento',
    type: 'bigint',
    nullable: true,
  })
  idTipoDocumento?: string;

  @Column({
    name: 'nombres',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  nombres?: string;

  @Column({
    name: 'apellido_paterno',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  apellidoPaterno?: string;

  @Column({
    name: 'apellido_materno',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  apellidoMaterno?: string;

  @Column({
    name: 'numero_documento',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  numeroDocumento?: string;

  // Añadir en Persona (junto a las columnas existentes):
  @OneToMany(() => Usuario, (usuario) => usuario.persona)
  usuarios: Usuario[];
}
