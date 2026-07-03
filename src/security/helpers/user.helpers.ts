// src/aduana/helpers/vuce.helpers.ts

/**
 * Formatea una fecha al string DD-MM-YYYY.
 * @param fecha Fecha de tipo Date o string.
 * @returns String formateado o null si la fecha es inválida.
 */
export function formatoDDMMYYYY(fecha: Date | string): string | null {
  if (!fecha) return null;
  const dateObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (isNaN(dateObj.getTime())) return null; // Maneja fechas inválidas
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`; // Usé / como en tus ejemplos de Swagger
}

/**
 * Obtiene el nombre del lugar de emisión por su ID.
 * @param id ID numérico del lugar de emisión.
 * @returns Nombre del lugar o 'DESCONOCIDO' si no lo encuentra.
 */
export function lugarEmisionPorId(id: number): string {
  const lugaresEmision: Record<number, string> = {
    1: 'EXTRANJERO',
    2: 'BENI',
    3: 'COCHABAMBA',
    4: 'LA PAZ',
    5: 'ORURO',
    6: 'PANDO',
    7: 'POTOSI',
    8: 'SANTA CRUZ',
    9: 'TARIJA',
    10: 'CHUQUISACA',
  };
  return lugaresEmision[id] || 'DESCONOCIDO';
}

/**
 * Obtiene el nombre del tipo de documento por su ID.
 * @param id ID numérico del tipo de documento.
 * @returns Nombre del tipo de documento o 'DESCONOCIDO' si no lo encuentra.
 */
export function tipoDocumentoPorId(id: number): string {
  const tiposDocumento: Record<number, string> = {
    1: 'CI',
    2: 'PASAPORTE',
    3: 'NIT',
  };
  return tiposDocumento[id] || 'DESCONOCIDO';
}