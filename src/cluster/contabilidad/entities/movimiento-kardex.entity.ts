import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { KardexSubcuenta } from 'src/cluster/parametricas/entities/kardex-subcuenta.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ValorizacionMineral } from 'src/cluster/comercio-interno/entities/valorizacion/valorizacion-mineral.entity';
import { Kardex } from './kardex.entity';
import { Recibo } from './recibo.entity';

/**
 * Línea de un kardex de anticipos (hoja 2 del Excel).
 * `numeroLinea` reinicia en 1 en cada kardex (cada apertura N°1, N°2... es
 * una fila distinta de `contabilidad.kardex`).
 *
 * `debe`  = anticipo entregado (sube la deuda del destinatario)
 * `haber` = pago / descuento (la baja)
 * `saldo` = saldo corriente tras el movimiento
 */
@Entity({
  name: 'movimiento_kardex',
  schema: 'contabilidad',
})
export class MovimientoKardex extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_kardex',
    type: 'bigint',
  })
  idKardex: string;

  @ManyToOne(() => Kardex, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_kardex',
    referencedColumnName: 'id',
  })
  kardex?: Kardex;

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

  // N° de comprobante / documento ("REC:C-203", "DET. ADJ.", "QR", "ICC-1810"...).
  @Column({
    name: 'nro_comprobante',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  nroComprobante?: string;

  @Column({
    name: 'detalle',
    type: 'varchar',
    length: 255,
  })
  detalle: string;

  @Column({
    name: 'id_subcuenta',
    type: 'int',
    nullable: true,
  })
  idSubcuenta?: number | null;

  @ManyToOne(() => KardexSubcuenta, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_subcuenta',
    referencedColumnName: 'id',
  })
  subcuenta?: KardexSubcuenta;

  @Column({
    name: 'id_forma_pago',
    type: 'int',
    nullable: true,
  })
  idFormaPago?: number | null;

  @ManyToOne(() => FormaPago, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_forma_pago',
    referencedColumnName: 'id',
  })
  formaPago?: FormaPago;

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

  // Quién recibió / entregó físicamente el movimiento.
  @Column({
    name: 'id_cobrador',
    type: 'bigint',
    nullable: true,
  })
  idCobrador?: string | null;

  @ManyToOne(() => PersonaCi, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_cobrador',
    referencedColumnName: 'id',
  })
  cobrador?: PersonaCi;

  // Presente cuando el movimiento nace de tranzar una valorización.
  @Column({
    name: 'id_valorizacion',
    type: 'bigint',
    nullable: true,
  })
  idValorizacion?: string | null;

  @ManyToOne(() => ValorizacionMineral, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_valorizacion',
    referencedColumnName: 'id',
  })
  valorizacion?: ValorizacionMineral;

  // Presente cuando el movimiento nace de generar un recibo (ingreso/egreso).
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
