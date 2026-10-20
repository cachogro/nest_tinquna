import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

/**
 * Horario de trabajo con sus horas por día de la semana. Un día sin
 * almuerzo es horario continuo. Un horario de temporada (invierno) indica a
 * qué horario reemplaza (`idHorarioReemplaza`) y entre qué fechas: en ese
 * rango se usa en lugar del base para todas las personas que lo tienen.
 */
@Entity({
  name: 'horario_trabajo',
  schema: 'parametrica',
})
export class HorarioTrabajo extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'descripcion', type: 'varchar', length: 80 })
  descripcion: string;

  @Column({ name: 'id_horario_reemplaza', type: 'int', nullable: true })
  idHorarioReemplaza?: number | null;

  @ManyToOne(() => HorarioTrabajo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_horario_reemplaza', referencedColumnName: 'id' })
  horarioReemplaza?: HorarioTrabajo | null;

  @Column({ name: 'vigencia_desde', type: 'date', nullable: true })
  vigenciaDesde?: string | null;

  @Column({ name: 'vigencia_hasta', type: 'date', nullable: true })
  vigenciaHasta?: string | null;

  @Column({ name: 'observaciones', type: 'varchar', length: 255, nullable: true })
  observaciones?: string | null;

  @OneToMany(() => HorarioTrabajoDia, (d) => d.horario, { cascade: true })
  dias?: HorarioTrabajoDia[];
}

/** Horas de un día de la semana (1 = lunes ... 7 = domingo), "HH:MM:SS". */
@Entity({
  name: 'horario_trabajo_dia',
  schema: 'parametrica',
})
export class HorarioTrabajoDia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'id_horario_trabajo', type: 'int' })
  idHorarioTrabajo: number;

  @ManyToOne(() => HorarioTrabajo, (h) => h.dias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_horario_trabajo', referencedColumnName: 'id' })
  horario?: HorarioTrabajo;

  @Column({ name: 'dia_semana', type: 'smallint' })
  diaSemana: number;

  @Column({ name: 'hora_ingreso', type: 'time' })
  horaIngreso: string;

  @Column({ name: 'hora_salida_almuerzo', type: 'time', nullable: true })
  horaSalidaAlmuerzo?: string | null;

  @Column({ name: 'hora_retorno_almuerzo', type: 'time', nullable: true })
  horaRetornoAlmuerzo?: string | null;

  @Column({ name: 'hora_salida', type: 'time' })
  horaSalida: string;
}
