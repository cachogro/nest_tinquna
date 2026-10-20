import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

export type TipoConceptoPlanilla = 'DESCUENTO_LABORAL' | 'APORTE_PATRONAL';

/**
 * Descuento al trabajador o aporte de la empresa que se calcula como
 * porcentaje del total ganado:
 *
 *   monto = max(0, totalGanado - montoDesde) * porcentaje / 100
 *
 * `montoDesde` = 0 aplica sobre todo el total ganado; > 0 solo sobre lo que
 * lo excede (tramos del Aporte Nacional Solidario). `entidad` (GESTORA,
 * CNS...) agrupa lo que hay que pagarle a cada una en la planilla mensual.
 */
@Entity({
  name: 'concepto_planilla',
  schema: 'parametrica',
})
export class ConceptoPlanilla extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'codigo', type: 'varchar', length: 40 })
  codigo: string;

  @Column({ name: 'nombre', type: 'varchar', length: 120 })
  nombre: string;

  @Column({ name: 'tipo', type: 'varchar', length: 20 })
  tipo: TipoConceptoPlanilla;

  @Column({ name: 'entidad', type: 'varchar', length: 30 })
  entidad: string;

  @Column({ name: 'porcentaje', type: 'numeric', precision: 8, scale: 4 })
  porcentaje: number;

  @Column({ name: 'monto_desde', type: 'numeric', precision: 16, scale: 2, default: 0 })
  montoDesde: number;

  @Column({ name: 'orden', type: 'int', default: 0 })
  orden: number;
}
