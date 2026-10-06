import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Caja } from 'src/cluster/parametricas/entities/caja.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { MonedaCaja } from './periodo-caja.entity';
import { MovimientoCaja } from './movimiento-caja.entity';
import { LibretaBanco } from './libreta-banco.entity';
import { PersonaAutorizo } from '../persona-autorizo.util';

export type TipoTraspaso = 'DEPOSITO' | 'RETIRO';

/**
 * Traspaso interno de fondos propios de la empresa entre la caja de flujo y
 * una cuenta bancaria. NO es un ingreso/egreso real del negocio ni una
 * transacción con un tercero (a diferencia de un recibo o un movimiento de
 * kardex): es la misma plata cambiando de custodia. Genera, en la misma
 * transacción, un movimiento en la caja de flujo y otro en la libreta de
 * bancos, enlazados acá vía `idTraspaso` en cada uno (mismo patrón que
 * `idRecibo` / `idMovimientoKardex` en esas tablas).
 *
 *   DEPOSITO: la plata sale de la caja (EGRESO) y entra al banco (HABER).
 *   RETIRO:   la plata sale del banco (DEBE) y entra a la caja (INGRESO).
 *
 * Lleva `destinoGasto` para clasificarlo en reportes contables propios,
 * pero OJO: `ReporteDestinoGastoService` (el resumen de "cuánto se gastó/
 * ingresó" por destino) sigue excluyendo estos movimientos por
 * `MovimientoCaja.idTraspaso`, porque un traspaso no es un gasto/ingreso
 * real del negocio, es la misma plata cambiando de custodia.
 */
@Entity({
  name: 'traspaso',
  schema: 'contabilidad',
})
export class Traspaso extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'tipo',
    type: 'varchar',
    length: 10,
  })
  tipo: TipoTraspaso;

  @Column({
    name: 'fecha',
    type: 'date',
  })
  fecha: string;

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

  // 'BS' | 'USD': la moneda de la cuenta bancaria (y del movimiento de caja).
  @Column({
    name: 'moneda',
    type: 'varchar',
    length: 3,
  })
  moneda: MonedaCaja;

  // Bs. por 1 USD. Obligatorio si moneda = USD; null en BS (y en los
  // traspasos en USD anteriores a la 084). Es solo referencial: ambos lados
  // del traspaso se mueven en la moneda de la cuenta.
  @Column({
    name: 'tipo_cambio',
    type: 'numeric',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  tipoCambio?: number | null;

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

  // N° de la boleta de depósito / retiro del banco, si corresponde.
  @Column({
    name: 'nro_comprobante',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  nroComprobante?: string | null;

  @Column({
    name: 'concepto',
    type: 'varchar',
    length: 255,
  })
  concepto: string;

  // "DESTINO DEL GASTO" del Excel (parametrica.destino_gasto), igual que en
  // movimiento_caja / movimiento_kardex / recibo_detalle. Se refleja en el
  // movimiento de la caja de flujo; la libreta de bancos no tiene esta
  // columna. Ver nota de la clase: excluido del resumen de "cuánto se
  // gastó/ingresó" (ReporteDestinoGastoService).
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
    name: 'monto',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  monto: number;

  // Quien autorizó el traspaso: snapshot jsonb (id + nombres al registrar),
  // sin FK, igual que recibo.persona_autorizo (ver PersonaAutorizo).
  @Column({
    name: 'persona_autorizo',
    type: 'jsonb',
    nullable: true,
  })
  personaAutorizo?: PersonaAutorizo | null;

  @OneToMany(() => MovimientoCaja, (mov) => mov.traspaso)
  movimientosCaja?: MovimientoCaja[];

  @OneToMany(() => LibretaBanco, (mov) => mov.traspaso)
  movimientosBanco?: LibretaBanco[];
}
