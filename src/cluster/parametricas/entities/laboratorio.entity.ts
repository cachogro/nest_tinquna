import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

@Entity({
  name: 'laboratorio',
  schema: 'parametrica',
})
export class Laboratorio extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
  })
  nombre: string;

  @Column({
    name: 'direccion',
    type: 'varchar',
    nullable: true,
  })
  direccion?: string;

  @Column({
    name: 'telefono',
    type: 'varchar',
    nullable: true,
  })
  telefono?: string;
}