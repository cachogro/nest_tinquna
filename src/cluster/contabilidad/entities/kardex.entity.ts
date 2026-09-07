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

export type TipoKardex = 'ACTOR' | 'PERSONAL';
export type EstadoKardex = 'ABIERTO' | 'CERRADO';

/**
 * Cabecera del kardex de anticipos (cuenta corriente).
 *   - tipo ACTOR: se abre para un actor productivo minero; cubre a todas sus
 *     personas relacionadas.
 *   - tipo PERSONAL: cuenta individual de una persona (persona_ci).
 *
 * Se cierra a pedido y se abre el siguiente (numero + 1) arrastrando el saldo:
 * `saldoCierre` del kardex N = `saldoInicial` del kardex N+1.
 * `saldoActual` = "TOTAL ANTICIPOS POR COBRAR".
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

  // N° del libro (1, 2, 3...), correlativo por destinatario. NO es el id.
  @Column({
    name: 'numero',
    type: 'int',
  })
  numero: number;

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
}
