import { Auditoria } from 'src/common/entities/auditoria.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoCalculoValorizacion } from 'src/cluster/parametricas/entities/tipo-calculo-valorizacion.entity';
import { ValorizacionMineral } from './valorizacion-mineral.entity';

@Entity({
  name: 'valorizacion_calculo',
  schema: 'comercio_interno',
})
export class ValorizacionCalculo extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  // ============================
  // Valorización
  // ============================

  @Column({
    name: 'id_valorizacion',
    type: 'bigint',
    nullable: false,
  })
  @Index('idx_vc_valorizacion')
  idValorizacion: string;

  @ManyToOne(
    () => ValorizacionMineral,
    (valorizacion) => valorizacion.calculos,
    {
      nullable: false,
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({
    name: 'id_valorizacion',
  })
  valorizacion: ValorizacionMineral;

  // ============================
  // Tipo de Cálculo
  // ============================

  @Column({
    name: 'id_tipo_calculo_valorizacion',
    type: 'int4',
    nullable: false,
  })
  @Index('idx_vc_tipo')
  idTipoCalculoValorizacion: number;

  @ManyToOne(() => TipoCalculoValorizacion, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_tipo_calculo_valorizacion',
  })
  tipoCalculoValorizacion: TipoCalculoValorizacion;

  // ============================
  // Datos del Cálculo
  // ============================

  @Column({
    name: 'base_calculo',
    type: 'numeric',
    precision: 15,
    scale: 5,
    nullable: true,
  })
  baseCalculo?: number;

  @Column({
    name: 'valor_aplicado',
    type: 'numeric',
    precision: 15,
    scale: 5,
    nullable: true,
  })
  valorAplicado?: number;

  @Column({
    name: 'importe_bolivianos',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: false,
  })
  importeBolivianos: number;

  @Column({
    name: 'extras',
    type: 'jsonb',
    nullable: true,
  })
  extras?: Record<string, any>;
}
