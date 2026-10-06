import { Injectable } from '@nestjs/common';
import { Border, Cell, CellValue, Workbook, Worksheet } from 'exceljs';
import { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit-table') as PDFKit.PDFDocument;

import { FormatoReporte } from '../dto/reporte/formato-reporte.dto';
import { NOMBRE_EMPRESA } from './contabilidad-excel.service';

// Hoja carta en puntos (72 por pulgada) y margen "estrecho" de 0,5".
const CARTA = { ancho: 612, alto: 792 };
const MARGEN = 36;
const TAMANOS_BASE = [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5];
/** Por debajo de este tamaño solo se baja si la tabla no entra de otra forma. */
const BASE_LEGIBLE = 6.5;
/** Parte del ancho que se busca dejar libre para las columnas de texto. */
const HOLGURA_TEXTO = 0.18;
/** Tamaño de fuente de Excel que equivale al tamaño base del PDF. */
const TAMANO_EXCEL = 11;
const ALTO_FILA_EXCEL = 15;

type Horizontal = 'left' | 'center' | 'right';
type Vertical = 'top' | 'middle' | 'bottom';

interface Parte {
  texto: string;
  negrita: boolean;
}

interface Celda {
  fila: number;
  col: number;
  filas: number;
  cols: number;
  texto: string;
  /** Texto con tramos en negrita (etiqueta + valor de los datos de cabecera). */
  partes?: Parte[];
  /** Números y fechas: van en una sola línea, nunca se parten. */
  numero: boolean;
  negrita: boolean;
  cursiva: boolean;
  tachado: boolean;
  tamano: number;
  color: string;
  relleno?: string;
  horizontal: Horizontal;
  vertical: Vertical;
  bordes: { arriba: number; abajo: number; izquierda: number; derecha: number };
}

interface Hoja {
  filas: number;
  columnas: number;
  anchosExcel: number[];
  altosExcel: Array<number | undefined>;
  celdas: Celda[];
  /** Filas del encabezado de columnas, que se repiten en cada página. */
  encabezado?: { desde: number; hasta: number };
}

interface FilaEnPagina {
  fila: number;
  y: number;
  alto: number;
}

export interface OpcionesPdf {
  /** Hoja apaisada: la caja de flujo y el kardex, que son los de muchas columnas. */
  horizontal?: boolean;
}

/**
 * Versión PDF de los reportes Excel de contabilidad. No vuelve a consultar ni
 * a armar los datos: toma el .xlsx que ya genera cada servicio y lo dibuja
 * celda por celda (textos, combinadas, rellenos, bordes, negritas), así el
 * PDF y el Excel muestran siempre lo mismo. Hoja carta, márgenes estrechos,
 * encabezado de columnas repetido y páginas numeradas.
 */
@Injectable()
export class ContabilidadPdfService {
  /** Responde el reporte en el formato pedido a partir del .xlsx ya generado. */
  async enviar(
    res: Response,
    xlsx: Buffer,
    nombreSinExtension: string,
    formato: FormatoReporte = 'EXCEL',
    opciones: OpcionesPdf = {},
  ): Promise<void> {
    if (formato === 'PDF') {
      const pdf = await this.desdeExcel(xlsx, opciones);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename=${nombreSinExtension}.pdf`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
      return;
    }

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${nombreSinExtension}.xlsx`,
      'Content-Length': xlsx.length,
    });
    res.end(xlsx);
  }

  async desdeExcel(xlsx: Buffer, opciones: OpcionesPdf = {}): Promise<Buffer> {
    const workbook = new Workbook();
    await workbook.xlsx.load(xlsx as unknown as ArrayBuffer);

    const pagina = opciones.horizontal
      ? { ancho: CARTA.alto, alto: CARTA.ancho }
      : { ancho: CARTA.ancho, alto: CARTA.alto };

    // Sin márgenes de pdfkit: la paginación la lleva este servicio, y así
    // ningún texto dispara un salto de página automático.
    const doc = new PDFDocument({
      size: [pagina.ancho, pagina.alto],
      margin: 0,
      autoFirstPage: false,
      bufferPages: true,
    });
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    const fin = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);
    });

    for (const worksheet of workbook.worksheets) {
      this.dibujarHoja(doc, this.leerHoja(worksheet), pagina);
    }
    this.numerarPaginas(doc, pagina);

    doc.end();
    return fin;
  }

  // --------------------------------------------------------- lectura del Excel

  private leerHoja(worksheet: Worksheet): Hoja {
    const combinadas = new Map<string, { filas: number; cols: number }>();
    const cubiertas = new Set<string>();
    const rangos = (worksheet.model as { merges?: string[] }).merges ?? [];
    for (const rango of rangos) {
      const [desde, hasta] = rango.split(':').map((r) => this.referencia(r));
      combinadas.set(`${desde.fila},${desde.col}`, {
        filas: hasta.fila - desde.fila + 1,
        cols: hasta.col - desde.col + 1,
      });
      for (let f = desde.fila; f <= hasta.fila; f++) {
        for (let c = desde.col; c <= hasta.col; c++) {
          if (f !== desde.fila || c !== desde.col) cubiertas.add(`${f},${c}`);
        }
      }
    }

    const filas = worksheet.rowCount;
    const columnas = worksheet.columnCount;
    const celdas: Celda[] = [];

    for (let f = 1; f <= filas; f++) {
      for (let c = 1; c <= columnas; c++) {
        if (cubiertas.has(`${f},${c}`)) continue;
        const cell = worksheet.getCell(f, c);
        const rango = combinadas.get(`${f},${c}`) ?? { filas: 1, cols: 1 };
        // En una combinada cada borde lo guarda la celda de ese extremo.
        const ultimaCol = worksheet.getCell(f, c + rango.cols - 1);
        const ultimaFila = worksheet.getCell(f + rango.filas - 1, c);
        const bordes = {
          arriba: this.grosor(cell.border?.top),
          izquierda: this.grosor(cell.border?.left),
          derecha: this.grosor(ultimaCol.border?.right),
          abajo: this.grosor(ultimaFila.border?.bottom),
        };
        const contenido = this.contenido(cell.value, cell.numFmt);
        const relleno = this.relleno(cell);
        const conBorde = Object.values(bordes).some((b) => b > 0);
        if (!contenido.texto && !relleno && !conBorde) continue;

        celdas.push({
          fila: f,
          col: c,
          filas: rango.filas,
          cols: rango.cols,
          ...contenido,
          negrita: !!cell.font?.bold,
          cursiva: !!cell.font?.italic,
          tachado: !!cell.font?.strike,
          tamano: cell.font?.size ?? TAMANO_EXCEL,
          color: this.hex(cell.font?.color?.argb) ?? '#000000',
          relleno,
          horizontal: this.horizontal(cell, contenido.numero),
          vertical: this.vertical(cell),
          bordes,
        });
      }
    }

    const anchosExcel: number[] = [];
    for (let c = 1; c <= columnas; c++) {
      anchosExcel.push(worksheet.getColumn(c).width ?? 10);
    }
    const altosExcel: Array<number | undefined> = [];
    for (let f = 1; f <= filas; f++) {
      altosExcel.push(worksheet.getRow(f).height || undefined);
    }

    return {
      filas,
      columnas,
      anchosExcel,
      altosExcel,
      celdas,
      encabezado: this.filasEncabezado(worksheet),
    };
  }

  /** "$8:$9" / "8:9" de `printTitlesRow`: las filas que Excel repite al imprimir. */
  private filasEncabezado(
    worksheet: Worksheet,
  ): { desde: number; hasta: number } | undefined {
    const titulos = worksheet.pageSetup?.printTitlesRow;
    const match = titulos?.match(/(\d+)\D+(\d+)/);
    if (!match) return undefined;
    return { desde: Number(match[1]), hasta: Number(match[2]) };
  }

  /** "$AB$12" -> { fila: 12, col: 28 }. */
  private referencia(ref: string): { fila: number; col: number } {
    const match = ref.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/);
    if (!match) return { fila: 1, col: 1 };
    let col = 0;
    for (const letra of match[1]) col = col * 26 + (letra.charCodeAt(0) - 64);
    return { fila: Number(match[2]), col };
  }

  private contenido(
    valor: CellValue,
    numFmt?: string,
  ): { texto: string; partes?: Parte[]; numero: boolean } {
    if (valor === null || valor === undefined || valor === '') {
      return { texto: '', numero: false };
    }
    if (valor instanceof Date) {
      return { texto: this.fecha(valor), numero: true };
    }
    if (typeof valor === 'number') {
      return { texto: this.numero(valor, numFmt), numero: true };
    }
    if (typeof valor === 'string') {
      return { texto: valor, numero: false };
    }
    if (typeof valor === 'boolean') {
      return { texto: valor ? 'SI' : 'NO', numero: false };
    }
    if ('richText' in valor) {
      const partes = valor.richText
        .filter((p) => p.text)
        .map((p) => ({ texto: p.text, negrita: !!p.font?.bold }));
      return {
        texto: partes.map((p) => p.texto).join(''),
        partes,
        numero: false,
      };
    }
    if ('result' in valor) {
      return this.contenido(valor.result, numFmt);
    }
    if ('text' in valor) {
      return { texto: String(valor.text), numero: false };
    }
    return { texto: '', numero: false };
  }

  /** Aplica el formato numérico de la celda (decimales, miles, cero como "-"). */
  private numero(valor: number, numFmt?: string): string {
    const formato = numFmt ?? '';
    const seccion = formato.split(';')[0];
    const esFecha = /[dy]/i.test(seccion) && !/[#0]/.test(seccion);
    if (esFecha) {
      // Serial de Excel (días desde 1899-12-30) a fecha.
      return this.fecha(new Date(Math.round((valor - 25569) * 86400000)));
    }
    const decimales = seccion.match(/\.(0+)/)?.[1].length;
    if (decimales === undefined) {
      return String(Math.round(valor * 1e6) / 1e6);
    }
    if (valor === 0 && formato.includes('"-"')) {
      return '-';
    }
    return valor.toLocaleString('en-US', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
      useGrouping: seccion.includes(','),
    });
  }

  /** Las fechas de los reportes se guardan en UTC: se leen igual, sin corrimiento. */
  private fecha(valor: Date): string {
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${valor.getUTCFullYear()}`;
  }

  private relleno(cell: Cell): string | undefined {
    const fill = cell.fill;
    if (!fill || fill.type !== 'pattern' || fill.pattern !== 'solid') {
      return undefined;
    }
    const color = this.hex(fill.fgColor?.argb);
    return color === '#FFFFFF' ? undefined : color;
  }

  /** "FFB4C6E7" (ARGB) -> "#B4C6E7". */
  private hex(argb?: string): string | undefined {
    if (!argb || argb.length < 6) return undefined;
    return `#${argb.slice(-6).toUpperCase()}`;
  }

  private grosor(borde?: Partial<Border>): number {
    if (!borde?.style) return 0;
    return ['thin', 'hair', 'dotted', 'dashed'].includes(borde.style)
      ? 0.5
      : 1.1;
  }

  private horizontal(cell: Cell, numero: boolean): Horizontal {
    const h = cell.alignment?.horizontal;
    if (h === 'left' || h === 'center' || h === 'right') return h;
    return numero ? 'right' : 'left';
  }

  private vertical(cell: Cell): Vertical {
    const v = cell.alignment?.vertical;
    return v === 'top' || v === 'bottom' ? v : 'middle';
  }

  // ----------------------------------------------------------------- medidas

  private fuente(negrita: boolean, cursiva: boolean): string {
    if (negrita && cursiva) return 'Helvetica-BoldOblique';
    if (negrita) return 'Helvetica-Bold';
    return cursiva ? 'Helvetica-Oblique' : 'Helvetica';
  }

  private preparar(doc: PDFKit.PDFDocument, celda: Celda, base: number): void {
    doc
      .font(this.fuente(celda.negrita, celda.cursiva))
      .fontSize((celda.tamano * base) / TAMANO_EXCEL);
  }

  private margenCelda(base: number): { x: number; y: number } {
    return { x: Math.max(1.5, base * 0.3), y: Math.max(1.5, base * 0.3) };
  }

  /**
   * Elige el tamaño de letra y reparte el ancho de la hoja entre las columnas.
   * Los números y las fechas no se parten, así que su columna mide lo que
   * mida el más largo; los textos sí se ajustan en varias líneas y se llevan
   * el espacio que sobra, en la proporción que tienen en el Excel. Se busca
   * la letra más grande que deje holgura a los textos, sin bajar de
   * `BASE_LEGIBLE` salvo que la tabla no entre de otra forma.
   */
  private anchos(
    doc: PDFKit.PDFDocument,
    hoja: Hoja,
    util: number,
  ): { anchos: number[]; base: number } {
    const medidas = TAMANOS_BASE.map((base) => this.medir(doc, hoja, base));
    const entran = medidas.filter((m) => m.total <= util);
    const holgada = entran.find((m) => m.total <= util * (1 - HOLGURA_TEXTO));
    // Sin holgura suficiente: la letra legible más chica, que es la que más
    // espacio deja a los textos.
    const legible = entran.filter((m) => m.base >= BASE_LEGIBLE).pop();
    const elegida =
      holgada && holgada.base >= BASE_LEGIBLE
        ? holgada
        : (legible ?? entran[0]);

    if (!elegida) {
      // Ni con la letra más chica entra: se comprime en proporción.
      const { minimos, total, base } = medidas[medidas.length - 1];
      return { anchos: minimos.map((a) => (a * util) / total), base };
    }

    const { minimos, naturales, conTexto, total, base } = elegida;
    const anchos = [...minimos];
    let sobra = util - total;
    // Primero a las columnas de texto, sin pasar de lo que ocupan en una línea.
    let pendientes = anchos.map((_, i) => i).filter((i) => conTexto[i]);
    while (sobra > 0.01 && pendientes.length > 0) {
      const peso = pendientes.reduce((t, i) => t + hoja.anchosExcel[i], 0);
      const llenas = pendientes.filter(
        (i) => anchos[i] + (sobra * hoja.anchosExcel[i]) / peso >= naturales[i],
      );
      if (llenas.length === 0) {
        for (const i of pendientes) {
          anchos[i] += (sobra * hoja.anchosExcel[i]) / peso;
        }
        sobra = 0;
        break;
      }
      for (const i of llenas) {
        sobra -= Math.max(0, naturales[i] - anchos[i]);
        anchos[i] = Math.max(anchos[i], naturales[i]);
      }
      pendientes = pendientes.filter((i) => !llenas.includes(i));
    }
    // Lo que quede se reparte entre todas: la tabla ocupa el ancho de la hoja.
    if (sobra > 0.01) {
      const peso = hoja.anchosExcel.reduce((t, a) => t + a, 0);
      anchos.forEach((_, i) => {
        anchos[i] += (sobra * hoja.anchosExcel[i]) / peso;
      });
    }
    return { anchos, base };
  }

  /** Ancho mínimo y ancho "natural" (en una sola línea) de cada columna. */
  private medir(
    doc: PDFKit.PDFDocument,
    hoja: Hoja,
    base: number,
  ): {
    base: number;
    minimos: number[];
    naturales: number[];
    conTexto: boolean[];
    total: number;
  } {
    const margen = this.margenCelda(base);
    const minimos = new Array<number>(hoja.columnas).fill(2 * margen.x + 2);
    const naturales = new Array<number>(hoja.columnas).fill(0);
    const conTexto = new Array<boolean>(hoja.columnas).fill(false);

    for (const celda of hoja.celdas) {
      if (celda.cols !== 1 || !celda.texto) continue;
      const i = celda.col - 1;
      this.preparar(doc, celda, base);
      const completo = this.anchoTexto(doc, celda.texto) + 2 * margen.x + 1;
      naturales[i] = Math.max(naturales[i], completo);
      if (celda.numero) {
        minimos[i] = Math.max(minimos[i], completo);
      } else {
        conTexto[i] = true;
        const palabra = Math.max(
          ...celda.texto.split(/\s+/).map((p) => doc.widthOfString(p)),
        );
        minimos[i] = Math.max(minimos[i], palabra + 2 * margen.x + 1);
      }
    }

    const total = minimos.reduce((t, a) => t + a, 0);
    return { base, minimos, naturales, conTexto, total };
  }

  /** Ancho de un texto que puede traer saltos de línea. */
  private anchoTexto(doc: PDFKit.PDFDocument, texto: string): number {
    return Math.max(...texto.split('\n').map((l) => doc.widthOfString(l)));
  }

  private altoTexto(
    doc: PDFKit.PDFDocument,
    celda: Celda,
    ancho: number,
  ): number {
    if (celda.numero) return doc.currentLineHeight();
    return doc.heightOfString(celda.texto, { width: ancho, lineGap: 0 });
  }

  private altos(
    doc: PDFKit.PDFDocument,
    hoja: Hoja,
    anchos: number[],
    base: number,
  ): number[] {
    const margen = this.margenCelda(base);
    const escala = base / TAMANO_EXCEL;
    const altos = hoja.altosExcel.map((a) => (a ?? ALTO_FILA_EXCEL) * escala);
    const necesario = (celda: Celda): number => {
      this.preparar(doc, celda, base);
      const ancho = this.suma(anchos, celda.col - 1, celda.cols) - 2 * margen.x;
      return this.altoTexto(doc, celda, ancho) + 2 * margen.y;
    };

    for (const celda of hoja.celdas) {
      if (celda.filas === 1 && celda.texto) {
        altos[celda.fila - 1] = Math.max(
          altos[celda.fila - 1],
          necesario(celda),
        );
      }
    }
    // Una combinada vertical que no entra en sus filas estira la última.
    for (const celda of hoja.celdas) {
      if (celda.filas > 1 && celda.texto) {
        const falta =
          necesario(celda) - this.suma(altos, celda.fila - 1, celda.filas);
        if (falta > 0) altos[celda.fila + celda.filas - 2] += falta;
      }
    }
    return altos;
  }

  private suma(valores: number[], desde: number, cantidad: number): number {
    let total = 0;
    for (let i = desde; i < desde + cantidad; i++) total += valores[i] ?? 0;
    return total;
  }

  // ------------------------------------------------------------------ dibujo

  private dibujarHoja(
    doc: PDFKit.PDFDocument,
    hoja: Hoja,
    pagina: { ancho: number; alto: number },
  ): void {
    // Medir necesita una página abierta; se usa la primera de la hoja.
    doc.addPage({ size: [pagina.ancho, pagina.alto], margin: 0 });

    const util = pagina.ancho - 2 * MARGEN;
    const { anchos, base } = this.anchos(doc, hoja, util);
    const altos = this.altos(doc, hoja, anchos, base);
    const paginas = this.paginar(hoja, altos, pagina.alto);

    const xDeColumna: number[] = [];
    anchos.reduce((x, ancho) => {
      xDeColumna.push(x);
      return x + ancho;
    }, MARGEN);

    // Celdas que pasan por cada fila (las combinadas verticales, por todas las suyas).
    const porFila = new Map<number, Celda[]>();
    for (const celda of hoja.celdas) {
      for (let f = celda.fila; f < celda.fila + celda.filas; f++) {
        porFila.set(f, [...(porFila.get(f) ?? []), celda]);
      }
    }

    paginas.forEach((filasPagina, i) => {
      if (i > 0) doc.addPage({ size: [pagina.ancho, pagina.alto], margin: 0 });
      const posicion = new Map(filasPagina.map((f) => [f.fila, f]));

      // Tramo de cada celda en esta página: una combinada vertical cortada
      // por el salto se dibuja en cada página con las filas que le tocan.
      const tramos: Array<{
        celda: Celda;
        x: number;
        y: number;
        w: number;
        h: number;
      }> = [];
      const vistas = new Set<Celda>();
      for (const { fila, y } of filasPagina) {
        for (const celda of porFila.get(fila) ?? []) {
          if (vistas.has(celda)) continue;
          vistas.add(celda);
          let h = 0;
          for (let f = fila; f < celda.fila + celda.filas; f++) {
            const enPagina = posicion.get(f);
            if (!enPagina) break;
            h += enPagina.alto;
          }
          tramos.push({
            celda,
            x: xDeColumna[celda.col - 1],
            y,
            w: this.suma(anchos, celda.col - 1, celda.cols),
            h,
          });
        }
      }

      // Rellenos primero: si no, el de una celda tapa el borde de la vecina.
      for (const { celda, x, y, w, h } of tramos) {
        if (celda.relleno) doc.rect(x, y, w, h).fill(celda.relleno);
      }
      for (const tramo of tramos) {
        this.dibujarTexto(doc, tramo.celda, tramo, base);
        this.dibujarBordes(doc, tramo.celda, tramo);
      }
    });
  }

  /**
   * Reparte las filas en páginas. Desde la segunda, cada página empieza con
   * el encabezado de columnas; y el encabezado nunca queda solo al pie de una
   * página, sin al menos una fila de datos debajo.
   */
  private paginar(
    hoja: Hoja,
    altos: number[],
    altoPagina: number,
  ): FilaEnPagina[][] {
    const arriba = MARGEN;
    const abajo = altoPagina - MARGEN;
    const encabezado = hoja.encabezado;
    const ultima = Math.max(0, ...hoja.celdas.map((c) => c.fila + c.filas - 1));

    const paginas: FilaEnPagina[][] = [[]];
    let y = arriba;
    const agregar = (fila: number) => {
      const alto = altos[fila - 1];
      paginas[paginas.length - 1].push({ fila, y, alto });
      y += alto;
    };

    for (let fila = 1; fila <= ultima; fila++) {
      let necesario = altos[fila - 1];
      if (encabezado && fila === encabezado.desde) {
        necesario =
          this.suma(altos, fila - 1, encabezado.hasta - fila + 1) +
          (altos[encabezado.hasta] ?? 0);
      }
      const actual = paginas[paginas.length - 1];
      if (y + necesario > abajo && actual.length > 0) {
        paginas.push([]);
        y = arriba;
        if (encabezado && fila > encabezado.hasta) {
          for (let f = encabezado.desde; f <= encabezado.hasta; f++) agregar(f);
        }
      }
      agregar(fila);
    }
    return paginas;
  }

  private dibujarTexto(
    doc: PDFKit.PDFDocument,
    celda: Celda,
    caja: { x: number; y: number; w: number; h: number },
    base: number,
  ): void {
    if (!celda.texto) return;
    const margen = this.margenCelda(base);
    const ancho = caja.w - 2 * margen.x;
    this.preparar(doc, celda, base);
    doc.fillColor(celda.color);

    const unaLinea =
      celda.numero || this.entraEnUnaLinea(doc, celda, ancho, base);
    const alto = unaLinea
      ? doc.currentLineHeight()
      : doc.heightOfString(celda.texto, { width: ancho, lineGap: 0 });
    let y = caja.y + (caja.h - alto) / 2;
    if (celda.vertical === 'top') y = caja.y + margen.y;
    if (celda.vertical === 'bottom') y = caja.y + caja.h - margen.y - alto;
    y = Math.max(y, caja.y + 0.5);

    const anchoLinea = unaLinea ? this.anchoPartes(doc, celda, base) : 0;
    const recortar = alto > caja.h || anchoLinea > ancho + 0.5;
    if (recortar) {
      doc.save();
      doc.rect(caja.x, caja.y, caja.w, caja.h).clip();
    }

    if (unaLinea) {
      // Alineado a mano: sin ajuste de línea pdfkit no alinea dentro del ancho.
      let x = caja.x + margen.x;
      if (celda.horizontal === 'center') x += (ancho - anchoLinea) / 2;
      if (celda.horizontal === 'right') x += ancho - anchoLinea;
      for (const parte of celda.partes ?? [
        { texto: celda.texto, negrita: celda.negrita },
      ]) {
        doc.font(this.fuente(parte.negrita, celda.cursiva));
        doc.text(parte.texto, x, y, {
          lineBreak: false,
          strike: celda.tachado,
        });
        x += doc.widthOfString(parte.texto);
      }
    } else {
      doc.text(celda.texto, caja.x + margen.x, y, {
        width: ancho,
        align: celda.horizontal,
        lineGap: 0,
        strike: celda.tachado,
      });
    }

    if (recortar) doc.restore();
  }

  private entraEnUnaLinea(
    doc: PDFKit.PDFDocument,
    celda: Celda,
    ancho: number,
    base: number,
  ): boolean {
    if (celda.texto.includes('\n')) return false;
    return this.anchoPartes(doc, celda, base) <= ancho;
  }

  /** Ancho del texto en una línea, respetando los tramos en negrita. */
  private anchoPartes(
    doc: PDFKit.PDFDocument,
    celda: Celda,
    base: number,
  ): number {
    this.preparar(doc, celda, base);
    if (!celda.partes) return doc.widthOfString(celda.texto);
    const total = celda.partes.reduce((suma, parte) => {
      doc.font(this.fuente(parte.negrita, celda.cursiva));
      return suma + doc.widthOfString(parte.texto);
    }, 0);
    this.preparar(doc, celda, base);
    return total;
  }

  private dibujarBordes(
    doc: PDFKit.PDFDocument,
    celda: Celda,
    { x, y, w, h }: { x: number; y: number; w: number; h: number },
  ): void {
    const linea = (
      grosor: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
    ) => {
      if (grosor <= 0) return;
      doc.lineWidth(grosor).moveTo(x1, y1).lineTo(x2, y2).stroke('#000000');
    };
    linea(celda.bordes.arriba, x, y, x + w, y);
    linea(celda.bordes.abajo, x, y + h, x + w, y + h);
    linea(celda.bordes.izquierda, x, y, x, y + h);
    linea(celda.bordes.derecha, x + w, y, x + w, y + h);
  }

  /** Pie de cada hoja: empresa a la izquierda y "Página X de N" a la derecha. */
  private numerarPaginas(
    doc: PDFKit.PDFDocument,
    pagina: { ancho: number; alto: number },
  ): void {
    const rango = doc.bufferedPageRange();
    const y = pagina.alto - MARGEN + 12;
    for (let i = 0; i < rango.count; i++) {
      doc.switchToPage(rango.start + i);
      doc.font('Helvetica').fontSize(7).fillColor('#444444');
      doc.text(NOMBRE_EMPRESA, MARGEN, y, { lineBreak: false });
      const numero = `Página ${i + 1} de ${rango.count}`;
      doc.text(numero, pagina.ancho - MARGEN - doc.widthOfString(numero), y, {
        lineBreak: false,
      });
    }
  }
}
