import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

/**
 * BONO_ANTIGUEDAD: `valor` = % sobre la base (N salarios mínimos).
 * VACACION: `valor` = días hábiles de vacación por año.
 * ATRASO: `aniosDesde` / `aniosHasta` son MINUTOS de atraso acumulados en el
 * mes y `valor` = días de haber que se descuentan (modo escala).
 */
export type TipoEscalaPlanilla = 'BONO_ANTIGUEDAD' | 'VACACION' | 'ATRASO';

/**
 * Tramo de una tabla por años de antigüedad. `aniosDesde` y `aniosHasta`
 * son años CUMPLIDOS, ambos inclusive; `aniosHasta` null = en adelante.
 */
@Entity({
  name: 'escala_planilla',
  schema: 'parametrica',
})
export class EscalaPlanilla extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tipo', type: 'varchar', length: 20 })
  tipo: TipoEscalaPlanilla;

  @Column({ name: 'anios_desde', type: 'int' })
  aniosDesde: number;

  @Column({ name: 'anios_hasta', type: 'int', nullable: true })
  aniosHasta?: number | null;

  @Column({ name: 'valor', type: 'numeric', precision: 8, scale: 2 })
  valor: number;
}
