import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PlanCuentas } from './entities/plan-cuentas.entity';

/** Tablas de contabilidad que imputan movimientos a una cuenta del plan. */
const TABLAS_CON_PLAN_CUENTAS = [
  'bien_dacion_pago_gasto',
  'fondo_rendir_detalle',
  'fondo_rendir',
  'libreta_banco',
  'movimiento_caja',
  'movimiento_kardex',
  'pago_valorizacion',
  'recibo_detalle',
  'traspaso',
];

/** true si algún movimiento de contabilidad usa la cuenta. */
export async function cuentaTieneMovimientos(
  manager: EntityManager,
  idPlanCuentas: number,
): Promise<boolean> {
  const union = TABLAS_CON_PLAN_CUENTAS.map(
    (t) => `SELECT 1 FROM contabilidad.${t} WHERE id_plan_cuentas = $1`,
  ).join(' UNION ALL ');
  const filas: unknown[] = await manager.query(
    `SELECT EXISTS (${union}) AS existe`,
    [idPlanCuentas],
  );
  return Boolean((filas[0] as { existe: boolean }).existe);
}

/**
 * Cuenta del plan en la que se puede registrar un movimiento: debe existir,
 * ser de detalle (tipo D: nivel 5, o nivel 4 sin subcuentas) y estar activa.
 * Las de resumen solo agrupan. La usan caja, bancos, recibos, kardex, fondos, traspasos y pagos.
 */
export async function obtenerCuentaImputable(
  manager: EntityManager,
  idPlanCuentas: number,
): Promise<PlanCuentas> {
  const cuenta = await manager.findOne(PlanCuentas, {
    where: { id: idPlanCuentas },
  });
  if (!cuenta) {
    throw new NotFoundException(
      'No existe la cuenta del plan de cuentas seleccionada.',
    );
  }
  if (cuenta.tipo !== 'D') {
    throw new BadRequestException(
      `La cuenta ${cuenta.codigo} ${cuenta.nombre} es de resumen: elija una de sus subcuentas.`,
    );
  }
  if (cuenta.activo === false) {
    throw new BadRequestException(
      `La cuenta ${cuenta.codigo} ${cuenta.nombre} está dada de baja.`,
    );
  }
  return cuenta;
}

/** "110204001 Eraldio Francisco Vargas": cómo se muestra una cuenta en reportes y PDFs. */
export function textoCuenta(
  cuenta: Pick<PlanCuentas, 'codigo' | 'nombre'> | null | undefined,
): string {
  return cuenta ? `${cuenta.codigo} ${cuenta.nombre}` : '';
}
