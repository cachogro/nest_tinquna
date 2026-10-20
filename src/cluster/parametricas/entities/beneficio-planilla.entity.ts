import { BadRequestException } from '@nestjs/common';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

/** Porcentaje o monto: exactamente uno de los dos (catálogo y asignación a la persona). */
export function validarValorBeneficio(
  porcentaje: number | null | undefined,
  monto: number | null | undefined,
): { porcentaje: number | null; monto: number | null } {
  const conPorcentaje = porcentaje != null;
  const conMonto = monto != null;
  if (conPorcentaje === conMonto) {
    throw new BadRequestException(
      'Indica el porcentaje o, si no se usa porcentaje, el monto del beneficio (uno de los dos).',
    );
  }
  return { porcentaje: conPorcentaje ? Number(porcentaje) : null, monto: conMonto ? Number(monto) : null };
}

/**
 * Beneficio que se paga como bono extra en la boleta de sueldo durante
 * `meses` meses seguidos (subsidio de lactancia, natalidad...). El importe
 * mensual es UNO de dos:
 *
 *   porcentaje: % sobre el salario mensual de la persona;
 *   monto:      importe fijo en Bs, cuando no se usa porcentaje.
 *
 * `cotiza` = entra en la base de los descuentos y aportes (AFP, CNS).
 * Son los valores por defecto: al asignarlo a una persona se copian a
 * `PersonalBeneficio` y ahí se pueden cambiar.
 */
@Entity({
  name: 'beneficio_planilla',
  schema: 'parametrica',
})
export class BeneficioPlanilla extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nombre', type: 'varchar', length: 80 })
  nombre: string;

  @Column({ name: 'porcentaje', type: 'numeric', precision: 8, scale: 4, nullable: true })
  porcentaje?: number | null;

  @Column({ name: 'monto', type: 'numeric', precision: 16, scale: 2, nullable: true })
  monto?: number | null;

  @Column({ name: 'meses', type: 'int', default: 1 })
  meses: number;

  @Column({ name: 'cotiza', type: 'boolean', default: false })
  cotiza: boolean;

  @Column({ name: 'descripcion', type: 'varchar', length: 255, nullable: true })
  descripcion?: string | null;
}
