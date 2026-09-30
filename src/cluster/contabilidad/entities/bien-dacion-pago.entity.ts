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
import { Recibo } from './recibo.entity';

export type EstadoBienDacionPago = 'EN_POSESION' | 'VENDIDO' | 'DEVUELTO';

/**
 * Dación en pago: un actor productivo minero o una persona asociada a uno
 * entrega un bien (ej. un auto) en lugar de efectivo, para más adelante
 * saldar (total o parcialmente) su deuda en el kardex. Mientras está en
 * poder de la empresa es solo el registro del bien (qué, de quién y un valor
 * referencial aproximado): recibirlo o devolverlo no mueve kardex ni caja.
 * Al VENDERLO, el monto amortiza su deuda: se genera un recibo de INGRESO
 * (`idRecibo`) con HABER en su kardex (`idMovimientoKardex`) y entrada a la
 * caja de flujo (o a la libreta bancaria si se cobró por banco).
 *
 *   EN_POSESION: la empresa tiene el bien, pendiente de vender o devolver.
 *   VENDIDO:     se vendió (`fechaVenta`, `montoVenta`, recibo de ingreso).
 *   DEVUELTO:    se le devolvió al destinatario (`fechaDevolucion`); el
 *                motivo se anota en `observaciones`, no hay un campo aparte.
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

  // Avalúo aproximado, no exacto: solo referencia mientras el bien está en
  // poder de la empresa. No se usa para postear nada en el kardex.
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

  // Recibo de INGRESO generado al vender (null en los vendidos antes de que
  // la venta amortizara la deuda).
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

  // Línea HABER del kardex que amortizó la deuda con el monto de la venta.
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
