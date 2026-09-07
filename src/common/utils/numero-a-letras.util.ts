const UNIDADES = [
  '',
  'un',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
];
const DIECIS = [
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
];
const DECENAS = [
  '',
  '',
  'veinte',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
];
const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

/** Convierte un número entero (0 a 999) a texto en español. */
function trescientos(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';

  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (c > 0) partes.push(CENTENAS[c]);

  if (resto > 0) {
    if (resto < 10) {
      partes.push(UNIDADES[resto]);
    } else if (resto < 20) {
      partes.push(DIECIS[resto - 10]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      if (u === 0) {
        partes.push(DECENAS[d]);
      } else if (d === 2) {
        // veintiuno, veintidós...
        partes.push(`veinti${UNIDADES[u]}`);
      } else {
        partes.push(`${DECENAS[d]} y ${UNIDADES[u]}`);
      }
    }
  }

  return partes.join(' ');
}

/** Convierte un entero no negativo (0 a 999.999.999) a texto en español. */
export function numeroALetras(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return 'cero';

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];

  if (millones > 0) {
    partes.push(
      millones === 1 ? 'un millón' : `${trescientos(millones)} millones`,
    );
  }

  if (miles > 0) {
    partes.push(miles === 1 ? 'mil' : `${trescientos(miles)} mil`);
  }

  if (resto > 0) {
    partes.push(trescientos(resto));
  }

  return partes.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Monto en letras con formato de comprobante boliviano:
 * "Trescientos mil bolivianos con 00/100".
 */
export function montoEnLetrasBolivianos(monto: number): string {
  const entero = Math.floor(Math.abs(monto));
  const centavos = Math.round((Math.abs(monto) - entero) * 100);

  const letras = numeroALetras(entero);
  const moneda = entero === 1 ? 'boliviano' : 'bolivianos';
  const centavosTxt = String(centavos).padStart(2, '0');

  const texto = `${letras} ${moneda} con ${centavosTxt}/100`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
