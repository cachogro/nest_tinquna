import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ColumnNumericTransformer } from 'src/common/utils/handle.transform_data';

import { RecepcionMineral } from './recepcion-mineral.entity';
import { Mineral } from 'src/cluster/parametricas/entities/mineral.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity({
  name: 'recepcion_mineral_detalle',
  schema: 'comercio_interno',
})
export class RecepcionMineralDetalle extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_recepcion_mineral',
    type: 'bigint',
  })
  idRecepcionMineral: string;

  @ManyToOne(() => RecepcionMineral, (recepcion) => recepcion.detalles, {
    eager: false,
  })
  @JoinColumn({
    name: 'id_recepcion_mineral',
    referencedColumnName: 'id',
  })
  recepcionMineral?: RecepcionMineral;

  @Column({
    name: 'id_mineral',
    type: 'bigint',
  })
  idMineral: string;

  @ManyToOne(() => Mineral, {
    eager: false,
  })
  @JoinColumn({
    name: 'id_mineral',
    referencedColumnName: 'id',
  })
  mineral?: Mineral;

  @Column({
    name: 'ley',
    type: 'numeric',
    precision: 8,
    scale: 4,
    transformer: new ColumnNumericTransformer(),
  })
  ley: number;

  @ApiProperty({
    description: 'Identificador para ley unnidad',
  })
  @Column({
    name: 'ley_unidad',
    type: 'varchar',
  })
  leyUnidad: string;
}
