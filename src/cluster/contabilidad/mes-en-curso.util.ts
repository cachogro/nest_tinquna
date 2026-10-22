import { BadRequestException } from '@nestjs/common';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Hoy en hora de Bolivia (UTC-4 fijo), "YYYY-MM-DD". */
export function hoyBolivia(): string {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Caja y bancos solo se mueven en el MES EN CURSO: se puede registrar con
 * una fecha anterior dentro del mes (ej. el 15 un recibo del 5; los saldos
 * se recalculan en orden de fecha), pero no en un mes pasado ni en uno
 * futuro. Para corregir un mes pasado se registra una regularización en el
 * mes actual.
 *
 * Para cargar datos históricos (migración) se desactiva con la variable de
 * entorno CONTABILIDAD_PERMITIR_OTROS_MESES=true; en producción no debe
 * estar.
 */
export function validarMesEnCurso(fecha: string | Date, que: string): void {
  if (process.env.CONTABILIDAD_PERMITIR_OTROS_MESES === 'true') return;
  const iso = typeof fecha === 'string' ? fecha.slice(0, 10) : fecha.toISOString().slice(0, 10);
  const hoy = hoyBolivia();
  if (iso.slice(0, 7) === hoy.slice(0, 7)) return;
  const nombreMes = (d: string) => `${MESES[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
  throw new BadRequestException(
    `${que}: la fecha ${iso.split('-').reverse().join('/')} es de ${nombreMes(iso)}, y solo se registran movimientos del mes en curso (${nombreMes(hoy)}). Para corregir otro mes, registrá una regularización en el mes actual.`,
  );
}

/**
 * Un movimiento nuevo (o al que se le cambia la fecha) no puede quedar con
 * fecha posterior a hoy: descuadra el saldo del día aunque sea del mismo mes.
 * No aplica al anular, para poder anular uno cargado con fecha futura.
 */
export function validarFechaNoFutura(fecha: string | Date, que: string): void {
  const iso = typeof fecha === 'string' ? fecha.slice(0, 10) : fecha.toISOString().slice(0, 10);
  const hoy = hoyBolivia();
  if (iso <= hoy) return;
  throw new BadRequestException(
    `${que}: la fecha ${iso.split('-').reverse().join('/')} es posterior a hoy (${hoy.split('-').reverse().join('/')}); no se registran movimientos con fecha futura.`,
  );
}
