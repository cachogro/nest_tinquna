import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { BienDacionPago } from './bien-dacion-pago.entity';
import { PersonaAutorizo } from '../persona-autorizo.util';

/**
 * Gasto que la empresa le invierte a un bien ya TOMADO_EN_PAGO para venderlo
 * mejor (cambio de nombre, arreglos, pintura...). Es un EGRESO real, directo
 * a la caja de flujo (`idMovimientoCaja`) o a la libreta de bancos
 * (`idLibretaBanco`), sin recibo. Es interno de la empresa: NO toca el kardex
 * del dueño original. Suma al costo del bien y baja el resultado de su venta.
 */
@Entity({
  name: 'bien_dacion_pago_gasto',
  schema: 'contabilidad',
})
export class BienDacionPagoGasto extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_bien_dacion_pago',
    type: 'bigint',
  })
  idBienDacionPago: string;

  @ManyToOne(() => BienDacionPago, (bien) => bien.gastos, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_bien_dacion_pago',
    referencedColumnName: 'id',
  })
  bienDacionPago?: BienDacionPago;

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

  // Quien autorizó el gasto (snapshot, sin FK; ver PersonaAutorizo).
  @Column({
    name: 'persona_autorizo',
    type: 'jsonb',
    nullable: true,
  })
  personaAutorizo?: PersonaAutorizo | null;
}
