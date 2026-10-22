import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

/**
 * Cómo pesa una cuenta del plan en la ganancia estimada del dashboard: no todo lo
 * que sale de caja/banco es gasto ni todo lo que entra es ganancia.
 *
 *   Cuentan: GASTO_OPERATIVO y SUELDOS (restan), OTRO_INGRESO (suma).
 *   No cuentan: COMPRA_MINERAL y VENTA_MINERAL (ya están en la utilidad de
 *   cada lote), INVERSION, PRESTAMO_ANTICIPO y FINANCIERO.
 */
export const CATEGORIAS_PLAN_CUENTAS = [
  'GASTO_OPERATIVO',
  'SUELDOS',
  'OTRO_INGRESO',
  'COMPRA_MINERAL',
  'VENTA_MINERAL',
  'INVERSION',
  'PRESTAMO_ANTICIPO',
  'FINANCIERO',
] as const;
export type CategoriaPlanCuentas = (typeof CATEGORIAS_PLAN_CUENTAS)[number];

/**
 * R = resumen (agrupa, niveles 1-4, siempre con subcuentas).
 * D = detalle (imputable, sin subcuentas): nivel 5, o nivel 4 cuando la
 * cuenta no se abre en subcuentas (110205 ANTICIPOS PROVEEDORES MINERAL
 * SACOS: a quién se le dio lo dice el kardex, no una subcuenta por persona).
 */
export type TipoPlanCuentas = 'R' | 'D';
export const TIPOS_PLAN_CUENTAS: TipoPlanCuentas[] = ['R', 'D'];
/** D = deudora, H = acreedora. */
export type NaturalezaPlanCuentas = 'D' | 'H';
export const NATURALEZAS_PLAN_CUENTAS: NaturalezaPlanCuentas[] = ['D', 'H'];

/** Dígitos que agrega cada nivel al código del padre (1, 11, 1101, 110101, 110101001). */
export const DIGITOS_POR_NIVEL: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
};
export const NIVEL_MAXIMO = 5;
/** Desde este nivel una cuenta puede ser imputable (D). */
export const NIVEL_MINIMO_DETALLE = 4;

/**
 * Plan de cuentas contable jerárquico ("PLAN CUENTAS REAL TINKURIQUNA.xlsx").
 * Solo las cuentas de detalle (tipo D, nivel 4 o 5) se usan en movimientos, en
 * cualquier dirección: si entra o sale dinero lo dice el movimiento, no la
 * cuenta. `categoria` (solo en las de detalle) alimenta la ganancia estimada
 * del dashboard.
 */
@Entity({
  name: 'plan_cuentas',
  schema: 'parametrica',
})
export class PlanCuentas extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'codigo', type: 'varchar', length: 9 })
  codigo: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 150,
  })
  nombre: string;

  @Column({ name: 'nivel', type: 'smallint' })
  nivel: number;

  @Column({ name: 'tipo', type: 'char', length: 1 })
  tipo: TipoPlanCuentas;

  @Column({ name: 'naturaleza', type: 'char', length: 1 })
  naturaleza: NaturalezaPlanCuentas;

  /** Cuenta en la que sumariza; null solo en las clases (nivel 1). */
  @Column({ name: 'id_padre', type: 'integer', nullable: true })
  idPadre: number | null;

  /** Solo se carga en el catálogo de imputables (para mostrar el grupo). */
  @ManyToOne(() => PlanCuentas, { nullable: true })
  @JoinColumn({ name: 'id_padre' })
  padre?: PlanCuentas | null;

  /** Cuenta de ajuste AITB (opcional). */
  @Column({ name: 'id_cuenta_aitb', type: 'integer', nullable: true })
  idCuentaAitb: number | null;

  @Column({
    name: 'categoria',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  categoria: CategoriaPlanCuentas | null;
}
