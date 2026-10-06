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
import { Laboratorio } from 'src/cluster/parametricas/entities/laboratorio.entity';
import { PersonaCi } from '../persona-ci.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { Recibo } from 'src/cluster/contabilidad/entities/recibo.entity';
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
  // Proveedor: persona registrada, actor productivo o externo (solo nombre).
  // A lo sumo uno de idPersona / idActorProductivoMinero; con ambos en null
  // el proveedor es un externo y se identifica por nombresApellidos. A qué
  // kardex va el dinero se decide recién al procesar el recibo.
  // ============================

  @Column({
    name: 'id_persona',
    type: 'bigint',
    nullable: true,
  })
  idPersona?: string | null;

  @ManyToOne(() => PersonaCi, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_persona',
  })
  persona?: PersonaCi | null;

  @Column({
    name: 'id_actor_productivo_minero',
    type: 'bigint',
    nullable: true,
  })
  idActorProductivoMinero?: string | null;

  @ManyToOne(() => ActorProductivoMinero, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_actor_productivo_minero',
  })
  actorProductivoMinero?: ActorProductivoMinero | null;

  // Nombre del proveedor tal como se registró (también para persona y
  // actor). null en las recepciones anteriores: se lee de la persona.
  @Column({
    name: 'nombres_apellidos',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  nombresApellidos?: string | null;

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

  // Recibos (serie C) generados para el anticipo desde el diálogo de recibo
  // (contabilidad.recibo.id_recepcion_mineral). Solo puede haber uno
  // vigente (BORRADOR/PROCESADO); los ANULADOS quedan como historial.
  @OneToMany(() => Recibo, (recibo) => recibo.recepcionMineral)
  recibos?: Recibo[];

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

  // Lugar donde se recibió el mineral (galpón, ingenio, etc.). Texto libre:
  // los valores sugeridos vienen de GET /parametricas/lugar-acopio, pero no
  // hay relación con esa tabla.
  @Column({
    name: 'lugar_acopio',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lugarAcopio?: string;

  // ============================
  // Laboratorio
  // ============================

  // Laboratorio al que se envía la muestra, registrado ya desde la recepción.
  // Opcional. Al crear el borrador de la valorización se copia a
  // valorizacion_mineral.id_laboratorio; desde ahí cada uno se edita por
  // separado (cambiarlo en la valorización no modifica la recepción).
  @Column({
    name: 'id_laboratorio',
    type: 'bigint',
    nullable: true,
  })
  idLaboratorio?: string | null;

  @ManyToOne(() => Laboratorio, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_laboratorio',
  })
  laboratorio?: Laboratorio | null;

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
