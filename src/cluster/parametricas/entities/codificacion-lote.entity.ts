import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Tipo de codificación de lote (MC, TM, C, RV...). Cada tipo tiene su propio
 * correlativo, que se incrementa al crear un promedio de ese tipo.
 */
@Entity({
  name: 'codificacion_lote',
  schema: 'parametrica',
})
export class CodificacionLote extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'codigo', type: 'varchar', length: 10, nullable: false })
  codigo: string;

  @Column({ name: 'nombre', type: 'varchar', length: 100, nullable: false })
  nombre: string;

  @Column({
    name: 'ultimo_correlativo',
    type: 'bigint',
    default: 0,
    nullable: false,
  })
  ultimoCorrelativo: string;
}
