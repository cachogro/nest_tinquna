import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

/**
 * Cómo cuenta un destino en la ganancia estimada del dashboard: no todo lo
 * que sale de caja/banco es gasto ni todo lo que entra es ganancia.
 *
 *   Cuentan: GASTO_OPERATIVO y SUELDOS (restan), OTRO_INGRESO (suma).
 *   No cuentan: COMPRA_MINERAL y VENTA_MINERAL (ya están en la utilidad de
 *   cada lote), INVERSION, PRESTAMO_ANTICIPO y FINANCIERO.
 */
export const CATEGORIAS_DESTINO_GASTO = [
  'GASTO_OPERATIVO',
  'SUELDOS',
  'OTRO_INGRESO',
  'COMPRA_MINERAL',
  'VENTA_MINERAL',
  'INVERSION',
  'PRESTAMO_ANTICIPO',
  'FINANCIERO',
] as const;
export type CategoriaDestinoGasto = (typeof CATEGORIAS_DESTINO_GASTO)[number];

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

  @Column({
    name: 'categoria',
    type: 'varchar',
    length: 20,
    default: 'GASTO_OPERATIVO',
  })
  categoria: CategoriaDestinoGasto;
}
