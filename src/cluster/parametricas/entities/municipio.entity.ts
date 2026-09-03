import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

@Entity({
  name: 'municipio',
  schema: 'parametrica',
})
export class Municipio extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'codigo',
    type: 'varchar',
    length: 5,
  })
  codigo: string;

  @Column({
    name: 'municipio',
    type: 'varchar',
    length: 40,
  })
  municipio: string;

  @Column({
    name: 'provincia',
    type: 'varchar',
    length: 25,
  })
  provincia: string;

  @Column({
    name: 'departamento',
    type: 'varchar',
    length: 10,
  })
  departamento: string;
}
