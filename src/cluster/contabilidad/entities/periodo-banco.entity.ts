import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';

export type TipoPeriodoBanco = 'MENSUAL' | 'GESTION';
export type EstadoPeriodoBanco = 'ABIERTO' | 'CERRADO';

/**
 * Período de la libreta de bancos de una cuenta.
 *   - MENSUAL: mes 1-12. Es el tramo de carga.
 *   - GESTION: mes NULL. Resumen anual; se cierra cuando sus 12 meses están cerrados.
 *
 * El saldo de banco NO se reinicia: `saldoFinal` de un período mensual es el
 * `saldoInicial` del siguiente.
 */
@Entity({
  name: 'periodo_banco',
  schema: 'contabilidad',
})
export class PeriodoBanco extends Auditoria {
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
    name: 'tipo',
    type: 'varchar',
    length: 10,
  })
  tipo: TipoPeriodoBanco;

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
  estado: EstadoPeriodoBanco;

  @Column({
    name: 'saldo_inicial',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  saldoInicial: number;

  @Column({
    name: 'total_debe',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  totalDebe: number;

  @Column({
    name: 'total_haber',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  totalHaber: number;

  @Column({
    name: 'saldo_final',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  saldoFinal: number | null;

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
