import { BadRequestException } from '@nestjs/common';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { MonedaCaja } from './entities/periodo-caja.entity';

/**
 * Moneda de un recibo / movimiento de kardex. La moneda base de la
 * contabilidad es el boliviano: el kardex lleva su saldo siempre en Bs., y
 * un movimiento en USD se convierte con el tipo de cambio que se indique.
 */

/**
 * Valida el par moneda / tipo de cambio: en USD el tipo de cambio es
 * obligatorio; en BS se ignora (se guarda null).
 */
export function resolverTipoCambio(
  moneda: MonedaCaja,
  tipoCambio?: number | string | null,
): number | null {
  if (moneda === 'BS') {
    return null;
  }
  const tc = Number(tipoCambio);
  if (!tipoCambio || !(tc > 0)) {
    throw new BadRequestException(
      'Para un movimiento en USD debe indicar el tipo de cambio (tipoCambio).',
    );
  }
  return tc;
}

/** Monto convertido a bolivianos (redondeado a 2 decimales). */
export function aBolivianos(
  monto: number,
  moneda: MonedaCaja,
  tipoCambio: number | string | null,
): number {
  const valor = moneda === 'USD' ? Number(monto) * Number(tipoCambio) : Number(monto);
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Moneda de la cuenta bancaria ('BS' / 'USD'), tipada como la de la caja. */
export function monedaDeCuenta(cuenta: CuentaBancaria): MonedaCaja {
  return cuenta.moneda === 'USD' ? 'USD' : 'BS';
}

/** La cuenta bancaria debe estar en la misma moneda del movimiento. */
export function validarMonedaCuenta(cuenta: CuentaBancaria, moneda: MonedaCaja): void {
  if (monedaDeCuenta(cuenta) !== moneda) {
    throw new BadRequestException(
      `La cuenta bancaria ${cuenta.numeroCuenta} es en ${cuenta.moneda === 'USD' ? 'USD' : 'Bs.'}; el movimiento es en ${moneda === 'USD' ? 'USD' : 'Bs.'}. Elegí una cuenta de la misma moneda.`,
    );
  }
}
