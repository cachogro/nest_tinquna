import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { PrestamoPersonal } from './prestamo-personal.entity';
import { MovimientoKardex } from './movimiento-kardex.entity';
import { Recibo } from './recibo.entity';
import { BoletaPago } from './boleta-pago.entity';

export type TipoMovimientoPrestamo = 'OTORGAMIENTO' | 'DESCUENTO_SUELDO' | 'ABONO';

/**
 * Línea del sub-libro de un préstamo al personal. Cada línea tiene su espejo
 * en el kardex PERSONAL (`idMovimientoKardex`); acá solo se ve lo de ESTE
 * préstamo, sin mezclar los demás anticipos del kardex.
 *
 *   OTORGAMIENTO:     DEBE, la entrega del préstamo (recibo EGRESO).
 *   DESCUENTO_SUELDO: HABER, descontado en una boleta de pago. No mueve
 *                     dinero: el kardex recibe un HABER sin caja/banco.
 *   ABONO:            HABER, el empleado trae dinero de otro lado (recibo
 *                     INGRESO, entra a caja/banco).
 *
 * `saldo` = saldo corriente tras la línea (debe - haber acumulado).
 */
@Entity({
  name: 'movimiento_prestamo',
  schema: 'contabilidad',
})
export class MovimientoPrestamo extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_prestamo',
    type: 'bigint',
  })
  idPrestamo: string;

  @ManyToOne(() => PrestamoPersonal, (prestamo) => prestamo.movimientos, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_prestamo',
    referencedColumnName: 'id',
  })
  prestamo?: PrestamoPersonal;

  @Column({
    name: 'numero_linea',
    type: 'int',
  })
  numeroLinea: number;

  @Column({
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

  @Column({
    name: 'tipo',
    type: 'varchar',
    length: 20,
  })
  tipo: TipoMovimientoPrestamo;

  @Column({
    name: 'detalle',
    type: 'varchar',
    length: 255,
  })
  detalle: string;

  @Column({
    name: 'debe',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  debe: number;

  @Column({
    name: 'haber',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  haber: number;

  @Column({
    name: 'saldo',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  saldo: number;

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

  // OTORGAMIENTO / ABONO: recibo que movió la plata.
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

  // DESCUENTO_SUELDO: boleta en la que se descontó.
  @Column({
    name: 'id_boleta_pago',
    type: 'bigint',
    nullable: true,
  })
  idBoletaPago?: string | null;

  @ManyToOne(() => BoletaPago, (boleta) => boleta.descuentosPrestamo, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_boleta_pago',
    referencedColumnName: 'id',
  })
  boletaPago?: BoletaPago;
}
