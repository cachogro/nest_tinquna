import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { MovimientoCaja } from './movimiento-caja.entity';
import { ReciboDetalle } from './recibo-detalle.entity';

export type TipoRecibo = 'INGRESO' | 'EGRESO';
export type SerieRecibo = 'R' | 'C';
export type EstadoRecibo = 'BORRADOR' | 'PROCESADO' | 'ANULADO';

/**
 * Recibo de ingreso (serie R) o egreso (serie C) que postea automáticamente
 * al kardex de anticipos y a la caja de flujo (Caja id=1, "CAJA PRINCIPAL",
 * el registro maestro de la empresa). El monto se subdivide (ver
 * ReciboDetalle) entre kardex PERSONAL / kardex de un ACTOR / EFECTIVO
 * directo. La porción aplicada a kardex (PERSONAL + ACTOR) siempre postea
 * HABER en ese kardex (salda deuda) y, además, un INGRESO por esa misma
 * suma en la caja de flujo (valor recuperado por la empresa); la porción
 * EFECTIVO no toca ningún kardex, pero genera un EGRESO en la caja de flujo
 * por ese monto (dinero que realmente sale). Un mismo recibo puede generar
 * los dos movimientos de caja a la vez (ver MovimientoCaja.idRecibo).
 *
 * `estado`: BORRADOR = solo la cabecera, alcanza para imprimir el recibo
 * pero todavía no generó ningún movimiento (se puede ANULAR desde acá);
 * PROCESADO = ya tiene `detalles` y sus movimientos de kardex/caja
 * generados (terminal); ANULADO = un BORRADOR dado de baja antes de
 * procesarse (terminal). Se puede crear directo PROCESADO (todo en un paso,
 * mandando `detalles` al crear) o como BORRADOR y procesarlo después.
 *
 * `numero` es correlativo GLOBAL por `serie`: nunca reinicia.
 */
@Entity({
  name: 'recibo',
  schema: 'contabilidad',
})
export class Recibo extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'tipo',
    type: 'varchar',
    length: 10,
  })
  tipo: TipoRecibo;

  @Column({
    name: 'serie',
    type: 'varchar',
    length: 1,
  })
  serie: SerieRecibo;

  @Column({
    name: 'numero',
    type: 'int',
  })
  numero: number;

  @Column({
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

  @Column({
    name: 'monto_total',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  montoTotal: number;

  @Column({
    name: 'concepto',
    type: 'varchar',
    length: 255,
  })
  concepto: string;

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

  // Cuando idFormaPago es un medio bancario (QR, TRANSFERENCIA, CHEQUE,
  // DEPOSITO): cuenta bancaria involucrada + número de comprobante de esa
  // transacción. Es solo informativo del recibo (para la impresión), no
  // genera un movimiento en libreta_banco.
  @Column({
    name: 'id_cuenta_bancaria',
    type: 'int',
    nullable: true,
  })
  idCuentaBancaria?: number | null;

  @ManyToOne(() => CuentaBancaria, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_cuenta_bancaria',
    referencedColumnName: 'id',
  })
  cuentaBancaria?: CuentaBancaria;

  @Column({
    name: 'nro_comprobante',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  nroComprobante?: string | null;

  // Contraparte física del recibo ("Recibí de" / "Entregué a"): UNA de
  // estas tres — persona registrada (idPersona), actor productivo minero
  // (idActorProductivoMinero), o texto libre (nombresApellidos, cuando el
  // recibo se entrega a dos personas o a alguien no registrado). El destino
  // real de cada porción (a quién se le salda la deuda) vive en
  // ReciboDetalle, no acá.
  @Column({
    name: 'id_persona',
    type: 'bigint',
    nullable: true,
  })
  idPersona?: string | null;

  @ManyToOne(() => PersonaCi, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_persona',
    referencedColumnName: 'id',
  })
  persona?: PersonaCi;

  @Column({
    name: 'id_actor_productivo_minero',
    type: 'bigint',
    nullable: true,
  })
  idActorProductivoMinero?: string | null;

  @ManyToOne(() => ActorProductivoMinero, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_actor_productivo_minero',
    referencedColumnName: 'id',
  })
  actorProductivoMinero?: ActorProductivoMinero;

  @Column({
    name: 'nombres_apellidos',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  nombresApellidos?: string | null;

  // Clasificador (parametrica.destino_gasto) aplicado a todas las líneas de
  // kardex y movimientos de caja que genera este recibo.
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

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 10,
    default: 'PROCESADO',
  })
  estado: EstadoRecibo;

  // Movimientos generados en la caja de flujo (hasta 2: INGRESO por lo
  // aplicado a kardex, EGRESO por la porción en efectivo).
  @OneToMany(() => MovimientoCaja, (mov) => mov.recibo)
  movimientosCaja?: MovimientoCaja[];

  @OneToMany(() => ReciboDetalle, (detalle) => detalle.recibo)
  detalles?: ReciboDetalle[];
}
