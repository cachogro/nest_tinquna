import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

/**
 * Categoría real de ingreso/egreso de la caja de flujo ("DESTINO DEL GASTO"
 * del Excel). `esEgreso` determina el sentido: TRUE = sale dinero (egreso),
 * FALSE = entra dinero (ingreso).
 */
@Entity({
  name: 'destino_gasto',
  schema: 'parametrica',
})
export class DestinoGasto extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 80,
  })
  nombre: string;

  @Column({
    name: 'es_egreso',
    type: 'boolean',
  })
  esEgreso: boolean;
}
