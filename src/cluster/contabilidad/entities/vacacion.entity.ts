import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';

/**
 * TOMADA: días que salió de vacación. PAGADA: días pagados en el finiquito
 * (los registra la boleta FINIQUITO). AJUSTE: saldo inicial o corrección,
 * puede ser negativo.
 */
export type TipoVacacion = 'TOMADA' | 'PAGADA' | 'AJUSTE';

/**
 * Movimiento de vacaciones de una persona. El saldo no se guarda: es lo
 * ganado por años cumplidos (escala VACACION) + ajustes - tomadas - pagadas.
 */
@Entity({
  name: 'vacacion',
  schema: 'contabilidad',
})
export class Vacacion extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'id_persona', type: 'bigint' })
  idPersona: string;

  @ManyToOne(() => PersonaCi, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona', referencedColumnName: 'id' })
  persona?: PersonaCi;

  @Column({ name: 'tipo', type: 'varchar', length: 10 })
  tipo: TipoVacacion;

  @Column({ name: 'fecha_desde', type: 'date' })
  fechaDesde: string;

  @Column({ name: 'fecha_hasta', type: 'date', nullable: true })
  fechaHasta?: string | null;

  @Column({ name: 'dias', type: 'numeric', precision: 6, scale: 1 })
  dias: number;

  @Column({ name: 'id_boleta_pago', type: 'bigint', nullable: true })
  idBoletaPago?: string | null;

  @Column({ name: 'observaciones', type: 'varchar', length: 500, nullable: true })
  observaciones?: string | null;
}
