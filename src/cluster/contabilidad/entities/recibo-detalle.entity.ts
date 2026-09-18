import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { Recibo } from './recibo.entity';
import { MovimientoKardex } from './movimiento-kardex.entity';

export type DestinoReciboDetalle = 'PERSONAL' | 'ACTOR' | 'EFECTIVO';

/**
 * Línea de aplicación de un recibo: a qué kardex (o efectivo directo) se
 * destina cada porción del total, y con qué destino_gasto se clasifica esa
 * porción (cada línea puede tener un destino_gasto distinto). La suma de
 * `monto` de todas las líneas de un recibo debe ser igual a
 * `recibo.montoTotal` (se valida en el servicio). Cada línea genera su
 * propio movimiento en la caja de flujo (ver MovimientoCaja.idRecibo).
 *
 * PERSONAL/ACTOR postean HABER en el kardex de `idPersona`/
 * `idActorProductivoMinero` (saldan una deuda existente). EFECTIVO no
 * requiere ninguno de los dos, pero puede traer uno (excluyentes entre sí):
 * si la persona/actor indicada tiene kardex abierto, esa línea postea un
 * DEBE (anticipo nuevo, sube su deuda) además del egreso en caja.
 */
@Entity({
  name: 'recibo_detalle',
  schema: 'contabilidad',
})
export class ReciboDetalle extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_recibo',
    type: 'bigint',
  })
  idRecibo: string;

  @ManyToOne(() => Recibo, (recibo) => recibo.detalles, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_recibo',
    referencedColumnName: 'id',
  })
  recibo?: Recibo;

  @Column({
    name: 'destino',
    type: 'varchar',
    length: 10,
  })
  destino: DestinoReciboDetalle;

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
    name: 'monto',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  monto: number;

  // Clasificador (parametrica.destino_gasto) de esta porción del recibo:
  // se aplica tanto a la línea de kardex como al movimiento de caja que
  // genera esta línea.
  @Column({
    name: 'id_destino_gasto',
    type: 'int',
    nullable: true,
  })
  idDestinoGasto?: number | null;

  @ManyToOne(() => DestinoGasto, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_destino_gasto',
    referencedColumnName: 'id',
  })
  destinoGasto?: DestinoGasto;

  // Línea de kardex generada por esta porción. NULL si destino=EFECTIVO.
  @Column({
    name: 'id_movimiento_kardex',
    type: 'bigint',
    nullable: true,
  })
  idMovimientoKardex?: string | null;

  @ManyToOne(() => MovimientoKardex, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_movimiento_kardex',
    referencedColumnName: 'id',
  })
  movimientoKardex?: MovimientoKardex;
}
