import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ColumnNumericTransformer } from 'src/common/utils/numeric-column.transform';
import { PromedioMineral } from 'src/cluster/comercio-interno/entities/promedio/promedio-mineral.entity';
import { Cliente } from 'src/cluster/parametricas/entities/cliente.entity';
import { MonedaCaja } from './periodo-caja.entity';
import { MovimientoKardex } from './movimiento-kardex.entity';
import { Recibo } from './recibo.entity';

export type EstadoVentaLote = 'ABIERTA' | 'LIQUIDADA' | 'ANULADA';

/**
 * Venta de un lote entero (promedio de mineral) a un cliente comprador.
 *
 * Los anticipos/pagos del comprador son recibos de INGRESO vinculados por
 * `Recibo.idVentaLote`: su línea CLIENTE postea HABER en el kardex del
 * cliente y el dinero entra a caja (efectivo) o a la libreta bancaria.
 * Al liquidar se registra el monto neto de la liquidación del comprador y
 * un DEBE por ese monto (en Bs.) en el mismo kardex, que queda en 0 cuando
 * se terminó de cobrar.
 *
 *   ABIERTA:   sin liquidación todavía (solo anticipos).
 *   LIQUIDADA: con monto de venta; "pagada" cuando lo cobrado lo cubre.
 *   ANULADA:   sin cobros vigentes; libera el promedio.
 */
@Entity({
  name: 'venta_lote',
  schema: 'contabilidad',
})
export class VentaLote extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'id_promedio_mineral', type: 'bigint' })
  idPromedioMineral: string;

  @ManyToOne(() => PromedioMineral, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_promedio_mineral', referencedColumnName: 'id' })
  promedioMineral?: PromedioMineral;

  // Foto del código del lote del promedio al vender (ej. MC-0006).
  @Column({ name: 'codigo_lote', type: 'varchar', length: 30, nullable: true })
  codigoLote?: string | null;

  @Column({ name: 'id_cliente', type: 'bigint' })
  idCliente: string;

  @ManyToOne(() => Cliente, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_cliente', referencedColumnName: 'id' })
  cliente?: Cliente;

  @Column({ name: 'fecha_venta', type: 'date' })
  fechaVenta: string;

  // BS = comercio interno; USD = exportación (con tipo de cambio).
  @Column({ name: 'moneda', type: 'varchar', length: 3, default: 'BS' })
  moneda: MonedaCaja;

  @Column({
    name: 'tipo_cambio',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  tipoCambio?: number | null;

  // Foto del efectivo invertido del promedio (Bs) al crear la venta.
  @Column({
    name: 'total_efectivo_invertido',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalEfectivoInvertido: number;

  // Liquidación final (neto) del comprador, en la moneda de la venta.
  @Column({
    name: 'monto_venta',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  montoVenta?: number | null;

  // Mismo monto en Bs. (en USD: monto × tipo de cambio de la liquidación).
  @Column({
    name: 'monto_venta_bolivianos',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  montoVentaBolivianos?: number | null;

  @Column({ name: 'fecha_liquidacion', type: 'date', nullable: true })
  fechaLiquidacion?: string | null;

  // DEBE en el kardex del cliente por el monto de la liquidación.
  @Column({
    name: 'id_movimiento_kardex_liquidacion',
    type: 'bigint',
    nullable: true,
  })
  idMovimientoKardexLiquidacion?: string | null;

  @ManyToOne(() => MovimientoKardex, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'id_movimiento_kardex_liquidacion',
    referencedColumnName: 'id',
  })
  movimientoKardexLiquidacion?: MovimientoKardex;

  @Column({ name: 'estado', type: 'varchar', length: 10, default: 'ABIERTA' })
  estado: EstadoVentaLote;

  @Column({ name: 'observaciones', type: 'varchar', length: 255, nullable: true })
  observaciones?: string | null;

  // Anticipos/pagos del comprador (recibos de INGRESO).
  @OneToMany(() => Recibo, (recibo) => recibo.ventaLote)
  recibos?: Recibo[];
}
