import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { Recibo } from './recibo.entity';

/**
 * Medio de pago de un recibo MIXTO (dos medios o más: por ejemplo, la mitad
 * en efectivo y el resto por QR). Solo hay filas cuando el pago es mixto;
 * con un solo medio, la forma de pago vive en la cabecera del recibo. La
 * suma de `monto` es igual a `recibo.montoTotal`, y la cabecera conserva
 * los datos del primero (`orden` = 1, el principal).
 *
 * Sin `idCuentaBancaria` el medio mueve la caja de flujo; con ella, la
 * libreta de esa cuenta.
 */
@Entity({
  name: 'recibo_pago',
  schema: 'contabilidad',
})
export class ReciboPago extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_recibo',
    type: 'bigint',
  })
  idRecibo: string;

  @ManyToOne(() => Recibo, (recibo) => recibo.pagos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'id_recibo',
    referencedColumnName: 'id',
  })
  recibo?: Recibo;

  @Column({
    name: 'orden',
    type: 'int',
    default: 1,
  })
  orden: number;

  @Column({
    name: 'id_forma_pago',
    type: 'int',
  })
  idFormaPago: number;

  @ManyToOne(() => FormaPago, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_forma_pago',
    referencedColumnName: 'id',
  })
  formaPago?: FormaPago;

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
    name: 'monto',
    type: 'numeric',
    precision: 16,
    scale: 2,
  })
  monto: number;
}
