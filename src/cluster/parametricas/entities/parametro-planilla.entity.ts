import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

/**
 * Códigos de `parametro_planilla` que usa el cálculo de sueldos. Los
 * registros los carga el script SQL; desde el panel solo se edita el valor.
 */
export const PARAMETROS_PLANILLA = {
  SALARIO_MINIMO_NACIONAL: 'SALARIO_MINIMO_NACIONAL',
  BASE_BONO_ANTIGUEDAD_SMN: 'BASE_BONO_ANTIGUEDAD_SMN',
  DIAS_MES: 'DIAS_MES',
  HORAS_JORNADA_DIA: 'HORAS_JORNADA_DIA',
  RECARGO_HORA_EXTRA: 'RECARGO_HORA_EXTRA',
  MESES_PROMEDIO_INDEMNIZACION: 'MESES_PROMEDIO_INDEMNIZACION',
  DIAS_MINIMOS_INDEMNIZACION: 'DIAS_MINIMOS_INDEMNIZACION',
  DIAS_MINIMOS_AGUINALDO: 'DIAS_MINIMOS_AGUINALDO',
  DESAHUCIO_SUELDOS: 'DESAHUCIO_SUELDOS',
  TOLERANCIA_ATRASO_MINUTOS: 'TOLERANCIA_ATRASO_MINUTOS',
  TOLERANCIA_SALIDA_MINUTOS: 'TOLERANCIA_SALIDA_MINUTOS',
  MODO_DESCUENTO_ATRASO: 'MODO_DESCUENTO_ATRASO',
  FACTOR_DESCUENTO_ATRASO: 'FACTOR_DESCUENTO_ATRASO',
  FACTOR_DESCUENTO_FALTA: 'FACTOR_DESCUENTO_FALTA',
  FACTOR_DOMINICAL: 'FACTOR_DOMINICAL',
} as const;

export type CodigoParametroPlanilla =
  (typeof PARAMETROS_PLANILLA)[keyof typeof PARAMETROS_PLANILLA];

/** Valor suelto de la planilla de sueldos (salario mínimo, recargos...). */
@Entity({
  name: 'parametro_planilla',
  schema: 'parametrica',
})
export class ParametroPlanilla extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'codigo', type: 'varchar', length: 40 })
  codigo: string;

  @Column({ name: 'descripcion', type: 'varchar', length: 150 })
  descripcion: string;

  @Column({ name: 'valor', type: 'numeric', precision: 16, scale: 4 })
  valor: number;

  @Column({ name: 'unidad', type: 'varchar', length: 20, nullable: true })
  unidad?: string | null;
}
