import { Auditoria } from 'src/common/entities/auditoria.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Mineral } from 'src/cluster/parametricas/entities/mineral.entity';
import { CotizacionMineral } from 'src/cluster/parametricas/entities/cotizacion-mineral.entity';
import { EscalaPrecioMineral } from 'src/cluster/parametricas/entities/escala-precio-mineral.entity';
import { ColumnNumericTransformer } from 'src/common/utils/numeric-column.transform';
import { ValorizacionMineral } from './valorizacion-mineral.entity';


@Entity({
  name: 'valorizacion_detalle_mineral',
  schema: 'comercio_interno',
})
export class ValorizacionDetalleMineral extends Auditoria {
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
  idValorizacion: string;

  @ManyToOne(
    () => ValorizacionMineral,
    (valorizacion) => valorizacion.detalles,
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
  // Mineral
  // ============================

  @Column({
    name: 'id_mineral',
    type: 'bigint',
    nullable: false,
  })
  idMineral: string;

  @ManyToOne(() => Mineral, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_mineral',
  })
  mineral: Mineral;

  // ============================
  // Datos de Ley
  // ============================

  @Column({
    name: 'ley',
    type: 'numeric',
    precision: 8,
    scale: 4,
    nullable: false,
    transformer: new ColumnNumericTransformer(),
  })
  ley: number;

  @Column({
    name: 'ley_unidad',
    type: 'varchar',
    length: 4,
    nullable: true,
  })
  leyUnidad?: string;

  @Column({
    name: 'ley_pagable',
    type: 'numeric',
    precision: 8,
    scale: 6,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  leyPagable?: number;

  // ============================
  // Cotización aplicada al mineral
  // ============================

  @Column({
    name: 'id_cotizacion_mineral',
    type: 'int4',
    nullable: true,
  })
  idCotizacionMineral?: number;

  @ManyToOne(() => CotizacionMineral, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_cotizacion_mineral',
  })
  cotizacionMineral?: CotizacionMineral;

  @Column({
    name: 'porcentaje_cotizacion',
    type: 'numeric',
    precision: 8,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  porcentajeCotizacion?: number;

  @Column({
    name: 'cotizacion_aplicada',
    type: 'numeric',
    precision: 12,
    scale: 5,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  cotizacionAplicada?: number;

  @Column({
    name: 'precio_kilo',
    type: 'numeric',
    precision: 14,
    scale: 5,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  precioKilo?: number;

  @Column({
    name: 'precio',
    type: 'int4',
    nullable: true,
  })
  precio?: number;

  // ============================
  // Pricing por escala (RAM cargas)
  // ============================

  @Column({
    name: 'id_escala_precio',
    type: 'int4',
    nullable: true,
  })
  idEscalaPrecio?: number;

  @ManyToOne(() => EscalaPrecioMineral, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_escala_precio',
  })
  escalaPrecio?: EscalaPrecioMineral;

  @Column({
    name: 'ajuste_puntos_ley',
    type: 'numeric',
    precision: 8,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  ajustePuntosLey?: number;

  @Column({
    name: 'ley_ajustada',
    type: 'numeric',
    precision: 8,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  leyAjustada?: number;

  @Column({
    name: 'precio_usd_tm',
    type: 'numeric',
    precision: 14,
    scale: 5,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  precioUsdTm?: number;

  @Column({
    name: 'porcentaje_factor',
    type: 'numeric',
    precision: 8,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  factorPorsentaje?: number;
}
