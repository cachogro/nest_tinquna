import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ColumnNumericTransformer } from 'src/common/utils/handle.transform_data';
import { Mineral } from './mineral.entity';

@Entity({ name: 'cotizacion_mineral', schema: 'parametrica' })
export class CotizacionMineral extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'int',
  })
  id: number;

  @Column({
    name: 'id_mineral',
    type: 'bigint',
    nullable: true,
  })
  idMineral: number;

  @Column({
    name: 'cotizacion_mineral_dolares',
    type: 'numeric',
    // precision: 12,
    // scale: 5,
    // nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  cotizacionMineralDolares: number;

  @Column({
    name: 'alicuota_externa',
    type: 'numeric',
    // precision: 12,
    // scale: 5,
    transformer: new ColumnNumericTransformer(),
  })
  alicuotaExterna: number;

  @Column({
    name: 'alicuota_interna',
    type: 'numeric',
    // precision: 12,
    // scale: 5,
    transformer: new ColumnNumericTransformer(),
  })
  alicuotaInterna: number;

  @Column({
    name: 'fecha_vigencia_inicial',
    type: 'date',
  })
  fechaVigenciaInicial: Date;

  @Column({
    name: 'fecha_vigencia_final',
    type: 'date',
  })
  fechaVigenciaFinal: Date;

  @OneToOne(() => Mineral, (mineral) => mineral.cotizacionMineral, {})
  @JoinColumn({ name: 'id_mineral', referencedColumnName: 'id' })
  mineral?: Mineral;


}
