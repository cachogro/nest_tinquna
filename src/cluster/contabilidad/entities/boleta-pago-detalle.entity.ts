import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { BoletaPago } from './boleta-pago.entity';

/**
 * INGRESO: rubros de aguinaldo, finiquito o retroactivo (indemnización,
 * desahucio, vacaciones...). DESCUENTO_LABORAL / APORTE_PATRONAL: cada
 * descuento o aporte calculado, con copia del concepto (código, nombre,
 * entidad, porcentaje) tal como estaba al emitir. SANCION: sanción de un
 * memorándum descontada en la boleta de sueldo (`idMemorandum`).
 */
export type TipoBoletaPagoDetalle = 'INGRESO' | 'DESCUENTO_LABORAL' | 'APORTE_PATRONAL' | 'SANCION';

@Entity({
  name: 'boleta_pago_detalle',
  schema: 'contabilidad',
})
export class BoletaPagoDetalle extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'id_boleta_pago', type: 'bigint' })
  idBoletaPago: string;

  @ManyToOne(() => BoletaPago, (b) => b.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_boleta_pago', referencedColumnName: 'id' })
  boletaPago?: BoletaPago;

  @Column({ name: 'tipo', type: 'varchar', length: 20 })
  tipo: TipoBoletaPagoDetalle;

  @Column({ name: 'id_concepto_planilla', type: 'int', nullable: true })
  idConceptoPlanilla?: number | null;

  @Column({ name: 'codigo', type: 'varchar', length: 40 })
  codigo: string;

  @Column({ name: 'nombre', type: 'varchar', length: 150 })
  nombre: string;

  @Column({ name: 'entidad', type: 'varchar', length: 30, nullable: true })
  entidad?: string | null;

  @Column({ name: 'porcentaje', type: 'numeric', precision: 8, scale: 4, nullable: true })
  porcentaje?: number | null;

  @Column({ name: 'base', type: 'numeric', precision: 16, scale: 2, nullable: true })
  base?: number | null;

  @Column({ name: 'monto', type: 'numeric', precision: 16, scale: 2 })
  monto: number;

  @Column({ name: 'orden', type: 'int', default: 0 })
  orden: number;

  // Línea INGRESO de un beneficio (lactancia, natalidad...): la cuota de ese
  // mes ya pagada, para no pagarla dos veces.
  @Column({ name: 'id_personal_beneficio', type: 'bigint', nullable: true })
  idPersonalBeneficio?: string | null;

  // Línea SANCION: memorándum cuya sanción se descontó (no se descuenta dos veces).
  @Column({ name: 'id_memorandum', type: 'bigint', nullable: true })
  idMemorandum?: string | null;
}
