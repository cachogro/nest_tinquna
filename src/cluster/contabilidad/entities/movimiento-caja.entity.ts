import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Caja } from 'src/cluster/parametricas/entities/caja.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { PeriodoCaja, MonedaCaja } from './periodo-caja.entity';
import { Recibo } from './recibo.entity';

/**
 * Caja de flujo: una fila por ingreso o egreso físico de efectivo (hoja
 * "CAJA DE FLUJO" del Excel). Mismo mecanismo que LibretaBanco.
 *
 * `ingreso` = entrada de efectivo
 * `egreso`  = salida de efectivo
 * `saldo`   = saldo corriente tras el movimiento; lo recalcula el servicio,
 *             por separado para cada moneda dentro de la misma caja.
 * `folio`   = número de línea, correlativo por (caja, moneda, gestión).
 */
@Entity({
  name: 'movimiento_caja',
  schema: 'contabilidad',
})
export class MovimientoCaja extends Auditoria {
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
    name: 'id_periodo_caja',
    type: 'bigint',
  })
  idPeriodoCaja: string;

  @ManyToOne(() => PeriodoCaja, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_periodo_caja',
    referencedColumnName: 'id',
  })
  periodoCaja?: PeriodoCaja;

  @Column({
    name: 'moneda',
    type: 'varchar',
    length: 3,
  })
  moneda: MonedaCaja;

  @Column({
    name: 'folio',
    type: 'int',
    nullable: true,
  })
  folio?: number | null;

  @Column({
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

  // "FACTURA Y/O RECIBO" / "Nº CPTE" del Excel (ej. "REC:R-0009", "BCL-737").
  @Column({
    name: 'nro_comprobante',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  nroComprobante?: string;

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

  // Beneficiario / contraparte del movimiento ("ENTREGA DE FONDOS A:").
  @Column({
    name: 'nombres_apellidos',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  nombresApellidos?: string;

  // Vínculo opcional a una persona ya registrada (persona_ci). Si el
  // beneficiario no está en la lista, queda NULL y solo vale nombresApellidos.
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
    name: 'concepto',
    type: 'varchar',
    length: 255,
  })
  concepto: string;

  // "DESTINO DEL GASTO" del Excel (parametrica.destino_gasto).
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

  // Presente cuando el movimiento nace de generar un recibo. Un recibo
  // puede generar hasta DOS movimientos de caja: uno INGRESO (por la
  // porción aplicada a kardex personal/actor, valor recuperado por la
  // empresa) y uno EGRESO (por la porción EFECTIVO, dinero que sale de
  // verdad), por eso el vínculo vive acá y no como FK único en `recibo`.
  @Column({
    name: 'id_recibo',
    type: 'bigint',
    nullable: true,
  })
  idRecibo?: string | null;

  @ManyToOne(() => Recibo, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_recibo',
    referencedColumnName: 'id',
  })
  recibo?: Recibo;

  @Column({
    name: 'ingreso',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  ingreso: number;

  @Column({
    name: 'egreso',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  egreso: number;

  @Column({
    name: 'saldo',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  saldo: number;
}
