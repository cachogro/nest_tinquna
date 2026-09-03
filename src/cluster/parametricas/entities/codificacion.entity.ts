import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

@Entity({ name: 'codificacion', schema: 'parametrica' })
export class Codificacion extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    length: 15,
    unique: true,
  })
  codigo: string;

  @Column({
    length: 100,
  })
  nombre: string;

  @Column({
    type: 'jsonb',
  })
  minerales: {
    id: number;
    descripcion: string;
    simbolo: string;
  }[];
}