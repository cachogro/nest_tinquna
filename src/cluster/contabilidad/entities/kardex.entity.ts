import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { Cliente } from 'src/cluster/parametricas/entities/cliente.entity';

/** Estado de actividad de un kardex ABIERTO (ver KardexActividadService). */
export interface ActividadKardex {
  estado: 'ACTIVO' | 'INACTIVO';
  /** Referencia del conteo: último movimiento, apertura o reactivación (YYYY-MM-DD). */
  ultimaActividad: string;
  /** Día en que pasa (o pasó) a INACTIVO: ultimaActividad + diasInactividad. */
  inactivoDesde: string;
  diasSinActividad: number;
  /** Umbral vigente (KARDEX_DIAS_INACTIVIDAD del .env). */
  diasInactividad: number;
}

export type TipoKardex = 'ACTOR' | 'ASOCIADO' | 'PERSONAL' | 'CLIENTE';
export type EstadoKardex = 'ABIERTO' | 'CERRADO';

/**
 * Cabecera del kardex de anticipos / cuenta corriente.
 *   - tipo ACTOR: se abre para un actor productivo minero (proveedor); cubre
 *     a todas sus personas relacionadas. `saldoActual` = anticipos por
 *     cobrar (deuda del actor con la empresa).
 *   - tipo ASOCIADO: cuenta individual (persona_ci) de alguien relacionado a
 *     un actor productivo minero que NO sea la propia empresa (id !== '1'),
 *     o de una persona suelta sin actor. Misma FK `id_persona` que PERSONAL,
 *     se distinguen solo por `tipo`.
 *   - tipo PERSONAL: cuenta individual (persona_ci), pero exclusiva del
 *     personal interno de la empresa (persona.idActorProductivoMinero='1'):
 *     lleva otro trato (datos laborales, etc.).
 *   - tipo CLIENTE: se abre para un cliente/comprador; `saldoActual` = deuda
 *     del cliente con la empresa por mineral vendido a crédito (cuenta por
 *     cobrar de ventas). Mismo mecanismo DEBE/HABER que los demás.
 *
 * Se cierra a pedido y se abre el siguiente (numero + 1) arrastrando el saldo:
 * `saldoCierre` del kardex N = `saldoInicial` del kardex N+1.
 */
@Entity({
  name: 'kardex',
  schema: 'contabilidad',
})
export class Kardex extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'tipo',
    type: 'varchar',
    length: 10,
  })
  tipo: TipoKardex;

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
    referencedColumnName: 'id',
  })
  actorProductivoMinero?: ActorProductivoMinero;

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
    referencedColumnName: 'id',
  })
  persona?: PersonaCi;

  @Column({
    name: 'id_cliente',
    type: 'bigint',
    nullable: true,
  })
  idCliente?: string | null;

  @ManyToOne(() => Cliente, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_cliente',
    referencedColumnName: 'id',
  })
  cliente?: Cliente;

  // N° del libro (1, 2, 3...), correlativo por destinatario. NO es el id.
  @Column({
    name: 'numero',
    type: 'int',
  })
  numero: number;

  // Código único y legible: K<tipo>-<correlativo>, ej. "KA-001" (ver
  // generarCodigoKardex). Cada sigla (KA, KS, KP, KC) lleva su propia
  // numeración, en orden de creación; distinta de `numero`, que es el N° de
  // libro del destinatario. Lo asigna KardexService al abrir / cerrar.
  @Column({
    name: 'codigo',
    type: 'varchar',
    length: 20,
  })
  codigo: string;

  @Column({
    name: 'gestion',
    type: 'int',
  })
  gestion: number;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  descripcion?: string | null;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 10,
    default: 'ABIERTO',
  })
  estado: EstadoKardex;

  @Column({
    name: 'saldo_inicial',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  saldoInicial: number;

  @Column({
    name: 'saldo_actual',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  saldoActual: number;

  @Column({
    name: 'saldo_cierre',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  saldoCierre: number | null;

  @Column({
    name: 'id_kardex_anterior',
    type: 'bigint',
    nullable: true,
  })
  idKardexAnterior?: string | null;

  @ManyToOne(() => Kardex, {
    nullable: true,
  })
  @JoinColumn({
    name: 'id_kardex_anterior',
    referencedColumnName: 'id',
  })
  kardexAnterior?: Kardex;

  @Column({
    name: 'fecha_apertura',
    type: 'date',
    default: () => 'CURRENT_DATE',
  })
  fechaApertura: string;

  @Column({
    name: 'fecha_cierre',
    type: 'date',
    nullable: true,
  })
  fechaCierre?: string | null;

  @Column({
    name: 'cerrado_por',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  cerradoPor?: string | null;

  // Última reactivación manual tras quedar INACTIVO por falta de movimientos
  // (ver KardexActividadService): reinicia el conteo de días de inactividad.
  @Column({
    name: 'fecha_reactivacion',
    type: 'timestamptz',
    nullable: true,
  })
  fechaReactivacion?: Date | null;

  @Column({
    name: 'reactivado_por',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  reactivadoPor?: string | null;

  /**
   * Estado de actividad calculado (no es columna): lo completan los
   * listados con KardexActividadService. Null en kardex cerrados o anulados.
   */
  actividad?: ActividadKardex | null;
}
