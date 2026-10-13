import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { PagoValorizacion } from './pago-valorizacion.entity';

/**
 * Medio de pago de un pago de valorización MIXTO (dos medios o más). Solo
 * hay filas cuando el pago es mixto; con un solo medio, todo vive en la
 * cabecera. La suma de `monto` es igual a `pagoValorizacion.montoPagado`.
 * Cada medio guarda el movimiento que generó: en caja (efectivo) o en la
 * libreta (medio bancario).
 */
@Entity({
  name: 'pago_valorizacion_medio',
  schema: 'contabilidad',
})
export class PagoValorizacionMedio extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_pago_valorizacion',
    type: 'bigint',
  })
  idPagoValorizacion: string;

  @ManyToOne(() => PagoValorizacion, (p) => p.medios, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'id_pago_valorizacion',
    referencedColumnName: 'id',
  })
  pagoValorizacion?: PagoValorizacion;

  @Column({
    name: 'orden',
    type: 'int',
    default: 1,
  })
  orden: number;

  @Column({
    name: 'id_forma_pago',
    type: 'int',
  })
  idFormaPago: number;

  @ManyToOne(() => FormaPago, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_forma_pago',
    referencedColumnName: 'id',
  })
  formaPago?: FormaPago;

  @Column({
    name: 'id_cuenta_bancaria',
    type: 'int',
    nullable: true,
  })
  idCuentaBancaria?: number | null;

  @ManyToOne(() => CuentaBancaria, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_cuenta_bancaria',
    referencedColumnName: 'id',
  })
  cuentaBancaria?: CuentaBancaria | null;

  @Column({
    name: 'nro_comprobante',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  nroComprobante?: string | null;

  @Column({
    name: 'monto',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  monto: number;

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
}
