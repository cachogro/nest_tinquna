import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';

/**
 * Marcaciones de un día de una persona con control de asistencia. Las 4
 * horas son opcionales ("HH:MM:SS"). Los minutos de atraso no se guardan: se
 * calculan contra el horario y la tolerancia vigentes (AsistenciaService).
 * `justificado` = ese día no se descuenta.
 */
@Entity({
  name: 'asistencia',
  schema: 'contabilidad',
})
export class Asistencia extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'id_persona', type: 'bigint' })
  idPersona: string;

  @ManyToOne(() => PersonaCi, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona', referencedColumnName: 'id' })
  persona?: PersonaCi;

  @Column({ name: 'fecha', type: 'date' })
  fecha: string;

  @Column({ name: 'hora_ingreso', type: 'time', nullable: true })
  horaIngreso?: string | null;

  @Column({ name: 'hora_salida_almuerzo', type: 'time', nullable: true })
  horaSalidaAlmuerzo?: string | null;

  @Column({ name: 'hora_retorno_almuerzo', type: 'time', nullable: true })
  horaRetornoAlmuerzo?: string | null;

  @Column({ name: 'hora_salida', type: 'time', nullable: true })
  horaSalida?: string | null;

  @Column({ name: 'falta', type: 'boolean', default: false })
  falta: boolean;

  @Column({ name: 'justificado', type: 'boolean', default: false })
  justificado: boolean;

  @Column({ name: 'justificacion', type: 'varchar', length: 255, nullable: true })
  justificacion?: string | null;

  @Column({ name: 'observaciones', type: 'varchar', length: 255, nullable: true })
  observaciones?: string | null;
}
