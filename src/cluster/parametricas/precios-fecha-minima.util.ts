import { BadRequestException } from '@nestjs/common';

/**
 * Primer día desde el que se registran cotizaciones y tablas de escala de
 * precio: la operación en el sistema arranca (migración) el 01/10/2026 y
 * no se cargan precios anteriores.
 */
export const FECHA_MINIMA_PRECIOS = '2026-10-01';

/** Rechaza un día ("YYYY-MM-DD", hora de Bolivia) anterior a FECHA_MINIMA_PRECIOS. */
export function validarFechaMinimaPrecios(dia: string): void {
  if (dia < FECHA_MINIMA_PRECIOS) {
    throw new BadRequestException(
      'Los precios deben ser del 01/10/2026 en adelante (inicio de operación en el sistema).',
    );
  }
}
