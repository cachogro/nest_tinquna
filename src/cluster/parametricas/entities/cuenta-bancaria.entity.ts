import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { EntidadFinanciera } from './entidad-financiera.entity';

@Entity({
  name: 'cuenta_bancaria',
  schema: 'parametrica',
})
export class CuentaBancaria extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'id_entidad_financiera',
    type: 'int',
  })
  idEntidadFinanciera: number;

  // Sin eager: al listar entidades con sus cuentas evitaríamos una referencia
  // circular en la respuesta. Se carga explícitamente cuando hace falta.
  @ManyToOne(() => EntidadFinanciera, (entidad) => entidad.cuentas)
  @JoinColumn({
    name: 'id_entidad_financiera',
    referencedColumnName: 'id',
  })
  entidadFinanciera?: EntidadFinanciera;

  @Column({
    name: 'numero_cuenta',
    type: 'varchar',
    length: 40,
  })
  numeroCuenta: string;

  @Column({
    name: 'moneda',
    type: 'varchar',
    length: 3,
    default: 'BOB',
  })
  moneda: string;

  // Nombre corto para elegir la cuenta en el front (ej. "Operativa Bs").
  @Column({
    name: 'alias',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  alias?: string;

  // Saldo exacto con el que arranca la libreta de bancos de esta cuenta.
  // Es el saldo_inicial del primer período mensual; de ahí en adelante cada
  // período hereda su saldo inicial del cierre del anterior.
  @Column({
    name: 'saldo_inicial',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  saldoInicial: number;

  @Column({
    name: 'fecha_saldo_inicial',
    type: 'date',
    nullable: true,
  })
  fechaSaldoInicial?: string;
}
