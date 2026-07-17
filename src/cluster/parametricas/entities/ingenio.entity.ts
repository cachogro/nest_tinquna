import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

@Entity({ name: 'ingenio', schema: 'parametrica' })
export class Ingenio extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 150,
  })
  nombre: string;

  @Column({
    name: 'direccion',
    type: 'varchar',
    length: 250,
  })
  direccion: string;

  @Column({
    name: 'telefono',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  telefono?: string;
}