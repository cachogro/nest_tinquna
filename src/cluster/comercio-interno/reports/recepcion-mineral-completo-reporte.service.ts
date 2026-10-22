import { proveedorDeRecepcion } from 'src/cluster/comercio-interno/recepcion-proveedor.util';
import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import * as fs from 'fs';
import { ExcelService } from 'src/common/excel/excel.service';
import { ComercioInternoService } from '../services/comercio-interno.service';
import { FiltrosRegistroMineralDto } from '../dto/recepcion-mineral/filtros-registro-mineral.dto';
import { RecepcionMineral } from '../entities/recepcion-mineral/recepcion-mineral.entity';
import { Usuario } from 'src/security/entities/usuario.entity';

const LOGO_PATH = join(process.cwd(), 'uploads', 'logo.png');
const TITULO = 'REPORTE COMPLETO DE RECEPCIÓN DE MINERAL';

/**
 * Reporte completo de recepción de mineral (Excel y PDF): todos los datos
 * que se registran en la recepción, menos la balanza T. Usa los mismos
 * filtros y orden que el reporte normal (recepcion_mineral/excel y
 * reporte_pdf).
 */
@Injectable()
export class RecepcionMineralCompletoReporteService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly comercioInternoService: ComercioInternoService,
  ) {}

  //-------------------------------------------------
  // Excel: pensado para imprimir en carta horizontal. Algunos datos van
  // juntos en la misma celda, en dos líneas (proveedor + documento,
  // usuario + fecha de registro), para que todas las columnas entren en el
  // ancho de la hoja con letra legible.
  //-------------------------------------------------

  async generarExcel(
    filtros: FiltrosRegistroMineralDto,
    generadoPor: string,
  ): Promise<Buffer> {
    const registros =
      await this.comercioInternoService.findAllRMReporteCompleto(filtros);

    // [título, ancho, alineación]
    const columnas: [string, number, ('right' | 'center')?][] = [
      ['N°', 5, 'center'],
      ['Código / Lote', 9],
      ['Fecha y Hora', 13],
      ['Proveedor / Documento', 18],
      ['Actor Productivo', 12],
      ['N° Sacos', 6, 'right'],
      ['Peso Bruto (Kg)', 9, 'right'],
      ['Humedad (%)', 7, 'right'],
      ['Anticipo (Bs)', 9, 'right'],
      ['Recibo Anticipo', 10],
      ['Muestrero', 12],
      ['Lugar de Acopio', 9],
      ['Laboratorio', 9],
      ['Observaciones', 16],
      ['Estado', 10],
      ['Usuario / Fecha Registro', 12],
    ];
    const alineaciones = columnas.map((c) => c[2]);

    const workbook: Workbook = this.excelService.createWorkbook();
    const worksheet = this.excelService.createWorksheet(
      workbook,
      'Recepción Completa',
    );

    this.excelService.addTitle(worksheet, TITULO, columnas.length);

    const filaInicio = this.excelService.addInformation(worksheet, {
      'Fecha de generación': new Date().toLocaleString('es-BO'),
      'Generado por': generadoPor,
      'Cantidad de registros': registros.length,
    });

    this.excelService.addHeader(
      worksheet,
      columnas.map((c) => c[0]),
      filaInicio,
    );

    registros.forEach((r) => {
      const documento = r.persona?.numeroDocumento;
      this.excelService.addRow(
        worksheet,
        [
          r.id,
          r.codigoOperacion,
          this.formatFechaHora(r.fechaRecepcion),
          `${this.nombreProveedor(r) || '--'}\n${
            documento ? `CI ${documento}` : this.tipoProveedor(r)
          }`,
          this.actorProductivo(r),
          r.numeroSacos,
          this.numero(r.balanzaL),
          this.numero(r.humedad),
          this.numero(r.anticipo),
          this.reciboAnticipo(r),
          this.nombrePersona(r.personalInterno),
          r.lugarAcopio ?? '',
          r.laboratorio?.nombre ?? '',
          r.observaciones ?? '',
          r.estado?.nombre ?? '',
          `${r.usuarioRegistro ?? ''}\n${this.formatFechaAuditoria(r.fechaRegistro)}`,
        ],
        alineaciones,
      );
    });

    // Fila de totales
    const totales = this.totales(registros);
    const valoresTotal: any[] = columnas.map(() => '');
    valoresTotal[3] = 'TOTAL';
    valoresTotal[5] = totales.sacos;
    valoresTotal[6] = totales.pesoBruto;
    valoresTotal[8] = totales.anticipo;
    this.excelService.addRow(worksheet, valoresTotal, alineaciones);
    worksheet.lastRow?.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' },
      };
    });

    columnas.forEach(([, ancho], i) => (worksheet.getColumn(i + 1).width = ancho));
    worksheet.getColumn(6).numFmt = '#,##0';
    [7, 8, 9].forEach((col) => (worksheet.getColumn(col).numFmt = '#,##0.00'));

    // Letra de 8 en la tabla; el encabezado en dos líneas.
    worksheet.eachRow((row, numero) => {
      if (numero < filaInicio) return;
      row.eachCell((cell) => {
        cell.font = { ...cell.font, size: 8 };
      });
    });
    worksheet.getRow(filaInicio).height = 30;

    this.excelService.configurarImpresionCartaHorizontal(
      worksheet,
      filaInicio,
    );

    return this.excelService.generate(workbook);
  }

  //-------------------------------------------------
  // PDF: oficio horizontal; algunos datos se agrupan en la misma celda
  // (proveedor + documento, usuario + fecha de registro)
  // para que entren todas las columnas.
  //-------------------------------------------------

  async generarPdf(
    filtros: FiltrosRegistroMineralDto,
    generadoPor: string,
  ): Promise<Buffer> {
    const registros =
      await this.comercioInternoService.findAllRMReporteCompleto(filtros);

    const anchoPagina = 1008; // LEGAL horizontal (14in)
    const margen = 24;
    const ancho = anchoPagina - margen * 2;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LEGAL',
        layout: 'landscape',
        margin: margen,
        bufferPages: true,
        autoFirstPage: false,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (buffer) => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      let esPrimeraPagina = true;
      doc.on('pageAdded', () => {
        if (esPrimeraPagina) {
          this.dibujarCabecera(
            doc,
            margen,
            ancho,
            registros.length,
            generadoPor,
          );
          esPrimeraPagina = false;
        }
      });

      doc.addPage();

      (async () => {
        await this.dibujarTabla(doc, registros, ancho);
        this.dibujarPie(doc, margen, ancho);
        this.dibujarNumeracionPaginas(doc, margen, ancho);
        doc.end();
      })().catch(reject);
    });
  }

  private dibujarCabecera(
    doc: any,
    margen: number,
    ancho: number,
    cantidadRegistros: number,
    generadoPor: string,
  ) {
    doc.y = doc.page.margins.top;

    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, margen, doc.y, { width: 100 });
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(TITULO, margen, doc.y + 4, { width: ancho, align: 'center' });

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(`Registros: ${cantidadRegistros}`, margen, doc.y + 4, {
        width: ancho,
        align: 'right',
      });

    doc.y += 10;
    doc
      .moveTo(margen, doc.y)
      .lineTo(margen + ancho, doc.y)
      .stroke();
    doc.y += 6;

    doc
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Fecha de generación: ${new Date().toLocaleString('es-BO')}`,
        margen,
        doc.y,
        { width: ancho, align: 'left' },
      );
    doc.text(`Generado por: ${generadoPor}`, margen, doc.y + 2, {
      width: ancho,
      align: 'left',
    });

    doc.y += 10;
  }

  private async dibujarTabla(
    doc: any,
    registros: RecepcionMineral[],
    ancho: number,
  ): Promise<void> {
    // [propiedad, título, ancho, alineación]; observaciones toma el resto.
    const columnas: [string, string, number, string?][] = [
      ['n', 'N°', 26],
      ['codigo', 'Código / Lote', 48],
      ['fecha', 'Fecha y Hora', 66],
      ['proveedor', 'Proveedor / Documento', 115],
      ['actor', 'Actor Productivo', 75],
      ['sacos', 'N° Sacos', 32, 'right'],
      ['peso', 'Peso Bruto (Kg)', 50, 'right'],
      ['humedad', 'Humedad (%)', 40, 'right'],
      ['anticipo', 'Anticipo (Bs)', 48, 'right'],
      ['recibo', 'Recibo Anticipo', 50],
      ['muestrero', 'Muestrero', 75],
      ['lugar', 'Lugar de Acopio', 52],
      ['laboratorio', 'Laboratorio', 55],
      ['observaciones', 'Observaciones', 0],
      ['estado', 'Estado', 52],
      ['registro', 'Usuario / Fecha Registro', 70],
    ];
    const anchoFijo = columnas.reduce((a, c) => a + c[2], 0);
    const espaciado = 2 * columnas.length;
    columnas.find((c) => c[0] === 'observaciones')![2] =
      ancho - anchoFijo - espaciado;

    const encabezado: Record<string, string> = {};
    columnas.forEach(([prop, titulo]) => (encabezado[prop] = `bold:${titulo}`));

    const filas: Record<string, any>[] = [encabezado];
    registros.forEach((r) => {
      const documento = r.persona?.numeroDocumento;
      filas.push({
        n: r.id,
        codigo: r.codigoOperacion,
        fecha: this.formatFechaHora(r.fechaRecepcion),
        proveedor: `${this.nombreProveedor(r) || '--'}\n${
          documento ? `CI ${documento}` : this.tipoProveedor(r)
        }`,
        actor: this.actorProductivo(r),
        sacos: `${r.numeroSacos ?? ''}`,
        peso: this.formatNumero(r.balanzaL),
        humedad: this.formatNumero(r.humedad),
        anticipo: this.formatNumero(r.anticipo),
        recibo: this.reciboAnticipo(r),
        muestrero: this.nombrePersona(r.personalInterno),
        lugar: r.lugarAcopio ?? '',
        laboratorio: r.laboratorio?.nombre ?? '',
        observaciones: r.observaciones ?? '',
        estado: r.estado?.nombre ?? '',
        registro: `${r.usuarioRegistro ?? ''}\n${this.formatFechaAuditoria(r.fechaRegistro)}`,
      });
    });

    const totales = this.totales(registros);
    const fondoGris = { backgroundColor: 'grey', backgroundOpacity: 0.3 };
    const filaTotal: Record<string, any> = {};
    columnas.forEach(([prop]) => (filaTotal[prop] = { label: '', options: fondoGris }));
    filaTotal.proveedor = { label: 'bold:TOTAL', options: fondoGris };
    filaTotal.sacos = `bold:${totales.sacos}`;
    filaTotal.peso = `bold:${this.formatNumero(totales.pesoBruto)}`;
    filaTotal.anticipo = `bold:${this.formatNumero(totales.anticipo)}`;
    filas.push(filaTotal);

    await doc.table(
      {
        headers: columnas.map(([property, , width, align]) => ({
          label: '',
          property,
          width,
          align: align ?? 'left',
          valign: 'middle',
        })),
        datas: filas,
        options: { divider: { horizontal: { opacity: 10 } } },
      },
      {
        columnSpacing: 2,
        padding: 3,
        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
          doc.font('Helvetica').fontSize(6.5);
          if (indexRow === 0) {
            doc.fontSize(7).font('Helvetica-Bold');
            doc.addBackground(rectRow, 'grey', 0.02);
            doc
              .lineWidth(0.5)
              .moveTo(rectRow.x, rectRow.y)
              .lineTo(rectRow.x + rectRow.width, rectRow.y)
              .stroke();
          }
          const { x, y, width, height } = rectCell;
          if (indexColumn === 0) {
            doc
              .lineWidth(0.5)
              .moveTo(x, y)
              .lineTo(x, y + height)
              .stroke();
          }
          doc
            .lineWidth(0.5)
            .moveTo(x + width, y)
            .lineTo(x + width, y + height)
            .stroke();
        },
      },
    );
  }

  private dibujarPie(doc: any, margen: number, ancho: number) {
    doc.y += 8;
    doc
      .font('Helvetica-Oblique')
      .fontSize(7)
      .text(
        `Archivo generado el ${new Date().toLocaleString('es-BO')}`,
        margen,
        doc.y,
        { width: ancho, align: 'right' },
      );
  }

  // "Página X de Y" una vez dibujado todo (bufferPages mantiene las hojas).
  private dibujarNumeracionPaginas(doc: any, margen: number, ancho: number) {
    const rango = doc.bufferedPageRange();

    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);

      // Sin anular el margen inferior, PDFKit agrega una hoja nueva en vez
      // de escribir tan cerca del borde.
      const margenInferiorOriginal = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      doc
        .font('Helvetica')
        .fontSize(7)
        .text(
          `Página ${i + 1} de ${rango.count}`,
          margen,
          doc.page.height - 18,
          { width: ancho, align: 'center', lineBreak: false },
        );

      doc.page.margins.bottom = margenInferiorOriginal;
    }
  }

  //-------------------------------------------------
  // Datos de cada recepción
  //-------------------------------------------------

  /** Quién generó el archivo: nombre completo y login. */
  nombreGenerador(user: Usuario): string {
    const nombre = this.nombrePersona(user.persona);
    return nombre ? `${nombre} (${user.usuario})` : user.usuario;
  }

  private tipoProveedor(r: RecepcionMineral): string {
    if (r.idPersona) return 'Persona';
    if (r.idActorProductivoMinero) return 'Actor productivo';
    return 'Externo';
  }

  private nombreProveedor(r: RecepcionMineral): string {
    if (!r.persona && r.actorProductivoMinero && !r.nombresApellidos) {
      return r.actorProductivoMinero.nombre ?? '';
    }
    return this.nombrePersona(proveedorDeRecepcion(r));
  }

  /** Actor productivo de la persona, o el propio actor cuando es él quien
   *  deja el mineral. */
  private actorProductivo(r: RecepcionMineral): string {
    return (
      r.persona?.actorProductivoMinero?.nombre ||
      r.actorProductivoMinero?.nombre ||
      ''
    );
  }

  /** Recibo vigente del anticipo (la consulta ya excluye los ANULADOS). */
  private reciboAnticipo(r: RecepcionMineral): string {
    const recibo = r.recibos?.[0];
    if (!recibo) return '';
    return `${recibo.serie}-${recibo.numero} (${recibo.estado})`;
  }

  private nombrePersona(persona?: {
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  } | null): string {
    if (!persona) return '';
    return [persona.nombres, persona.apellidoPaterno, persona.apellidoMaterno]
      .filter(Boolean)
      .join(' ');
  }

  private totales(registros: RecepcionMineral[]) {
    return registros.reduce(
      (t, r) => ({
        sacos: t.sacos + Number(r.numeroSacos ?? 0),
        pesoBruto: t.pesoBruto + Number(r.balanzaL ?? 0),
        anticipo: t.anticipo + Number(r.anticipo ?? 0),
      }),
      { sacos: 0, pesoBruto: 0, anticipo: 0 },
    );
  }

  //-------------------------------------------------
  // Formatos
  //-------------------------------------------------

  private numero(valor?: number | string | null): number | null {
    if (valor === null || valor === undefined || valor === ('' as any)) {
      return null;
    }
    return Number(valor);
  }

  private formatNumero(valor?: number | string | null): string {
    const n = this.numero(valor);
    if (n === null) return '--';
    return n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /** fechaRecepcion se guarda como texto ISO con offset de Bolivia. */
  private formatFechaHora(fecha?: string): string {
    if (!fecha) return '';
    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return fecha;
    const [, anio, mes, dia, horas, minutos] = match;
    return `${horas}:${minutos} - ${dia}-${mes}-${anio}`;
  }

  /** Fechas de auditoría (timestamp) en hora de Bolivia. */
  private formatFechaAuditoria(fecha?: Date | string | null): string {
    if (!fecha) return '';
    const partes = new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(fecha));
    const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? '';
    return `${p('hour')}:${p('minute')} - ${p('day')}-${p('month')}-${p('year')}`;
  }
}
