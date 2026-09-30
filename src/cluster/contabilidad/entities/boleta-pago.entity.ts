import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { PersonaAutorizo } from '../persona-autorizo.util';
import { Recibo } from './recibo.entity';
import { MovimientoPrestamo } from './movimiento-prestamo.entity';

export type EstadoBoletaPago = 'PAGADA' | 'ANULADA';

/**
 * Boleta de pago del sueldo de un empleado por un periodo (`fechaDesde` a
 * `fechaHasta`, ej. 28 de febrero a 28 de marzo).
 *
 * Por ley muestra el salario completo:
 *   totalGanado        = salarioBase + bonoAntiguedad + otrosIngresos
 *   totalDescuentosLey = aporteLaboral + rcIva + otrosDescuentosLey
 *   liquidoPagable     = totalGanado - totalDescuentosLey
 *
 * Internamente se le descuenta lo destinado a sus préstamos
 * (`totalDescuentoPrestamos`, detalle en `descuentosPrestamo`) y solo el
 * resto (`montoPagado`) sale de caja/banco, con su propio recibo de EGRESO
 * (`idRecibo`; null si todo el líquido fue a préstamos). Lo descontado no
 * sale de ninguna caja: baja el kardex PERSONAL (HABER sin dinero) y el
 * sub-libro de cada préstamo.
 */
@Entity({
  name: 'boleta_pago',
  schema: 'contabilidad',
})
export class BoletaPago extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  // N° de la boleta (correlativo global). NO es el id.
  @Column({
    name: 'numero',
    type: 'int',
  })
  numero: number;

  @Column({
    name: 'id_persona',
    type: 'bigint',
  })
  idPersona: string;

  @ManyToOne(() => PersonaCi, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_persona',
    referencedColumnName: 'id',
  })
  persona?: PersonaCi;

  @Column({
    name: 'fecha_desde',
    type: 'date',
  })
  fechaDesde: string;

  @Column({
    name: 'fecha_hasta',
    type: 'date',
  })
  fechaHasta: string;

  @Column({
    name: 'fecha_pago',
    type: 'date',
  })
  fechaPago: string;

  @Column({
    name: 'dias_trabajados',
    type: 'int',
    nullable: true,
  })
  diasTrabajados?: number | null;

  // "Pago de sueldos y salarios - 28 Febrero a 28 Marzo 2026": es también
  // el concepto del recibo y el detalle de las líneas de kardex.
  @Column({
    name: 'concepto',
    type: 'varchar',
    length: 255,
  })
  concepto: string;

  // ---------------------------------------------------------------- ingresos
  @Column({ name: 'salario_base', type: 'numeric', precision: 16, scale: 2 })
  salarioBase: number;

  @Column({ name: 'bono_antiguedad', type: 'numeric', precision: 16, scale: 2, default: 0 })
  bonoAntiguedad: number;

  @Column({ name: 'otros_ingresos', type: 'numeric', precision: 16, scale: 2, default: 0 })
  otrosIngresos: number;

  @Column({ name: 'total_ganado', type: 'numeric', precision: 16, scale: 2 })
  totalGanado: number;

  // ------------------------------------------------------- descuentos de ley
  // Aporte laboral a la Gestora / AFP.
  @Column({ name: 'aporte_laboral', type: 'numeric', precision: 16, scale: 2, default: 0 })
  aporteLaboral: number;

  @Column({ name: 'rc_iva', type: 'numeric', precision: 16, scale: 2, default: 0 })
  rcIva: number;

  @Column({ name: 'otros_descuentos_ley', type: 'numeric', precision: 16, scale: 2, default: 0 })
  otrosDescuentosLey: number;

  @Column({ name: 'total_descuentos_ley', type: 'numeric', precision: 16, scale: 2 })
  totalDescuentosLey: number;

  @Column({ name: 'liquido_pagable', type: 'numeric', precision: 16, scale: 2 })
  liquidoPagable: number;

  // ----------------------------------------------------------------- interno
  @Column({
    name: 'total_descuento_prestamos',
    type: 'numeric',
    precision: 16,
    scale: 2,
    default: 0,
  })
  totalDescuentoPrestamos: number;

  // liquidoPagable - totalDescuentoPrestamos: lo único que sale de caja/banco.
  @Column({ name: 'monto_pagado', type: 'numeric', precision: 16, scale: 2 })
  montoPagado: number;

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
    name: 'estado',
    type: 'varchar',
    length: 10,
    default: 'PAGADA',
  })
  estado: EstadoBoletaPago;

  @Column({
    name: 'persona_autorizo',
    type: 'jsonb',
    nullable: true,
  })
  personaAutorizo?: PersonaAutorizo | null;

  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observaciones?: string | null;

  // Líneas DESCUENTO_SUELDO de los préstamos descontados en esta boleta.
  @OneToMany(() => MovimientoPrestamo, (mov) => mov.boletaPago)
  descuentosPrestamo?: MovimientoPrestamo[];
}
