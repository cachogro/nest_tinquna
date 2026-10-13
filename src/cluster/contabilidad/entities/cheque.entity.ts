import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ColumnNumericTransformer } from 'src/common/utils/numeric-column.transform';
import { TalonarioCheque } from './talonario-cheque.entity';

export type EstadoCheque = 'EMITIDO' | 'COBRADO' | 'ANULADO';

/**
 * Un número de cheque ya usado de un talonario.
 *
 * - EMITIDO: se entregó en un pago y el banco todavía no lo pagó. Tiene
 *   `fechaLimiteCobro` (30 días desde la emisión o la última revalidación).
 * - COBRADO: el banco ya lo pagó (`fechaCobro`).
 * - ANULADO: no vale; el número igual se consume (no se reutiliza).
 */
@Entity({
  name: 'cheque',
  schema: 'contabilidad',
})
export class Cheque extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_talonario_cheque',
    type: 'int',
  })
  idTalonarioCheque: number;

  @ManyToOne(() => TalonarioCheque, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_talonario_cheque',
    referencedColumnName: 'id',
  })
  talonarioCheque?: TalonarioCheque;

  @Column({
    name: 'numero',
    type: 'bigint',
    transformer: new ColumnNumericTransformer(),
  })
  numero: number;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 10,
    default: 'EMITIDO',
  })
  estado: EstadoCheque;

  @Column({
    name: 'fecha_emision',
    type: 'date',
    nullable: true,
  })
  fechaEmision?: string | null;

  // Último día para presentarlo al cobro.
  @Column({
    name: 'fecha_limite_cobro',
    type: 'date',
    nullable: true,
  })
  fechaLimiteCobro?: string | null;

  @Column({
    name: 'fecha_revalidacion',
    type: 'date',
    nullable: true,
  })
  fechaRevalidacion?: string | null;

  @Column({
    name: 'fecha_cobro',
    type: 'date',
    nullable: true,
  })
  fechaCobro?: string | null;

  @Column({
    name: 'monto',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  monto?: number | null;

  @Column({
    name: 'beneficiario',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  beneficiario?: string | null;

  @Column({
    name: 'concepto',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  concepto?: string | null;

  @Column({
    name: 'motivo_anulacion',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  motivoAnulacion?: string | null;

  // Movimiento de la libreta de bancos que lo emitió. NULL si se anuló en
  // blanco (cheque dañado o extraviado que nunca se usó en un pago).
  @Column({
    name: 'id_libreta_banco',
    type: 'bigint',
    nullable: true,
  })
  idLibretaBanco?: string | null;
}
