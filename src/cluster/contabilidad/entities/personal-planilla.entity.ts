import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { TipoContrato } from 'src/cluster/parametricas/entities/tipo-contrato.entity';
import { ConceptoPlanilla } from 'src/cluster/parametricas/entities/concepto-planilla.entity';
import { HorarioTrabajo } from 'src/cluster/parametricas/entities/horario-trabajo.entity';

/**
 * Configuración de sueldo de una persona del personal: datos para las
 * planillas de ley (cargo, NUA/CUA, matrícula CNS), tipo de contrato y los
 * checks de lo que le corresponde. `conceptos` = descuentos y aportes que se
 * le calculan (los marcados).
 *
 * Al asignar un tipo de contrato se copian sus valores por defecto, pero
 * cada check se puede cambiar por persona. Sin esta configuración la boleta
 * no calcula nada automático (todo se ingresa a mano, como antes).
 */
@Entity({
  name: 'personal_planilla',
  schema: 'contabilidad',
})
export class PersonalPlanilla extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'id_persona', type: 'bigint' })
  idPersona: string;

  @OneToOne(() => PersonaCi, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona', referencedColumnName: 'id' })
  persona?: PersonaCi;

  @Column({ name: 'id_tipo_contrato', type: 'int', nullable: true })
  idTipoContrato?: number | null;

  @ManyToOne(() => TipoContrato, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_tipo_contrato', referencedColumnName: 'id' })
  tipoContrato?: TipoContrato | null;

  @Column({ name: 'cargo', type: 'varchar', length: 100, nullable: true })
  cargo?: string | null;

  @Column({ name: 'nua_cua', type: 'varchar', length: 30, nullable: true })
  nuaCua?: string | null;

  @Column({ name: 'matricula_cns', type: 'varchar', length: 30, nullable: true })
  matriculaCns?: string | null;

  @Column({ name: 'aplica_bono_antiguedad', type: 'boolean', default: false })
  aplicaBonoAntiguedad: boolean;

  @Column({ name: 'aplica_horas_extra', type: 'boolean', default: false })
  aplicaHorasExtra: boolean;

  @Column({ name: 'aplica_aguinaldo', type: 'boolean', default: false })
  aplicaAguinaldo: boolean;

  @Column({ name: 'aplica_vacaciones', type: 'boolean', default: false })
  aplicaVacaciones: boolean;

  @Column({ name: 'aplica_indemnizacion', type: 'boolean', default: false })
  aplicaIndemnizacion: boolean;

  @Column({ name: 'aplica_desahucio', type: 'boolean', default: false })
  aplicaDesahucio: boolean;

  // Descuentos que se escriben a mano en la boleta: sin el check no
  // aparecen ni se aceptan.
  @Column({ name: 'aplica_rc_iva', type: 'boolean', default: false })
  aplicaRcIva: boolean;

  @Column({ name: 'aplica_otros_descuentos_ley', type: 'boolean', default: false })
  aplicaOtrosDescuentosLey: boolean;

  // Solo a quien lo tenga se le registran marcaciones y se le pueden
  // descontar atrasos (el personal de ruta no marca).
  @Column({ name: 'controla_asistencia', type: 'boolean', default: false })
  controlaAsistencia: boolean;

  @Column({ name: 'id_horario_trabajo', type: 'int', nullable: true })
  idHorarioTrabajo?: number | null;

  @ManyToOne(() => HorarioTrabajo, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_horario_trabajo', referencedColumnName: 'id' })
  horarioTrabajo?: HorarioTrabajo | null;

  @Column({ name: 'observaciones', type: 'varchar', length: 500, nullable: true })
  observaciones?: string | null;

  @ManyToMany(() => ConceptoPlanilla)
  @JoinTable({
    name: 'personal_planilla_concepto',
    schema: 'contabilidad',
    joinColumn: { name: 'id_personal_planilla', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'id_concepto_planilla', referencedColumnName: 'id' },
  })
  conceptos?: ConceptoPlanilla[];
}
