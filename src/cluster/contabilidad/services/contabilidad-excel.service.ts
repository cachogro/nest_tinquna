import { Injectable } from '@nestjs/common';
import { Borders, Cell, PaperSize, Workbook, Worksheet } from 'exceljs';

export const NOMBRE_EMPRESA = 'EMPRESA MINERA TINKURIQUNA S.R.L.';

export const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

/**
 * Formato contable de los libros físicos (kardex y libreta de bancos): miles
 * con coma, dos decimales, negativos con signo y los ceros como "-".
 */
export const FORMATO_CONTABLE = '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-';
export const FORMATO_FECHA = 'dd/mm/yyyy';

/**
 * Paleta de un reporte: cada libro contable conserva el color de su modelo
 * físico, pero todos comparten la misma estructura (cabecera, encabezado de
 * columnas, filas y totales).
 */
export interface PaletaContable {
  /** Relleno del encabezado de columnas. */
  encabezado: string;
  /** Relleno suave: saldo inicial/anterior y filas destacadas. */
  suave: string;
  /** Relleno de la fila de totales. */
  total: string;
}

export const PALETAS = {
  // "caja de flujo y kardex.xlsx", hoja CAJA DE FLUJO: azul (Accent 5).
  cajaFlujo: { encabezado: 'FFB4C6E7', suave: 'FFD9E1F2', total: 'FFB4C6E7' },
  // "caja de flujo y kardex.xlsx", hoja de kardex: naranja (Accent 2).
  kardex: { encabezado: 'FFF4B084', suave: 'FFFCE4D6', total: 'FFFCE4D6' },
  // "LIBRETA DE BANCOS": dorado (Accent 4). Lo usa también la rendición de
  // cuentas, que es un libro de cargo/descargo del mismo tipo.
  libreta: { encabezado: 'FFFFC000', suave: 'FFFFF2CC', total: 'FFFFC000' },
  // Libro de recibos: verde (Accent 6), para distinguirlo de los libros de
  // caja, kardex y rendición.
  recibos: { encabezado: 'FFC6E0B4', suave: 'FFE2EFDA', total: 'FFC6E0B4' },
  // Libro de traspasos caja <-> banco: lila, distinto de caja y libreta.
  traspasos: { encabezado: 'FFD9D2E9', suave: 'FFEDE7F6', total: 'FFD9D2E9' },
} satisfies Record<string, PaletaContable>;

export interface ColumnaContable {
  titulo: string;
  ancho: number;
  alineacion?: 'left' | 'center' | 'right';
  /** Columna de importes: se imprime con `FORMATO_CONTABLE`. */
  importe?: boolean;
  /** Columna de fecha: se imprime con `FORMATO_FECHA`. */
  fecha?: boolean;
}

export interface DatoCabecera {
  etiqueta: string;
  valor: string;
}

const BORDE_FINO: Partial<Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

const FUENTE = 'Calibri';

/**
 * Diseño común de todos los Excel del módulo de contabilidad (caja de flujo,
 * kardex, rendición de cuentas...). No reutiliza `ExcelService` a propósito:
 * ese servicio lo comparten los reportes de valorización, que tienen su
 * propio formato.
 *
 * Estructura de la hoja:
 *   1. Nombre de la empresa.
 *   2. Título del reporte.
 *   3. Subtítulo (moneda, "practicado al", etc.).
 *   5+. Datos de cabecera en recuadros (responsable, período, gestión...).
 *   Encabezado de columnas, detalle y fila de totales.
 */
@Injectable()
export class ContabilidadExcelService {
  crearLibro(): Workbook {
    const workbook = new Workbook();
    workbook.creator = NOMBRE_EMPRESA;
    workbook.company = NOMBRE_EMPRESA;
    workbook.created = new Date();
    workbook.modified = new Date();
    return workbook;
  }

  crearHoja(workbook: Workbook, nombre: string, columnas: ColumnaContable[]): Worksheet {
    const worksheet = workbook.addWorksheet(nombre.slice(0, 31), {
      properties: { defaultRowHeight: 18 },
      pageSetup: {
        // Carta (Letter): código 1 de OOXML. El enum PaperSize de exceljs no
        // lo incluye porque es el valor por defecto, pero se deja explícito
        // para que no dependa de la configuración regional de la impresora.
        paperSize: 1 as PaperSize,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
      },
      headerFooter: {
        oddFooter: `&L&8${NOMBRE_EMPRESA}&R&8Página &P de &N`,
      },
    });
    worksheet.columns = columnas.map((c) => ({ width: c.ancho }));
    return worksheet;
  }

  /** Filas 1 a 3: empresa, título y subtítulo, centrados sobre todas las columnas. */
  agregarTitulos(
    worksheet: Worksheet,
    totalColumnas: number,
    titulo: string,
    subtitulo?: string,
  ): void {
    this.celdaCombinada(worksheet, 1, 1, totalColumnas, NOMBRE_EMPRESA, {
      font: { name: FUENTE, bold: true, size: 18 },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    worksheet.getRow(1).height = 28;

    this.celdaCombinada(worksheet, 2, 1, totalColumnas, titulo, {
      font: { name: FUENTE, bold: true, size: 14 },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    worksheet.getRow(2).height = 22;

    if (subtitulo) {
      this.celdaCombinada(worksheet, 3, 1, totalColumnas, subtitulo, {
        font: { name: FUENTE, italic: true, size: 11 },
        alignment: { horizontal: 'center', vertical: 'middle' },
      });
    }
  }

  /**
   * Datos de cabecera en recuadros con borde doble, como el modelo de la caja
   * de flujo ("RESPONSABLE", "PERÍODO", "GESTIÓN"). Cada dato ocupa el rango
   * de columnas indicado; varios datos pueden compartir la misma fila.
   */
  agregarDatoCabecera(
    worksheet: Worksheet,
    fila: number,
    desde: number,
    hasta: number,
    dato: DatoCabecera,
    alineacion: 'left' | 'center' | 'right' = 'left',
  ): void {
    const celda = this.celdaCombinada(worksheet, fila, desde, hasta, '', {
      alignment: { horizontal: alineacion, vertical: 'middle', wrapText: true },
    });
    celda.value = {
      richText: [
        { text: `${dato.etiqueta}: `, font: { name: FUENTE, bold: true, size: 11 } },
        { text: dato.valor, font: { name: FUENTE, size: 11 } },
      ],
    };
    for (let col = desde; col <= hasta; col++) {
      worksheet.getCell(fila, col).border = {
        top: { style: 'double' },
        bottom: { style: 'double' },
        left: col === desde ? { style: 'double' } : undefined,
        right: col === hasta ? { style: 'double' } : undefined,
      };
    }
    worksheet.getRow(fila).height = 20;
  }

  /**
   * Encabezado de columnas con el relleno de la paleta; congela la hoja
   * debajo de él y lo repite en cada página impresa.
   */
  agregarEncabezado(
    worksheet: Worksheet,
    fila: number,
    columnas: ColumnaContable[],
    paleta: PaletaContable,
  ): void {
    const row = worksheet.getRow(fila);
    row.height = 32;
    columnas.forEach((columna, i) => {
      const cell = row.getCell(i + 1);
      cell.value = columna.titulo;
      cell.font = { name: FUENTE, bold: true, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = this.relleno(paleta.encabezado);
      cell.border = BORDE_FINO;
    });

    worksheet.views = [{ state: 'frozen', ySplit: fila }];
    worksheet.pageSetup.printTitlesRow = `${fila}:${fila}`;
  }

  /**
   * Agrega una fila de detalle en `fila` con bordes finos, texto ajustado y
   * el formato de cada columna (importe/fecha). Con `destacada` se pinta con
   * el relleno suave de la paleta y en negrita (saldo inicial/anterior).
   */
  agregarFila(
    worksheet: Worksheet,
    fila: number,
    columnas: ColumnaContable[],
    valores: Array<string | number | Date | null>,
    opciones: { relleno?: string; negrita?: boolean } = {},
  ): void {
    const row = worksheet.getRow(fila);
    columnas.forEach((columna, i) => {
      const cell = row.getCell(i + 1);
      cell.value = valores[i] ?? null;
      cell.font = { name: FUENTE, size: 11, bold: opciones.negrita };
      cell.border = BORDE_FINO;
      cell.alignment = {
        vertical: 'middle',
        horizontal: columna.alineacion ?? (columna.importe ? 'right' : columna.fecha ? 'center' : 'left'),
        wrapText: !columna.importe && !columna.fecha,
      };
      if (columna.importe) {
        cell.numFmt = FORMATO_CONTABLE;
      } else if (columna.fecha) {
        cell.numFmt = FORMATO_FECHA;
      }
      if (opciones.relleno) {
        cell.fill = this.relleno(opciones.relleno);
      }
    });
  }

  /**
   * Fila de totales: la etiqueta se combina desde la columna 1 hasta
   * `hastaColumnaEtiqueta`; `importes` asigna valor por número de columna.
   * Las demás columnas quedan vacías pero con el mismo relleno y borde.
   */
  agregarTotal(
    worksheet: Worksheet,
    fila: number,
    totalColumnas: number,
    hastaColumnaEtiqueta: number,
    etiqueta: string,
    importes: Record<number, number>,
    paleta: PaletaContable,
  ): void {
    worksheet.mergeCells(fila, 1, fila, hastaColumnaEtiqueta);
    worksheet.getCell(fila, 1).value = etiqueta;
    for (let col = 1; col <= totalColumnas; col++) {
      const cell = worksheet.getCell(fila, col);
      if (col > hastaColumnaEtiqueta) {
        cell.value = importes[col] ?? null;
        cell.numFmt = FORMATO_CONTABLE;
      }
      cell.font = { name: FUENTE, bold: true, size: 12 };
      cell.fill = this.relleno(paleta.total);
      cell.alignment = {
        horizontal: col <= hastaColumnaEtiqueta ? 'center' : 'right',
        vertical: 'middle',
      };
      cell.border = {
        top: { style: 'double' },
        bottom: { style: 'double' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
    worksheet.getRow(fila).height = 22;
  }

  /** Líneas de firma repartidas en partes iguales sobre el ancho de la hoja. */
  agregarFirmas(worksheet: Worksheet, fila: number, totalColumnas: number, etiquetas: string[]): void {
    const ancho = Math.floor(totalColumnas / etiquetas.length) || 1;
    etiquetas.forEach((etiqueta, i) => {
      const desde = i * ancho + 1;
      const hasta = i === etiquetas.length - 1 ? totalColumnas : desde + ancho - 1;
      this.celdaCombinada(worksheet, fila, desde, hasta, etiqueta, {
        font: { name: FUENTE, size: 10, bold: true },
        alignment: { horizontal: 'center', vertical: 'top' },
      });
      for (let col = desde; col <= hasta; col++) {
        worksheet.getCell(fila, col).border = { top: { style: 'thin' } };
      }
    });
  }

  /** "2026-09-24..." → Date en UTC (Excel la muestra sin corrimiento de zona horaria). */
  fecha(valor?: string | null): Date | null {
    const match = valor?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return null;
    }
    const [, anio, mes, dia] = match;
    return new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  }

  /** "2026-09-24..." → "24/09/2026", para textos (subtítulos, leyendas). */
  fechaTexto(valor?: string | null): string {
    const match = valor?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return valor ?? '';
    }
    const [, anio, mes, dia] = match;
    return `${dia}/${mes}/${anio}`;
  }

  async generar(workbook: Workbook): Promise<Buffer> {
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private celdaCombinada(
    worksheet: Worksheet,
    fila: number,
    desde: number,
    hasta: number,
    valor: string,
    estilo: Partial<Pick<Cell, 'font' | 'alignment'>>,
  ): Cell {
    if (hasta > desde) {
      worksheet.mergeCells(fila, desde, fila, hasta);
    }
    const cell = worksheet.getCell(fila, desde);
    cell.value = valor;
    if (estilo.font) {
      cell.font = estilo.font;
    }
    if (estilo.alignment) {
      cell.alignment = estilo.alignment;
    }
    return cell;
  }

  private relleno(argb: string) {
    return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } };
  }
}
