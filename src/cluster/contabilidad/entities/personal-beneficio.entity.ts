import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { BeneficioPlanilla } from 'src/cluster/parametricas/entities/beneficio-planilla.entity';

/**
 * Beneficio asignado a una persona del personal (lactancia por el hijo
 * nacido en tal fecha...). Se paga una cuota en cada boleta de SUELDO cuyo
 * mes (el de la fecha hasta) esté entre el mes de `fechaInicio` y los
 * `meses` siguientes. Porcentaje / monto / meses / cotiza se copian del
 * catálogo al asignarlo y se pueden cambiar por persona.
 *
 * Baja lógica (`activo = false`): deja de pagarse desde la próxima boleta;
 * las cuotas ya pagadas quedan en sus boletas.
 */
@Entity({
  name: 'personal_beneficio',
  schema: 'contabilidad',
})
export class PersonalBeneficio extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'id_persona', type: 'bigint' })
  idPersona: string;

  @ManyToOne(() => PersonaCi, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona', referencedColumnName: 'id' })
  persona?: PersonaCi;

  @Column({ name: 'id_beneficio_planilla', type: 'int' })
  idBeneficioPlanilla: number;

  @ManyToOne(() => BeneficioPlanilla, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_beneficio_planilla', referencedColumnName: 'id' })
  beneficio?: BeneficioPlanilla;

  // Primer mes que se paga, guardado como día 1 ("2026-11-01").
  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'meses', type: 'int' })
  meses: number;

  @Column({ name: 'porcentaje', type: 'numeric', precision: 8, scale: 4, nullable: true })
  porcentaje?: number | null;

  @Column({ name: 'monto', type: 'numeric', precision: 16, scale: 2, nullable: true })
  monto?: number | null;

  @Column({ name: 'cotiza', type: 'boolean', default: false })
  cotiza: boolean;

  @Column({ name: 'observaciones', type: 'varchar', length: 255, nullable: true })
  observaciones?: string | null;
}
