import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Kardex } from './kardex.entity';
import { PagoValorizacion } from './pago-valorizacion.entity';

/**
 * ABONO: lo que el proveedor deja a un kardex de su líquido pagable.
 * ANTICIPO: cancela el anticipo de la recepción donde el recibo lo cargó.
 * OTROS_ANTICIPOS: cancela los "otros anticipos" descontados al valorizar.
 */
export type ConceptoPagoValorizacion = 'ABONO' | 'ANTICIPO' | 'OTROS_ANTICIPOS';

/** Línea de kardex (siempre HABER: baja la deuda) de un pago de valorización. */
@Entity({
  name: 'pago_valorizacion_detalle',
  schema: 'contabilidad',
})
export class PagoValorizacionDetalle extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_pago_valorizacion',
    type: 'bigint',
  })
  idPagoValorizacion: string;

  @ManyToOne(() => PagoValorizacion, (p) => p.detalles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'id_pago_valorizacion',
    referencedColumnName: 'id',
  })
  pagoValorizacion?: PagoValorizacion;

  @Column({
    name: 'concepto',
    type: 'varchar',
    length: 20,
  })
  concepto: ConceptoPagoValorizacion;

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
    name: 'monto',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  monto: number;

  @Column({
    name: 'id_movimiento_kardex',
    type: 'bigint',
    nullable: true,
  })
  idMovimientoKardex?: string | null;
}
