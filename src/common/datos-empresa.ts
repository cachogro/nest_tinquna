/**
 * Datos de la empresa que se imprimen en los reportes (Excel y PDF): razón
 * social, NIT, RUEX y NIM. La fuente es `parametrica.datos_empleador`
 * (Paramétricas › Sueldos y planillas › Empleador): PlanillaConfigService
 * los carga al arrancar y los actualiza al guardar, así los generadores de
 * reportes, que son síncronos, los leen de acá sin consultar la base.
 */
export interface DatosEmpresa {
  razonSocial: string;
  nit: string | null;
  ruex: string | null;
  nim: string | null;
  sucursal: string | null;
  puntoVenta: string | null;
  direccion: string | null;
  telefono: string | null;
  ciudad: string | null;
}

/** Valor hasta que se lean los datos de la base. */
const datos: DatosEmpresa = {
  razonSocial: 'EMPRESA TINKURIQUNA MINERALS S.R.L.',
  nit: null,
  ruex: null,
  nim: null,
  sucursal: null,
  puntoVenta: null,
  direccion: null,
  telefono: null,
  ciudad: null,
};

export function datosEmpresa(): Readonly<DatosEmpresa> {
  return datos;
}

export function actualizarDatosEmpresa(nuevos: Partial<DatosEmpresa>): void {
  if (nuevos.razonSocial?.trim()) datos.razonSocial = nuevos.razonSocial.trim();
  if (nuevos.nit !== undefined) datos.nit = nuevos.nit?.trim() || null;
  if (nuevos.ruex !== undefined) datos.ruex = nuevos.ruex?.trim() || null;
  if (nuevos.nim !== undefined) datos.nim = nuevos.nim?.trim() || null;
  for (const campo of ['sucursal', 'puntoVenta', 'direccion', 'telefono', 'ciudad'] as const) {
    if (nuevos[campo] !== undefined) datos[campo] = nuevos[campo]?.trim() || null;
  }
}

/**
 * "CASA MATRIZ · ZONA: SAN MARTIN, CALLE: OMISTE, NRO.: 294 · TELF. 77456512 · POTOSI"
 * (solo lo que esté cargado).
 */
export function ubicacionEmpresa(): string {
  return [
    datos.sucursal,
    datos.direccion,
    datos.telefono ? 'TELF. ' + datos.telefono : null,
    datos.ciudad,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "TINKURIQUNA S.R.L. · NIT 677815027" (sin NIT, solo el nombre). */
export function empresaConNit(): string {
  return datos.nit ? `${datos.razonSocial} · NIT ${datos.nit}` : datos.razonSocial;
}

/**
 * "NIT 677815027" en letra chica debajo del logo de recibos y boletas (PDF).
 * Sin NIT cargado no imprime nada.
 */
export function nitBajoLogo(doc: PDFKit.PDFDocument, x: number, y: number): void {
  if (!datos.nit) return;
  doc
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor('#333333')
    .text(`NIT ${datos.nit}`, x, y, { lineBreak: false })
    .fillColor('#000000');
}
