import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { KardexInteres } from './kardex-interes.entity';
import { MovimientoKardex } from './movimiento-kardex.entity';

export type EstadoKardexInteresCuota = 'PENDIENTE' | 'CARGADO' | 'CONDONADO';

/**
 * Interés de un mes de un plan (KardexInteres). El mes N va de `fechaDesde`
 * a `fechaCorte` (fechaInicio + N meses) y `monto` = `saldoBase` x `tasa` /
 * 100, donde `saldoBase` es el saldo del kardex al día de corte.
 *
 *   PENDIENTE: devengada y todavía negociable; se recalcula si cambia la
 *              tasa o si se corrige un movimiento anterior al corte.
 *   CARGADO:   ya está en el kardex (`idMovimientoKardex` = su línea DEBE).
 *   CONDONADO: perdonada, no se cobra.
 */
@Entity({
  name: 'kardex_interes_cuota',
  schema: 'contabilidad',
})
export class KardexInteresCuota extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_kardex_interes',
    type: 'bigint',
  })
  idKardexInteres: string;

  @ManyToOne(() => KardexInteres, (plan) => plan.cuotas, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_kardex_interes',
    referencedColumnName: 'id',
  })
  kardexInteres?: KardexInteres;

  @Column({
    name: 'numero',
    type: 'int',
  })
  numero: number;

  @Column({
    name: 'fecha_desde',
    type: 'date',
  })
  fechaDesde: string;

  @Column({
    name: 'fecha_corte',
    type: 'date',
  })
  fechaCorte: string;

  @Column({
    name: 'saldo_base',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  saldoBase: number;

  @Column({
    name: 'tasa',
    type: 'numeric',
    precision: 7,
    scale: 4,
  })
  tasa: number;

  @Column({
    name: 'monto',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  monto: number;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 10,
    default: 'PENDIENTE',
  })
  estado: EstadoKardexInteresCuota;

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
