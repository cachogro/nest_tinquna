import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { PeriodoBanco } from './periodo-banco.entity';
import { Recibo } from './recibo.entity';
import { MovimientoKardex } from './movimiento-kardex.entity';

/**
 * Libreta de bancos: el mayor de una cuenta bancaria. Una fila por movimiento,
 * cargado manualmente, dentro de un período mensual.
 *
 * `debe`  = salida / cargo (egreso)
 * `haber` = entrada / abono (ingreso, depósito)
 * `saldo` = saldo corriente tras el movimiento; lo recalcula el servicio a
 *           partir del `saldoInicial` del período (que arrastra del anterior).
 * `folio` = número de línea del libro, correlativo por (cuenta, gestión).
 */
@Entity({
  name: 'libreta_banco',
  schema: 'contabilidad',
})
export class LibretaBanco extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_cuenta_bancaria',
    type: 'int',
  })
  idCuentaBancaria: number;

  @ManyToOne(() => CuentaBancaria, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_cuenta_bancaria',
    referencedColumnName: 'id',
  })
  cuentaBancaria?: CuentaBancaria;

  @Column({
    name: 'id_periodo_banco',
    type: 'bigint',
  })
  idPeriodoBanco: string;

  @ManyToOne(() => PeriodoBanco, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_periodo_banco',
    referencedColumnName: 'id',
  })
  periodoBanco?: PeriodoBanco;

  @Column({
    name: 'folio',
    type: 'int',
    nullable: true,
  })
  folio?: number | null;

  @Column({
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

  // N° de transacción del banco (ej. n° de transferencia/QR), independiente
  // del recibo/factura que la respalda.
  @Column({
    name: 'nro_transaccion',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  nroTransaccion?: string;

  // Código del recibo (o factura) que respalda el movimiento (ej.
  // "REC:INGRESO-0009"), independiente del n° de transacción bancaria.
  @Column({
    name: 'factura_recibo',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  facturaRecibo?: string | null;

  // Beneficiario / contraparte del movimiento (texto libre).
  @Column({
    name: 'nombres_apellidos',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  nombresApellidos?: string;

  // Vínculo opcional a una persona ya registrada (persona_ci). Si el
  // beneficiario no está en la lista, queda NULL y solo vale nombresApellidos.
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
    name: 'concepto',
    type: 'varchar',
    length: 255,
  })
  concepto: string;

  // Presente cuando el movimiento nace de la línea EFECTIVO de un recibo
  // pagado por un medio bancario (idCuentaBancaria). Las líneas
  // PERSONAL/ACTOR de un recibo nunca generan movimiento acá: solo saldan
  // una deuda en el kardex, no representan plata que realmente se mueve.
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

  // Presente cuando el movimiento nace de una línea de kardex cargada
  // directamente (no vía recibo) con idCuentaBancaria: misma dirección que
  // el movimiento de caja que generó esa línea (DEBE=anticipo->sale del
  // banco, HABER=pago->entra al banco).
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
}
