import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ColumnNumericTransformer } from 'src/common/utils/numeric-column.transform';
import { Mineral } from './mineral.entity';

@Entity({ name: 'escala_precio_mineral', schema: 'parametrica' })
export class EscalaPrecioMineral extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'int',
  })
  id: number;

  @Column({
    name: 'id_mineral',
    type: 'bigint',
    nullable: false,
  })
  idMineral: number;

  @ManyToOne(() => Mineral, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_mineral' })
  mineral?: Mineral;

  @Column({
    name: 'ley',
    type: 'numeric',
    transformer: new ColumnNumericTransformer(),
  })
  ley: number;

  @Column({
    name: 'precio_punto',
    type: 'numeric',
    transformer: new ColumnNumericTransformer(),
  })
  precioPunto: number;

  @Column({
    name: 'precio_tm',
    type: 'numeric',
    transformer: new ColumnNumericTransformer(),
  })
  precioTm: number;

  @Column({
    name: 'fecha_vigencia_inicial',
    type: 'timestamptz',
  })
  fechaVigenciaInicial: Date;

  @Column({
    name: 'fecha_vigencia_final',
    type: 'timestamptz',
    nullable: true,
  })
  fechaVigenciaFinal?: Date;
}
