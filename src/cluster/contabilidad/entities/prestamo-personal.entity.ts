import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { PersonaAutorizo } from '../persona-autorizo.util';
import { Recibo } from './recibo.entity';
import { MovimientoKardex } from './movimiento-kardex.entity';
import { MovimientoPrestamo } from './movimiento-prestamo.entity';

export type EstadoPrestamo = 'VIGENTE' | 'CANCELADO';

/**
 * Préstamo grande a un empleado (personal interno, kardex PERSONAL), por
 * ejemplo para comprar una moto. Distinto de un anticipo común: se pacta
 * una `cuotaMensual` que se le descuenta del sueldo en cada boleta de pago.
 *
 * La plata sale con un recibo de EGRESO real (caja o banco) que además
 * registra un DEBE en el kardex PERSONAL, junto con sus demás deudas. Como
 * el kardex mezcla todo, el préstamo lleva aparte su propio sub-libro
 * (`MovimientoPrestamo`) para saber cuánto se debe exactamente de ESTE
 * préstamo. `saldo` y `estado` se recalculan desde ese sub-libro.
 *
 *   VIGENTE:   saldo > 0.
 *   CANCELADO: saldo = 0.
 */
@Entity({
  name: 'prestamo_personal',
  schema: 'contabilidad',
})
export class PrestamoPersonal extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  // N° del préstamo (correlativo global). NO es el id.
  @Column({
    name: 'numero',
    type: 'int',
  })
  numero: number;

  @Column({
    name: 'id_persona',
    type: 'bigint',
  })
  idPersona: string;

  @ManyToOne(() => PersonaCi, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_persona',
    referencedColumnName: 'id',
  })
  persona?: PersonaCi;

  @Column({
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

  // A cuenta de qué se prestó (ej. "COMPRA DE MOTO HONDA XR150").
  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 255,
  })
  descripcion: string;

  @Column({
    name: 'monto',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  monto: number;

  // Descuento mensual pactado. Es una sugerencia: en cada boleta se puede
  // descontar más, menos o nada.
  @Column({
    name: 'cuota_mensual',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  cuotaMensual: number;

  @Column({
    name: 'saldo',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  saldo: number;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 10,
    default: 'VIGENTE',
  })
  estado: EstadoPrestamo;

  // Recibo de EGRESO con el que salió la plata.
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

  // Línea DEBE que ese recibo generó en el kardex PERSONAL.
  @Column({
    name: 'id_movimiento_kardex',
    type: 'bigint',
  })
  idMovimientoKardex: string;

  @ManyToOne(() => MovimientoKardex, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_movimiento_kardex',
    referencedColumnName: 'id',
  })
  movimientoKardex?: MovimientoKardex;

  // Snapshot de quién autorizó el préstamo (sin FK, igual que en recibo).
  @Column({
    name: 'persona_autorizo',
    type: 'jsonb',
    nullable: true,
  })
  personaAutorizo?: PersonaAutorizo | null;

  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observaciones?: string | null;

  @OneToMany(() => MovimientoPrestamo, (mov) => mov.prestamo)
  movimientos?: MovimientoPrestamo[];
}
