// Fecha y hora impresas en recibos, boletas y comprobantes. Usa la hora local
// del servidor (America/La_Paz, ver main.ts).

const dos = (n: number): string => String(n).padStart(2, '0');

/** "14:35" */
export function formatearHora(momento: Date | string): string {
  const d = new Date(momento);
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** "13/10/2026 14:35" */
export function formatearFechaHora(momento: Date | string): string {
  const d = new Date(momento);
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${formatearHora(d)}`;
}

/**
 * Agrega la hora de emisión a la fecha (ya formateada) de un documento. La
 * fecha contable la elige el usuario y puede no ser el día en que se emitió:
 * si coinciden, queda "13/10/2026 - 14:35"; si no, la fecha contable seguida
 * de cuándo se emitió realmente: "05/10/2026 (emitido 13/10/2026 14:35)".
 */
export function fechaConHoraEmision(
  fechaFormateada: string,
  fechaContable: string,
  emision?: Date | string | null,
): string {
  if (!emision) return fechaFormateada;
  const d = new Date(emision);
  const diaEmision = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  return diaEmision === (fechaContable ?? '').slice(0, 10)
    ? `${fechaFormateada} - ${formatearHora(d)}`
    : `${fechaFormateada} (emitido ${formatearFechaHora(d)})`;
}
