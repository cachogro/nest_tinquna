import { Auditoria } from 'src/common/entities/auditoria.entity';
import { v4 as uuidv4 } from 'uuid';
import {
  BeforeInsert,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CodificacionLote } from 'src/cluster/parametricas/entities/codificacion-lote.entity';
import { ColumnNumericTransformer } from 'src/common/utils/numeric-column.transform';
import { PromedioMineralDetalle } from './promedio-mineral-detalle.entity';

export interface LeyPromedioMineral {
  idMineral: string;
  mineral: string | null;
  leyPromedio: number;
  leyUnidad: string | null;
  pesoBaseKilogramos: number;
}

@Entity({
  name: 'promedio_mineral',
  schema: 'comercio_interno',
})
export class PromedioMineral extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'uuid', nullable: false })
  uuid: string;

  @Column({ name: 'correlativo', type: 'bigint', nullable: false })
  correlativo: string;

  // Código propio del promedio, ej. PRM-0001.
  @Column({ name: 'codigo', type: 'varchar', length: 20, nullable: false })
  codigo: string;

  // Codificación del lote (MC, TM, C, RV...) con correlativo propio por tipo.
  @Column({ name: 'id_codificacion_lote', type: 'bigint', nullable: true })
  idCodificacionLote?: string | null;

  @ManyToOne(() => CodificacionLote, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_codificacion_lote' })
  codificacionLote?: CodificacionLote;

  @Column({ name: 'correlativo_lote', type: 'bigint', nullable: true })
  correlativoLote?: string | null;

  // Código del lote al crearse, ej. MC-0001 (snapshot).
  @Column({ name: 'codigo_lote', type: 'varchar', length: 30, nullable: true })
  codigoLote?: string | null;

  @Column({ name: 'descripcion', type: 'varchar', length: 150, nullable: true })
  descripcion?: string;

  @Column({ name: 'fecha', type: 'date', nullable: false })
  fecha: string;

  @Column({
    name: 'cantidad_valorizaciones',
    type: 'int4',
    default: 0,
    nullable: false,
  })
  cantidadValorizaciones: number;

  @Column({
    name: 'numero_sacos_total',
    type: 'int4',
    default: 0,
    nullable: false,
  })
  numeroSacosTotal: number;

  @Column({
    name: 'peso_total_kilogramos',
    type: 'numeric',
    precision: 15,
    scale: 5,
    default: 0,
    nullable: false,
    transformer: new ColumnNumericTransformer(),
  })
  pesoTotalKilogramos: number;

  // Humedad (%) promedio ponderada por peso: SUM(humedad*peso)/SUM(peso),
  // solo sobre las valorizaciones que tienen humedad. Null si ninguna la tiene.
  @Column({
    name: 'humedad_promedio_porcentaje',
    type: 'numeric',
    precision: 12,
    scale: 5,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  humedadPromedioPorcentaje?: number | null;

  // TOTAL DE EFECTIVO INVERTIDO: suma del valor neto de venta (Bs) de las
  // valorizaciones, fijada al crear o al reemplazar la composición.
  @Column({
    name: 'total_efectivo_invertido',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    nullable: false,
    transformer: new ColumnNumericTransformer(),
  })
  totalEfectivoInvertido: number;

  // Ley promedio ponderada por peso de cada mineral: SUM(ley*peso)/SUM(peso).
  @Column({ name: 'leyes', type: 'jsonb', default: () => "'[]'", nullable: false })
  leyes: LeyPromedioMineral[];

  @Column({ name: 'observaciones', type: 'varchar', length: 255, nullable: true })
  observaciones?: string;

  @OneToMany(() => PromedioMineralDetalle, (d) => d.promedio)
  detalles?: PromedioMineralDetalle[];


  @BeforeInsert()
  addUuid() {
    this.uuid = uuidv4();
  }
}
