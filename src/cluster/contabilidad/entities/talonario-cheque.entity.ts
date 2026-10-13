import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ColumnNumericTransformer } from 'src/common/utils/numeric-column.transform';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';

/**
 * Chequera (talonario) que el banco entrega para una cuenta: un rango
 * correlativo de números de cheque.
 *
 * El talonario no vence por ley; `fechaVencimiento` es opcional, por si el
 * banco la fija en su contrato. Los cheques disponibles no se guardan: son
 * los números del rango que todavía no tienen fila en `contabilidad.cheque`.
 */
@Entity({
  name: 'talonario_cheque',
  schema: 'contabilidad',
})
export class TalonarioCheque extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

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

  // Serie impresa en la chequera, si el banco la usa (ej. "A").
  @Column({
    name: 'serie',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  serie?: string | null;

  @Column({
    name: 'numero_inicial',
    type: 'bigint',
    transformer: new ColumnNumericTransformer(),
  })
  numeroInicial: number;

  @Column({
    name: 'numero_final',
    type: 'bigint',
    transformer: new ColumnNumericTransformer(),
  })
  numeroFinal: number;

  @Column({
    name: 'fecha_recepcion',
    type: 'date',
  })
  fechaRecepcion: string;

  @Column({
    name: 'fecha_vencimiento',
    type: 'date',
    nullable: true,
  })
  fechaVencimiento?: string | null;

  @Column({
    name: 'observacion',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  observacion?: string | null;
}
