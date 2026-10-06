import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { Recibo } from './recibo.entity';
import { MovimientoKardex } from './movimiento-kardex.entity';
import { FondoRendirDetalle } from './fondo-rendir-detalle.entity';

export type EstadoFondoRendir =
  | 'PENDIENTE'
  | 'RENDIDO_PARCIAL'
  | 'RENDIDO_TOTAL'
  | 'RENDIDO_EN_EXCESO'
  | 'CERRADO_CON_DEUDA';

/**
 * Fondo a rendir cuentas: se le entrega una plata puntual a una persona o a
 * un actor productivo minero para un propósito concreto (ej. comprar
 * materiales), y esa persona la va justificando de a poco con comprobantes
 * (`FondoRendirDetalle`). A diferencia del kardex de anticipos (cuenta
 * corriente continua que mezcla todos los anticipos/pagos de alguien), acá
 * cada entrega es su propio seguimiento aislado: cuánto se entregó, cuánto
 * se justificó y cuánto queda pendiente.
 *
 * La entrega siempre respalda un `Recibo` de EGRESO real (línea EFECTIVO,
 * sin `idPersona`/`idActorProductivoMinero` en esa línea a propósito: mueve
 * la plata de verdad, pero NO genera automáticamente una deuda de kardex).
 * Justificar (agregar `FondoRendirDetalle`) no mueve plata, es solo
 * evidencia. Cargar el saldo sin justificar al kardex personal del
 * destinatario es una acción aparte y manual (ver
 * `idMovimientoKardexCierre`): no es automática ni obligatoria, la decide
 * el administrador cuando corresponda (puede pasar semanas).
 *
 *   PENDIENTE:         nada justificado todavía.
 *   RENDIDO_PARCIAL:   0 < justificado < entregado.
 *   RENDIDO_TOTAL:     justificado == entregado.
 *   RENDIDO_EN_EXCESO: justificado > entregado — el destinatario adelantó
 *                      plata propia; la empresa le debe la diferencia
 *                      ("por reponer"), al revés de los tres estados
 *                      anteriores (ahí el destinatario le debe a la
 *                      empresa). Ver `montoPorReponer` en el service. Sale
 *                      de este estado (a RENDIDO_TOTAL) cuando el excedente
 *                      se le repone con un recibo (`montoRepuesto`) o se le
 *                      aplica como saldo a favor en un fondo posterior
 *                      (`montoCompensado`).
 *   CERRADO_CON_DEUDA: el saldo sin justificar ya se cargó al kardex
 *                      (terminal, no admite más justificaciones).
 */
@Entity({
  name: 'fondo_rendir',
  schema: 'contabilidad',
})
export class FondoRendir extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

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
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

  // Fecha Y hora reales en que se registró la entrega (a diferencia de
  // `fecha`, que es la fecha de negocio, editable, solo día). La asigna el
  // servidor al entregar, no se recibe del front. Mismo patrón que
  // Recibo.fechaHoraGeneracion.
  @Column({
    name: 'fecha_hora_entrega',
    type: 'timestamptz',
  })
  fechaHoraEntrega: Date;

  @Column({
    name: 'concepto',
    type: 'varchar',
    length: 255,
  })
  concepto: string;

  @Column({
    name: 'monto_entregado',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  montoEntregado: number;

  @Column({
    name: 'id_recibo',
    type: 'bigint',
  })
  idRecibo: string;

  @ManyToOne(() => Recibo, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_recibo',
    referencedColumnName: 'id',
  })
  recibo?: Recibo;

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

  @Column({
    name: 'fecha_limite',
    type: 'date',
    nullable: true,
  })
  fechaLimite?: string | null;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 20,
    default: 'PENDIENTE',
  })
  estado: EstadoFondoRendir;

  @Column({
    name: 'id_movimiento_kardex_cierre',
    type: 'bigint',
    nullable: true,
  })
  idMovimientoKardexCierre?: string | null;

  @ManyToOne(() => MovimientoKardex, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_movimiento_kardex_cierre',
    referencedColumnName: 'id',
  })
  movimientoKardexCierre?: MovimientoKardex;

  // Excedente (justificado > entregado) ya devuelto al destinatario con un
  // recibo de EGRESO (`reciboReposicion`): sale de caja o de la libreta.
  @Column({
    name: 'monto_repuesto',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  montoRepuesto: number;

  @Column({
    name: 'id_recibo_reposicion',
    type: 'bigint',
    nullable: true,
  })
  idReciboReposicion?: string | null;

  @ManyToOne(() => Recibo, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_recibo_reposicion',
    referencedColumnName: 'id',
  })
  reciboReposicion?: Recibo;

  @Column({
    name: 'fecha_reposicion',
    type: 'date',
    nullable: true,
  })
  fechaReposicion?: string | null;

  // Excedente que NO se devolvió y se aplicó como ya justificado en un fondo
  // posterior del mismo destinatario (`idFondoCompensacion`), donde figura
  // como una línea de tipo SALDO_FAVOR.
  @Column({
    name: 'monto_compensado',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  montoCompensado: number;

  @Column({
    name: 'id_fondo_compensacion',
    type: 'bigint',
    nullable: true,
  })
  idFondoCompensacion?: string | null;

  @OneToMany(() => FondoRendirDetalle, (detalle) => detalle.fondoRendir)
  detalles?: FondoRendirDetalle[];
}
