import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { FondoRendir } from './fondo-rendir.entity';

export type TipoFondoRendirDetalle =
  | 'COMPROBANTE'
  | 'SIN_COMPROBANTE'
  | 'SALDO_FAVOR';

/**
 * Línea de justificación de un `FondoRendir`: un gasto puntual con su
 * comprobante (ej. "COMPRA DE CEMENTO - FACTURA 123"). No mueve plata de
 * caja/banco: la plata ya salió cuando se entregó el fondo, esto es solo la
 * evidencia de en qué se gastó.
 */
@Entity({
  name: 'fondo_rendir_detalle',
  schema: 'contabilidad',
})
export class FondoRendirDetalle extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_fondo_rendir',
    type: 'bigint',
  })
  idFondoRendir: string;

  @ManyToOne(() => FondoRendir, (fondo) => fondo.detalles, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_fondo_rendir',
    referencedColumnName: 'id',
  })
  fondoRendir?: FondoRendir;

  @Column({
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

  @Column({
    name: 'concepto',
    type: 'varchar',
    length: 255,
  })
  concepto: string;

  @Column({
    name: 'monto',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  monto: number;

  // N° de factura, nota de venta, recibo, etc. que respalda esta línea.
  @Column({
    name: 'nro_comprobante',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  nroComprobante?: string | null;

  @Column({
    name: 'factura_recibo',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  facturaRecibo?: string | null;

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

  // COMPROBANTE:     gasto con respaldo, cargado a mano (lo normal).
  // SIN_COMPROBANTE: el fondo se dio por rendido sin cargar comprobantes;
  //                  la línea cubre el saldo que quedaba pendiente.
  // SALDO_FAVOR:     excedente de un fondo anterior del mismo destinatario
  //                  (`idFondoOrigen`) que entra acá como ya justificado.
  @Column({
    name: 'tipo',
    type: 'varchar',
    length: 20,
    default: 'COMPROBANTE',
  })
  tipo: TipoFondoRendirDetalle;

  @Column({
    name: 'id_fondo_origen',
    type: 'bigint',
    nullable: true,
  })
  idFondoOrigen?: string | null;
}
