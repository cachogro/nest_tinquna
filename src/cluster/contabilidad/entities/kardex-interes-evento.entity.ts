import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { KardexInteres } from './kardex-interes.entity';

export type TipoKardexInteresEvento =
  | 'APLICACION'
  | 'CAMBIO_TASA'
  | 'CONDONACION'
  | 'CARGO_KARDEX'
  | 'REVERSION_CARGO'
  | 'FINALIZACION';

/**
 * Bitácora de lo decidido sobre un plan de interés: quién lo aplicó, cuándo
 * se bajó la tasa (y cuánto cambió lo pendiente), qué se condonó y qué se
 * cargó al kardex.
 */
@Entity({
  name: 'kardex_interes_evento',
  schema: 'contabilidad',
})
export class KardexInteresEvento extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_kardex_interes',
    type: 'bigint',
  })
  idKardexInteres: string;

  @ManyToOne(() => KardexInteres, (plan) => plan.eventos, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_kardex_interes',
    referencedColumnName: 'id',
  })
  kardexInteres?: KardexInteres;

  @Column({
    name: 'tipo',
    type: 'varchar',
    length: 20,
  })
  tipo: TipoKardexInteresEvento;

  @Column({
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

  @Column({
    name: 'tasa_anterior',
    type: 'numeric',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  tasaAnterior?: number | null;

  @Column({
    name: 'tasa_nueva',
    type: 'numeric',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  tasaNueva?: number | null;

  // CAMBIO_TASA: total pendiente antes del recálculo.
  @Column({
    name: 'monto_anterior',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  montoAnterior?: number | null;

  // Importe afectado: lo cargado, lo condonado o el nuevo total pendiente.
  @Column({
    name: 'monto',
    type: 'numeric',
    precision: 16,
    scale: 2,
    nullable: true,
  })
  monto?: number | null;

  @Column({
    name: 'cuotas',
    type: 'int',
    nullable: true,
  })
  cuotas?: number | null;

  @Column({
    name: 'observacion',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observacion?: string | null;

  @Column({
    name: 'id_movimiento_kardex',
    type: 'bigint',
    nullable: true,
  })
  idMovimientoKardex?: string | null;
}
