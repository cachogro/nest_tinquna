import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ValorizacionMineral } from 'src/cluster/comercio-interno/entities/valorizacion/valorizacion-mineral.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { PersonaAutorizo } from '../persona-autorizo.util';
import { PagoValorizacionDetalle } from './pago-valorizacion-detalle.entity';

export type EstadoPagoValorizacion = 'REGISTRADO' | 'ANULADO';

/**
 * Pago del líquido pagable de una valorización VALORIZADA. Es una
 * transacción interna, SIN recibo: el respaldo es el PDF de la valorización
 * firmado por ambas partes.
 *
 *   montoPagado = montoLiquido − montoAbonoKardex
 *
 * Solo `montoPagado` sale de la caja de flujo (efectivo, EGRESO) o de la
 * libreta bancaria (medio bancario, DEBE), y NO se anota en ningún kardex.
 * Lo que el proveedor decide dejar a un kardex, y los anticipos que la
 * valorización ya le descontó, van como HABER en `detalles`.
 */
@Entity({
  name: 'pago_valorizacion',
  schema: 'contabilidad',
})
export class PagoValorizacion extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_valorizacion_mineral',
    type: 'bigint',
  })
  idValorizacionMineral: string;

  @ManyToOne(() => ValorizacionMineral, (v) => v.pagos, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_valorizacion_mineral',
    referencedColumnName: 'id',
  })
  valorizacionMineral?: ValorizacionMineral;

  @Column({
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

  @Column({
    name: 'monto_liquido',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  montoLiquido: number;

  @Column({
    name: 'monto_abono_kardex',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  montoAbonoKardex: number;

  @Column({
    name: 'monto_pagado',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  montoPagado: number;

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
  formaPago?: FormaPago | null;

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
  cuentaBancaria?: CuentaBancaria | null;

  @Column({
    name: 'nro_comprobante',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  nroComprobante?: string | null;

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
  destinoGasto?: DestinoGasto | null;

  @Column({
    name: 'id_persona_autorizo',
    type: 'bigint',
  })
  idPersonaAutorizo: string;

  // Snapshot jsonb de quien autorizó, igual que recibo y traspaso.
  @Column({
    name: 'persona_autorizo',
    type: 'jsonb',
    nullable: true,
  })
  personaAutorizo?: PersonaAutorizo | null;

  // Movimiento generado por `montoPagado`: en caja (efectivo) o en la
  // libreta (medio bancario). Ambos null si todo el líquido quedó en kardex.
  @Column({
    name: 'id_movimiento_caja',
    type: 'bigint',
    nullable: true,
  })
  idMovimientoCaja?: string | null;

  @Column({
    name: 'id_libreta_banco',
    type: 'bigint',
    nullable: true,
  })
  idLibretaBanco?: string | null;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 12,
    default: 'REGISTRADO',
  })
  estado: EstadoPagoValorizacion;

  @OneToMany(() => PagoValorizacionDetalle, (d) => d.pagoValorizacion)
  detalles?: PagoValorizacionDetalle[];
}
