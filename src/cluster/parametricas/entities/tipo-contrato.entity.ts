import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ConceptoPlanilla } from './concepto-planilla.entity';

/**
 * Tipo de contrato (plazo indefinido, plazo fijo, consultor...) con lo que
 * le corresponde POR DEFECTO a quien lo tenga: los checks y los descuentos /
 * aportes. Al asignarlo a una persona se copian a su configuración
 * (personal_planilla), donde se pueden cambiar uno por uno.
 */
@Entity({
  name: 'tipo_contrato',
  schema: 'parametrica',
})
export class TipoContrato extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'descripcion', type: 'varchar', length: 80 })
  descripcion: string;

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

  @ManyToMany(() => ConceptoPlanilla)
  @JoinTable({
    name: 'tipo_contrato_concepto',
    schema: 'parametrica',
    joinColumn: { name: 'id_tipo_contrato', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'id_concepto_planilla', referencedColumnName: 'id' },
  })
  conceptos?: ConceptoPlanilla[];
}
