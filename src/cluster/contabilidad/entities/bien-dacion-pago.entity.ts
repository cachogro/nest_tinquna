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
import { Recibo } from './recibo.entity';
import { BienDacionPagoGasto } from './bien-dacion-pago-gasto.entity';
import { PersonaAutorizo } from '../persona-autorizo.util';

export type EstadoBienDacionPago =
  | 'EN_POSESION'
  | 'TOMADO_EN_PAGO'
  | 'VENDIDO'
  | 'DEVUELTO';

/**
 * Dación en pago: un actor productivo minero o una persona asociada a uno
 * entrega un bien (ej. una moto) a cuenta de su deuda en el kardex, por un
 * valor acordado (`valorReferencial`).
 *
 *   EN_POSESION:    la empresa lo retiene. Recibirlo no mueve kardex ni caja.
 *                   Desde acá se puede devolver, vender directo o tomar en pago.
 *   TOMADO_EN_PAGO: la empresa se queda con el bien: `montoAmortizado` se
 *                   abona como HABER en el kardex del dueño
 *                   (`idMovimientoKardex`), sin mover caja. Ya no se puede
 *                   devolver; se le pueden cargar gastos (`gastos`, egresos
 *                   reales de caja/banco que no tocan el kardex) y al
 *                   venderlo solo entra el dinero.
 *   VENDIDO:        `montoVenta` entró DIRECTO a la caja de flujo
 *                   (`idMovimientoCaja`) o a la libreta de bancos
 *                   (`idLibretaBanco`), sin recibo. Si se vendió desde
 *                   EN_POSESION, la misma operación abonó `montoAmortizado`
 *                   al kardex.
 *   DEVUELTO:       se le devolvió al dueño (`fechaDevolucion`); el motivo
 *                   se anota en `observaciones`. No genera nada.
 *
 * Resultado de la venta para la empresa (no se persiste, se calcula):
 *   montoVenta - montoAmortizado - gastos activos.
 */
@Entity({
  name: 'bien_dacion_pago',
  schema: 'contabilidad',
})
export class BienDacionPago extends Auditoria {
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
    name: 'fecha_recepcion',
    type: 'date',
  })
  fechaRecepcion: string;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 255,
  })
  descripcion: string;

  // Valor acordado con el dueño: lo que se propone amortizar de su deuda al
  // tomar el bien en pago o venderlo. Obligatorio en los registros nuevos
  // (null solo en bienes anteriores a la 087).
  @Column({
    name: 'valor_referencial',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  valorReferencial?: number | null;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 15,
    default: 'EN_POSESION',
  })
  estado: EstadoBienDacionPago;

  @Column({
    name: 'fecha_venta',
    type: 'date',
    nullable: true,
  })
  fechaVenta?: string | null;

  @Column({
    name: 'monto_venta',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  montoVenta?: number | null;

  @Column({
    name: 'fecha_devolucion',
    type: 'date',
    nullable: true,
  })
  fechaDevolucion?: string | null;

  // Fecha en que la empresa se quedó con el bien (TOMADO_EN_PAGO).
  @Column({
    name: 'fecha_toma_pago',
    type: 'date',
    nullable: true,
  })
  fechaTomaPago?: string | null;

  // Lo que se abonó (HABER) al kardex del dueño, al tomar el bien en pago o
  // en una venta directa.
  @Column({
    name: 'monto_amortizado',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  montoAmortizado?: number | null;

  // Ingreso de la venta: caja de flujo (efectivo) o libreta de bancos.
  @Column({
    name: 'id_movimiento_caja',
    type: 'bigint',
    nullable: true,
  })
  idMovimientoCaja?: string | null;

  @Column({
    name: 'id_libreta_banco',
    type: 'bigint',
    nullable: true,
  })
  idLibretaBanco?: string | null;

  // Quien autorizó la venta (snapshot, sin FK; ver PersonaAutorizo).
  @Column({
    name: 'persona_autorizo',
    type: 'jsonb',
    nullable: true,
  })
  personaAutorizo?: PersonaAutorizo | null;

  @OneToMany(() => BienDacionPagoGasto, (gasto) => gasto.bienDacionPago)
  gastos?: BienDacionPagoGasto[];

  // Recibo de INGRESO de los bienes vendidos ANTES de la 087 (hoy la venta
  // entra directo a caja/banco, sin recibo).
  @Column({
    name: 'id_recibo',
    type: 'bigint',
    nullable: true,
  })
  idRecibo?: string | null;

  @ManyToOne(() => Recibo, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_recibo',
    referencedColumnName: 'id',
  })
  recibo?: Recibo;

  // Línea HABER del kardex que amortizó la deuda (`montoAmortizado`).
  @Column({
    name: 'id_movimiento_kardex',
    type: 'bigint',
    nullable: true,
  })
  idMovimientoKardex?: string | null;

  // Texto libre: también donde se anota el motivo de una devolución.
  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observaciones?: string | null;
}
