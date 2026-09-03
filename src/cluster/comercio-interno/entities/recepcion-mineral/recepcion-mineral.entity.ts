import { Auditoria } from 'src/common/entities/auditoria.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Codificacion } from 'src/cluster/parametricas/entities/codificacion.entity';
import { EstadoRegistro } from 'src/cluster/parametricas/entities/estado-registro.entity';
import { PersonaCi } from '../persona-ci.entity';
//import { RecepcionMineralDetalle } from './recepcion-mineral-detalle.entity';
import { ValorizacionMineral } from '../valorizacion/valorizacion-mineral.entity';

@Entity({
  name: 'recepcion_mineral',
  schema: 'comercio_interno',
})
export class RecepcionMineral extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'correlativo',
    type: 'bigint',
    nullable: false,
  })
  correlativo: string;

  @Column({
    name: 'codigo_operacion',
    type: 'varchar',
    length: 20,
    nullable: false,
  })
  codigoOperacion: string;

  // ============================
  // Codificación
  // ============================

  @Column({
    name: 'id_codificacion',
    type: 'bigint',
    nullable: false,
  })
  idCodificacion: string;

  @ManyToOne(() => Codificacion, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_codificacion',
  })
  codificacion: Codificacion;

  // ============================
  // Persona (Proveedor)
  // ============================

  @Column({
    name: 'id_persona',
    type: 'bigint',
    nullable: false,
  })
  idPersona: string;

  @ManyToOne(() => PersonaCi, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_persona',
  })
  persona: PersonaCi;

  // ============================
  // Datos de Recepción
  // ============================

  @Column({
    name: 'numero_sacos',
    type: 'integer',
    nullable: false,
  })
  numeroSacos: number;

  @Column({
    name: 'balanza_l',
    type: 'numeric',
    precision: 12,
    scale: 5,
    nullable: false,
  })
  balanzaL: number;

  @Column({
    name: 'balanza_t',
    type: 'numeric',
    precision: 12,
    scale: 5,
    nullable: false,
  })
  balanzaT: number;

  @Column({
    name: 'anticipo',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  anticipo?: number;

  @Column({
    name: 'humedad',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  humedad?: number;

  @Column({
    name: 'id_personal_interno',
    type: 'bigint',
    nullable: false,
  })
  idPersonalInterno: string;

  @ManyToOne(() => PersonaCi, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_personal_interno',
  })
  personalInterno: PersonaCi;

  // @Column({
  //   name: 'total_valor_bruto',
  //   type: 'numeric',
  //   precision: 14,
  //   scale: 2,
  //   nullable: true,
  // })
  // totalValorBruto?: number;

  @Column({
    name: 'fecha_de_entrega',
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  fechaRecepcion: string;

  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  observaciones?: string;

  // @OneToMany(
  //   () => RecepcionMineralDetalle,
  //   (detalle) => detalle.recepcionMineral,
  //   {
  //     eager: false,
  //   },
  // )
  // detalles?: RecepcionMineralDetalle[];

  @OneToMany(
    () => ValorizacionMineral,
    (valorizacion) => valorizacion.recepcionMineral,
    {
      eager: false,
    },
  )
  valorizaciones?: ValorizacionMineral[];

  // Puntero directo a la valorización generada para esta recepción (se
  // llena al crear el borrador de la valorización). Complementa a
  // `valorizaciones` para no tener que hacer join cuando solo se necesita
  // saber si ya existe una valorización y cuál es su id.
  @Column({
    name: 'id_valorizacion',
    type: 'bigint',
    nullable: true,
  })
  idValorizacion?: string;

  @OneToOne(() => ValorizacionMineral, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_valorizacion',
  })
  valorizacion?: ValorizacionMineral;

  // ============================
  // Estado
  // ============================

  @Column({
    name: 'id_estado',
    type: 'smallint',
    nullable: false,
  })
  idEstado: number;



  
  @ManyToOne(() => EstadoRegistro, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_estado',
  })
  estado: EstadoRegistro;
}
