import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Caja } from 'src/cluster/parametricas/entities/caja.entity';

export type TipoPeriodoCaja = 'MENSUAL' | 'GESTION';
export type EstadoPeriodoCaja = 'ABIERTO' | 'CERRADO';
export type MonedaCaja = 'BOB' | 'USD';

/**
 * Período de la caja de flujo, igual mecanismo que PeriodoBanco:
 *   - MENSUAL: mes 1-12. Es el tramo de carga.
 *   - GESTION: mes NULL. Resumen anual; se cierra cuando sus 12 meses están cerrados.
 *
 * Una caja opera en varias monedas a la vez, por lo que cada (caja, moneda)
 * lleva su propia cadena de períodos. El saldo NO se reinicia: `saldoFinal`
 * de un período mensual es el `saldoInicial` del siguiente (misma moneda).
 */
@Entity({
  name: 'periodo_caja',
  schema: 'contabilidad',
})
export class PeriodoCaja extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_caja',
    type: 'int',
  })
  idCaja: number;

  @ManyToOne(() => Caja, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_caja',
    referencedColumnName: 'id',
  })
  caja?: Caja;

  @Column({
    name: 'moneda',
    type: 'varchar',
    length: 3,
  })
  moneda: MonedaCaja;

  @Column({
    name: 'tipo',
    type: 'varchar',
    length: 10,
  })
  tipo: TipoPeriodoCaja;

  @Column({
    name: 'gestion',
    type: 'int',
  })
  gestion: number;

  @Column({
    name: 'mes',
    type: 'int',
    nullable: true,
  })
  mes?: number | null;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 10,
    default: 'ABIERTO',
  })
  estado: EstadoPeriodoCaja;

  @Column({
    name: 'saldo_inicial',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  saldoInicial: number;

  @Column({
    name: 'total_ingreso',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  totalIngreso: number;

  @Column({
    name: 'total_egreso',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  totalEgreso: number;

  @Column({
    name: 'saldo_final',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  saldoFinal: number | null;

  // Responsable de caja del período (texto libre, ej. "VANIA CONDORI ZURITA").
  @Column({
    name: 'responsable',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  responsable?: string | null;

  @Column({
    name: 'fecha_cierre',
    type: 'date',
    nullable: true,
  })
  fechaCierre?: string | null;

  @Column({
    name: 'cerrado_por',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  cerradoPor?: string | null;
}
