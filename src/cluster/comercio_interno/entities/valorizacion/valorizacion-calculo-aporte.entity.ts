import { Auditoria } from 'src/common/entities/auditoria.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntidadAporte } from 'src/cluster/parametricas/entities/entidad-aporte.entity';
import { ValorizacionMineral } from './valorizacion-mineral.entity';

@Entity({
  name: 'valorizacion_calculo_aporte',
  schema: 'comercio_interno',
})
export class ValorizacionCalculoAporte extends Auditoria {
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
  @Index('idx_vca_valorizacion')
  idValorizacion: string;

  @ManyToOne(
    () => ValorizacionMineral,
    (valorizacion) => valorizacion.calculoAportes,
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
  // Entidad de Aporte
  // ============================

  @Column({
    name: 'id_entidad_aporte',
    type: 'bigint',
    nullable: false,
  })
  @Index('idx_vca_entidad')
  idEntidadAporte: string;

  @ManyToOne(() => EntidadAporte, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_entidad_aporte',
  })
  entidadAporte: EntidadAporte;

  // ============================
  // Datos del Aporte
  // ============================

  @Column({
    name: 'tipo_base_aporte',
    type: 'varchar',
    length: 10,
    nullable: false,
  })
  tipoBaseAporte: string;

  @Column({
    name: 'porcentaje_aporte',
    type: 'numeric',
    precision: 8,
    scale: 4,
    nullable: false,
  })
  porcentajeAporte: number;

  @Column({
    name: 'base_calculo',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: false,
  })
  baseCalculo: number;

  @Column({
    name: 'importe_bolivianos',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: false,
  })
  importeBolivianos: number;
}
