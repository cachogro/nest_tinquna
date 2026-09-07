import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

/**
 * Caja / fondo de efectivo (ej. "CAJA PRINCIPAL"). A diferencia de
 * CuentaBancaria, no tiene una sola moneda: opera en Bs. y $us. a la vez,
 * por lo que lleva un saldo inicial separado por moneda. El saldo corriente
 * por moneda lo calculan PeriodoCaja / MovimientoCaja.
 */
@Entity({
  name: 'caja',
  schema: 'parametrica',
})
export class Caja extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 80,
  })
  nombre: string;

  @Column({
    name: 'saldo_inicial_bob',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  saldoInicialBob: number;

  @Column({
    name: 'fecha_saldo_inicial_bob',
    type: 'date',
    nullable: true,
  })
  fechaSaldoInicialBob?: string;

  @Column({
    name: 'saldo_inicial_usd',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  saldoInicialUsd: number;

  @Column({
    name: 'fecha_saldo_inicial_usd',
    type: 'date',
    nullable: true,
  })
  fechaSaldoInicialUsd?: string;
}
