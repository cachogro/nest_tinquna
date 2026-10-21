/**
 * Tratamiento que se imprime antes del nombre ("Lic. VANIA CONDORI"). El
 * registrado en persona_ci manda; sin él, Sr. o Sra. según el sexo; sin
 * sexo, ninguno (solo el nombre).
 */
export function tratamientoPersona(p: {
  tratamiento?: string | null;
  sexo?: string | null;
} | null | undefined): string | null {
  const propio = p?.tratamiento?.trim();
  if (propio) return propio;
  if (p?.sexo === 'F') return 'Sra.';
  if (p?.sexo === 'M') return 'Sr.';
  return null;
}
