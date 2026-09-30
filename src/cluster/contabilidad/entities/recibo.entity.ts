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
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { RecepcionMineral } from 'src/cluster/comercio-interno/entities/recepcion-mineral/recepcion-mineral.entity';
import { ValorizacionMineral } from 'src/cluster/comercio-interno/entities/valorizacion/valorizacion-mineral.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { Cliente } from 'src/cluster/parametricas/entities/cliente.entity';
import { MovimientoCaja } from './movimiento-caja.entity';
import { LibretaBanco } from './libreta-banco.entity';
import { ReciboDetalle } from './recibo-detalle.entity';
import { MonedaCaja } from './periodo-caja.entity';
import { PersonaAutorizo } from '../persona-autorizo.util';
import { VentaLote } from './venta-lote.entity';

export type TipoRecibo = 'INGRESO' | 'EGRESO';
export type SerieRecibo = 'R' | 'C';
export type EstadoRecibo = 'BORRADOR' | 'PROCESADO' | 'ANULADO';

/**
 * Recibo de ingreso (serie R) o egreso (serie C) que postea automáticamente
 * al kardex de anticipos y a la caja de flujo (Caja id=1, "CAJA PRINCIPAL",
 * el registro maestro de la empresa). El monto se subdivide (ver
 * ReciboDetalle) entre kardex PERSONAL / kardex de un ACTOR / EFECTIVO
 * directo, y cada línea genera su propio movimiento en la caja de flujo con
 * su propio destino_gasto (ver ReciboDetalle.idDestinoGasto). Las líneas
 * PERSONAL/ACTOR postean HABER en ese kardex (salda deuda) y un INGRESO en
 * caja (valor recuperado por la empresa); las líneas EFECTIVO no tocan
 * ningún kardex, pero generan un EGRESO en caja (dinero que realmente
 * sale). Un mismo recibo puede generar tantos movimientos de caja como
 * líneas de detalle tenga (ver MovimientoCaja.idRecibo).
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

  // Fecha contable del recibo (puede no ser "hoy": el usuario la elige para
  // cuadrar el kardex/caja/libreta_banco, que solo usan esta fecha, sin hora).
  @Column({
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

  // Fecha y hora reales en que se generó el recibo (a diferencia de `fecha`,
  // esta la pone el servidor siempre, no se puede elegir).
  @Column({
    name: 'fecha_hora_generacion',
    type: 'timestamptz',
  })
  fechaHoraGeneracion: Date;

  // Fecha y hora de la PRIMERA vez que se pidió el PDF de este recibo. NULL
  // hasta la primera impresión; no se actualiza en impresiones posteriores.
  @Column({
    name: 'fecha_primera_impresion',
    type: 'timestamptz',
    nullable: true,
  })
  fechaPrimeraImpresion?: Date | null;

  @Column({
    name: 'monto_total',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  montoTotal: number;

  // Moneda del recibo: `montoTotal` y los montos de `detalles` están en
  // esta moneda. En USD, las líneas de kardex se postean convertidas a Bs.
  // con `tipoCambio` (el kardex lleva su saldo en Bs.), y la caja / cuenta
  // bancaria reciben el monto en USD.
  @Column({
    name: 'moneda',
    type: 'varchar',
    length: 3,
    default: 'BS',
  })
  moneda: MonedaCaja;

  // Bs. por 1 USD. Obligatorio si moneda = USD; null en BS.
  @Column({
    name: 'tipo_cambio',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  tipoCambio?: number | null;

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
  // transacción. Si viene seteada, la línea EFECTIVO de este recibo (la
  // única que representa plata que realmente se mueve) también postea un
  // movimiento en libreta_banco (ver LibretaBanco.idRecibo); las líneas
  // PERSONAL/ACTOR nunca la tocan (solo saldan kardex).
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
  // estas cuatro — persona registrada (idPersona), actor productivo minero
  // (idActorProductivoMinero), cliente/comprador (idCliente), o texto libre
  // (nombresApellidos, cuando el recibo se entrega a dos personas o a
  // alguien no registrado). El destino real de cada porción (a quién se le
  // salda la deuda) vive en ReciboDetalle, no acá.
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
    name: 'id_cliente',
    type: 'bigint',
    nullable: true,
  })
  idCliente?: string | null;

  @ManyToOne(() => Cliente, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_cliente',
    referencedColumnName: 'id',
  })
  cliente?: Cliente;

  @Column({
    name: 'nombres_apellidos',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  nombresApellidos?: string | null;

  // Persona interna que AUTORIZÓ generar este recibo (distinto de la
  // contraparte `persona` de arriba). Solo puede ser una persona con
  // persona_ci.autorizado = true y activo = true (se valida en el
  // servicio al generar). Se guarda como snapshot jsonb (id + nombres al
  // momento de generar), sin FK: el recibo conserva quién autorizó aunque
  // la persona cambie después.
  @Column({
    name: 'persona_autorizo',
    type: 'jsonb',
    nullable: true,
  })
  personaAutorizo?: PersonaAutorizo | null;

  // Recepción de mineral de la que proviene este recibo (anticipo entregado
  // al registrarla). NULL en los recibos que no nacen de una recepción. Solo
  // puede haber un recibo vigente (no ANULADO) por recepción.
  @Column({
    name: 'id_recepcion_mineral',
    type: 'bigint',
    nullable: true,
  })
  idRecepcionMineral?: string | null;

  @ManyToOne(() => RecepcionMineral, (recepcion) => recepcion.recibos, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_recepcion_mineral',
    referencedColumnName: 'id',
  })
  recepcionMineral?: RecepcionMineral;

  // Valorización cuyo saldo (Líquido Pagable) se paga con este recibo. NULL en
  // los recibos que no nacen de una valorización. Solo puede haber un recibo
  // vigente (no ANULADO) por valorización.
  @Column({
    name: 'id_valorizacion_mineral',
    type: 'bigint',
    nullable: true,
  })
  idValorizacionMineral?: string | null;

  @ManyToOne(() => ValorizacionMineral, (valorizacion) => valorizacion.recibos, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_valorizacion_mineral',
    referencedColumnName: 'id',
  })
  valorizacionMineral?: ValorizacionMineral;

  // Venta de lote que cobra este recibo (anticipo o pago del comprador).
  // Puede haber varios recibos por venta.
  @Column({
    name: 'id_venta_lote',
    type: 'bigint',
    nullable: true,
  })
  idVentaLote?: string | null;

  @ManyToOne(() => VentaLote, (venta) => venta.recibos, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_venta_lote',
    referencedColumnName: 'id',
  })
  ventaLote?: VentaLote;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 10,
    default: 'PROCESADO',
  })
  estado: EstadoRecibo;

  // Movimientos generados en la caja de flujo (uno por línea de detalle).
  @OneToMany(() => MovimientoCaja, (mov) => mov.recibo)
  movimientosCaja?: MovimientoCaja[];

  // Movimiento generado en la libreta de bancos (uno solo, por la línea
  // EFECTIVO, cuando el recibo tiene idCuentaBancaria). Vacío si el recibo
  // no tiene línea EFECTIVO o no se pagó por un medio bancario.
  @OneToMany(() => LibretaBanco, (mov) => mov.recibo)
  movimientosBanco?: LibretaBanco[];

  @OneToMany(() => ReciboDetalle, (detalle) => detalle.recibo)
  detalles?: ReciboDetalle[];
}
