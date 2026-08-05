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
import { EstadoValorizacion } from 'src/cluster/parametricas/entities/estado-valorizacion.entity';
import { Laboratorio } from 'src/cluster/parametricas/entities/laboratorio.entity';
import { ValorizacionDetalleMineral } from './valorizacion-detalle-mineral.entity';
import { ValorizacionCalculo } from './valorizacion-calculo.entity';
import { ValorizacionCalculoAporte } from './valorizacion-calculo-aporte.entity';
import { RecepcionMineral } from '../recepcion_mineral/recepcion-mineral.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity({
  name: 'valorizacion_mineral',
  schema: 'comercio_interno',
})
export class ValorizacionMineral extends Auditoria {

  
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @ApiProperty({
    example: 'c8e7083d-5cd5-4ac8-989d-42d2c7bbe19f',
    description: 'Identificador único del Formulario M03',
  })
  @Column({ type: 'uuid', nullable: false })
  uuid: string;

  // ============================
  // Recepción Mineral
  // (Único dato obligatorio al crear el borrador)
  // ============================

  @Column({
    name: 'id_recepcion_mineral',
    type: 'bigint',
    nullable: false,
  })
  idRecepcionMineral: string;

  @ManyToOne(
    () => RecepcionMineral,
    (recepcionMineral) => recepcionMineral.valorizaciones,
    {
      nullable: false,
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({
    name: 'id_recepcion_mineral',
  })
  recepcionMineral: RecepcionMineral;

  // ============================
  // Laboratorio
  // (Se completa en una etapa posterior -> ahora es opcional)
  // ============================

  @Column({
    name: 'id_laboratorio',
    type: 'bigint',
    nullable: true,
  })
  idLaboratorio?: string;

  @ManyToOne(() => Laboratorio, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_laboratorio',
  })
  laboratorio?: Laboratorio;

  // ============================
  // Estado de Valorización
  // (Se asigna BORRADOR por defecto al crear; la columna queda
  // nullable a nivel de BD porque la restricción real la maneja el servicio)
  // ============================

  @Column({
    name: 'id_estado_valorizacion',
    type: 'int4',
    nullable: true,
  })
  idEstadoValorizacion?: number;

  @ManyToOne(() => EstadoValorizacion, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_estado_valorizacion',
  })
  estadoValorizacion?: EstadoValorizacion;

  // ============================
  // Pesos
  // ============================

  @Column({
    name: 'peso_bruto_humedo_kilogramos',
    type: 'numeric',
    precision: 15,
    scale: 5,
    nullable: true,
  })
  pesoBrutoHumedoKilogramos?: number;

  @Column({
    name: 'peso_neto_humedo_kilogramos',
    type: 'numeric',
    precision: 15,
    scale: 5,
    nullable: true,
  })
  pesoNetoHumedoKilogramos?: number;

  @Column({
    name: 'peso_neto_seco_kilogramos',
    type: 'numeric',
    precision: 15,
    scale: 5,
    nullable: true,
  })
  pesoNetoSecoKilogramos?: number;

  @Column({
    name: 'tara_kilogramos',
    type: 'numeric',
    precision: 12,
    scale: 5,
    nullable: true,
  })
  taraKilogramos?: number;

  // ============================
  // Humedad y Merma
  // ============================

  @Column({
    name: 'humedad_porcentaje',
    type: 'numeric',
    precision: 12,
    scale: 5,
    nullable: true,
  })
  humedadPorcentaje?: number;

  @Column({
    name: 'merma_porcentaje',
    type: 'numeric',
    precision: 12,
    scale: 5,
    nullable: true,
  })
  mermaPorcentaje?: number;

  @Column({
    name: 'merma_kilogramos',
    type: 'numeric',
    precision: 12,
    scale: 5,
    nullable: true,
  })
  mermaKilogramos?: number;

  // ============================
  // Valores Económicos
  // ============================

  @Column({
    name: 'total_valor_bruto_bolivianos',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  totalValorBrutoBolivianos?: number;

  @Column({
    name: 'total_aportes_bolivianos',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalAportesBolivianos?: number;

  @Column({
    name: 'cotizacion_dolar',
    type: 'numeric',
    precision: 10,
    scale: 5,
    nullable: true,
  })
  cotizacionDolar?: number;

  // Costo de ajusteTransporte: puede ser negativo, positivo o cero.
  @Column({
    name: 'ajuste_transporte',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    nullable: false,
  })
  ajusteTransporte: number;

  @Column({
    name: 'anticipo',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    nullable: false,
  })
  anticipo: number;

  // Otros anticipos: debe ser 0 o mayor, nunca negativo.
  @Column({
    name: 'otros_anticipo',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    nullable: false,
  })
  otrosAnticipo: number;

  @Column({
    name: 'liquido_pagable_bolivianos',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  liquidoPagableBolivianos?: number;

  @Column({
    name: 'saldo_pagar_bolivianos',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    nullable: false,
  })
  saldoPagarBolivianos: number;

  // ============================
  // Otros
  // ============================

  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  observaciones?: string;

  // Ya no es obligatoria al crear el borrador; se completa después.
  @Column({
    name: 'fecha_valorizacion',
    type: 'date',
    nullable: true,
  })
  fechaValorizacion?: string;

  // ============================
  // Relaciones
  // ============================

  @OneToMany(
    () => ValorizacionDetalleMineral,
    (detalle) => detalle.valorizacion,
    {
      eager: false,
    },
  )
  detalles?: ValorizacionDetalleMineral[];

  @OneToMany(() => ValorizacionCalculo, (calculo) => calculo.valorizacion, {
    eager: false,
  })
  calculos?: ValorizacionCalculo[];

  @OneToMany(
    () => ValorizacionCalculoAporte,
    (calculoAporte) => calculoAporte.valorizacion,
    {
      eager: false,
    },
  )
  calculoAportes?: ValorizacionCalculoAporte[];




  



  @BeforeInsert()
  addUuid() {
    this.uuid = uuidv4();
  }
}
