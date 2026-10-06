import { Recibo } from './entities/recibo.entity';

/**
 * Datos de la recepción de mineral que se imprimen en el recibo de EGRESO
 * (serie C) de su anticipo. El comprobante propio de la recepción es el RM-
 * (ReciboRecepcionMineralPdfService, se emite siempre y no lleva montos); en
 * el recibo de egreso solo se resume la recepción dentro del concepto y se
 * muestra el muestrero.
 *
 * Todo requiere haber cargado `recibo.recepcionMineral` con su
 * `personalInterno`; si el recibo no proviene de una recepción, no agrega nada.
 */

/**
 * Concepto del recibo con el resumen de la recepción al final, ej.:
 * "ANTICIPO RECEPCIÓN ICC-0009, N° Sacos: 51, Balanza (Kg): 522, Humedad (%): 4".
 * Si el concepto no menciona el código de la recepción, también lo agrega.
 */
export function conceptoConRecepcion(recibo: Recibo): string {
  const concepto = recibo.concepto ?? '';
  const recepcion = recibo.recepcionMineral;
  if (!recepcion) return concepto;

  const codigo = recepcion.codigoOperacion ?? '';
  const partes = [
    concepto.trim().replace(/[,\s]+$/, ''),
    codigo && !concepto.toUpperCase().includes(codigo.toUpperCase())
      ? `Recepción ${codigo}`
      : '',
    `N° Sacos: ${recepcion.numeroSacos ?? 0}`,
    `Balanza (Kg): ${Math.round(Number(recepcion.balanzaL ?? 0))}`,
    `Humedad (%): ${
      recepcion.humedad ? String(recepcion.humedad).split('.')[0] : '0'
    }`,
  ];

  return partes.filter(Boolean).join(', ');
}

/** Muestrero de la recepción vinculada al recibo ('' si no proviene de una). */
export function muestreroRecepcionRecibo(recibo: Recibo): string {
  const muestrero = recibo.recepcionMineral?.personalInterno;
  return [
    muestrero?.nombres,
    muestrero?.apellidoPaterno,
    muestrero?.apellidoMaterno,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toUpperCase();
}
