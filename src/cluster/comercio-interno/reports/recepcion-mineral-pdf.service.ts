import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import * as fs from 'fs';
import { ComercioInternoService } from '../services/comercio-interno.service';
import { FiltrosRegistroMineralDto } from '../dto/recepcion-mineral/filtros-registro-mineral.dto';
import { RecepcionMineral } from '../entities/recepcion-mineral/recepcion-mineral.entity';

const LOGO_PATH = join(process.cwd(), 'uploads', 'logo.png');

@Injectable()
export class RecepcionMineralReportePdfService {
  constructor(
    private readonly comercioInternoService: ComercioInternoService,
  ) {}

  async generar(filtros: FiltrosRegistroMineralDto): Promise<Buffer> {
    const registros =
      await this.comercioInternoService.findAllRMReporte(filtros);

    // El listado sale ordenado por fecha (para el filtro/paginado normal);
    // acá se reordena por id para que el reporte impreso sea predecible.
    const registrosOrdenados = [...registros].sort((a, b) => {
      const idA = BigInt(a.id);
      const idB = BigInt(b.id);
      return idA < idB ? -1 : idA > idB ? 1 : 0;
    });

    const anchoPagina = 792; // LETTER horizontal (11in)
    const margen = 30;
    const ancho = anchoPagina - margen * 2;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margin: margen,
        bufferPages: true,
        autoFirstPage: false,
      });

      const buffers: Buffer[] = [];

      doc.on('data', (buffer) => buffers.push(buffer));

      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc.on('error', reject);

      let esPrimeraPagina = true;
      doc.on('pageAdded', () => {
        if (esPrimeraPagina) {
          this.dibujarCabecera(doc, margen, ancho, registrosOrdenados.length);
          esPrimeraPagina = false;
        }
      });

      doc.addPage();

      (async () => {
        await this.generateTableDataRecepcionMineral(
          doc,
          registrosOrdenados,
          ancho,
        );

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
  ) {
    doc.y = doc.page.margins.top;

    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, margen, doc.y, { width: 100 });
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('REPORTE DE RECEPCIÓN DE MINERAL', margen, doc.y + 4, {
        width: ancho,
        align: 'center',
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(`Registros: ${cantidadRegistros}`, margen, doc.y + 4, {
        width: ancho,
        align: 'right',
      });

    doc.y += 10;

    this.linea(doc, margen, ancho, doc.y);

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

    doc.y += 10;
  }

  generateTableDataRecepcionMineral(
    doc: any,
    dataRM: RecepcionMineral[],

    ancho: number,
  ): void {
    doc.opacity(1);
    const anchosFijos = {
      id: 28,
      codigo: 68,
      proveedor: 144,
      sacos: 55,
      pesoBruto: 75,
      anticipo: 60,
      fechaHora: 85,
      estado: 70,
    };

    const anchoObservacion =
      ancho - Object.values(anchosFijos).reduce((a, b) => a + b, 0);

    const tableRegistroCompra = {
      headers: [
        {
          label: '',
          property: 'col1',
          width: anchosFijos.id,
          valign: 'middle',
        },
        {
          label: '',
          property: 'col2',
          width: anchosFijos.codigo,
          valign: 'middle',
        },
        {
          label: '',
          property: 'col3',
          width: anchosFijos.proveedor,
          valign: 'middle',
        },
        {
          label: '',
          property: 'col4',
          width: anchosFijos.sacos,
          align: 'right',
          valign: 'middle',
        },
        {
          label: '',
          property: 'col5',
          width: anchosFijos.pesoBruto,
          align: 'right',
          valign: 'middle',
        },
        {
          label: '',
          property: 'col6',
          width: anchosFijos.anticipo,
          align: 'right',
          valign: 'middle',
        },
        {
          label: '',
          property: 'col7',
          width: anchosFijos.fechaHora,
          valign: 'middle',
        },
        {
          label: '',
          property: 'col8',
          width: anchoObservacion,
          valign: 'middle',
        },
        {
          label: '',
          property: 'col9',
          width: anchosFijos.estado,
          valign: 'middle',
        },
      ],
      datas: this.generarDataRecepcionMineral(dataRM),
      options: {
        divider: {
          horizontal: { opacity: 10 },
        },
      },
    };
    doc.table(tableRegistroCompra, {
      columnSpacing: 2,
      padding: 4,
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        doc.font('Helvetica').fontSize(7);
        if (indexRow === 0) {
          doc.fontSize(8).font('Helvetica-Bold');
          doc.addBackground(rectRow, 'grey', 0.02);
          // Linea superior
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
        // Para todas las filas excepto las dos últimas
        if (indexRow <= dataRM.length) {
          doc
            .lineWidth(0.5)
            .moveTo(x + width, y)
            .lineTo(x + width, y + height)
            .stroke();
        }
        // Para la penúltima fila
        else if (indexRow === dataRM.length + 1) {
          doc.fontSize(7).font('Helvetica-Bold');
          // Dibujar líneas en ciertas columnas de la penúltima fila
          if (
            indexColumn === 8 ||
            indexColumn === 5 ||
            indexColumn === 4 ||
            indexColumn === 3 ||
            indexColumn === 2
          ) {
            doc
              .lineWidth(0.5)
              .moveTo(x + width, y)
              .lineTo(x + width, y + height)
              .stroke();
          }
        }
      },
    });
  }

  generarDataRecepcionMineral(dataRM: RecepcionMineral[]): Array<any> {
    const dataOtros: Array<any> = [];
    dataOtros.push({
      col1: 'bold:Nro.',
      col2: 'bold:Código / Lote',
      col3: 'bold:Proveedor',
      col4: 'bold:N° Sacos',
      col5: 'bold:Peso Bruto (Kg)',
      col6: 'bold:Anticipo (Bs)',
      col7: 'bold:Fecha y Hora',
      col8: 'bold:Observación',
      col9: 'bold:Estado',
    });
    dataRM.map((registro, index) => {
      dataOtros.push({
        col1: index + 1,
        col2: registro.codigoOperacion,
        col3: this.nombreCompleto(registro.persona),
        col4: `${registro.numeroSacos ?? ''}`,
        col5: this.formatearNumero(registro.balanzaL),
        col6: this.formatearEntero(registro.anticipo),
        col7: this.formatearFechaHora(registro.fechaRecepcion),
        col8: registro.observaciones ?? '',
        col9: registro.estado?.nombre ?? '',
      });
    });

    //---------------------------totales----------------------------
    const totalSacos = dataRM.reduce(
      (acumulado, registro) => acumulado + Number(registro.numeroSacos ?? 0),
      0,
    );
    const totalPesoBruto = dataRM.reduce(
      (acumulado, registro) => acumulado + Number(registro.balanzaL ?? 0),
      0,
    );

    const totalAnticipo = dataRM.reduce(
      (acumulado, registro) => acumulado + Number(registro.anticipo ?? 0),
      0,
    );

    // fila totales.
    dataOtros.push({
      col1: {
        label: '',
        options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
      },
      col2: {
        label: '',
        options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
      },
      col3: {
        label: `bold:TOTAL`,
        options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
      },
      col4: `bold:${totalSacos}`,
      col5: {
        label: `bold:${this.formatearNumero(totalPesoBruto)}`,
      },

      col6: `bold:${this.formatearEntero(totalAnticipo)}`,
      col7: {
        label: '',
        options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
      },
      col8: {
        label: '',
        options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
      },
      col9: {
        label: '',
        options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
      },
      col10: {
        label: '',
        options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
      },
    });
    return dataOtros;
  }

  //-------------------------------------------------
  // Numeración de páginas ("Página X de Y"), una vez que ya se dibujó todo
  // el contenido y se conoce el total real de páginas. bufferPages:true
  // las mantiene todas en memoria, así se puede volver a cada una.
  //-------------------------------------------------

  private dibujarNumeracionPaginas(doc: any, margen: number, ancho: number) {
    const rango = doc.bufferedPageRange();

    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);

      // Igual que en dibujarTabla: sin anular el margen inferior, escribir
      // tan cerca del borde hace que PDFKit crea que "no cabe" y agregue
      // una hoja nueva en vez de estampar sobre la hoja actual.
      const margenInferiorOriginal = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      doc
        .font('Helvetica')
        .fontSize(7)
        .text(
          `Página ${i + 1} de ${rango.count}`,
          margen,
          doc.page.height - 20,
          { width: ancho, align: 'center', lineBreak: false },
        );

      doc.page.margins.bottom = margenInferiorOriginal;
    }
  }

  //-------------------------------------------------
  // Pie: fecha y hora de generación, al final del documento
  //-------------------------------------------------

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

  //-------------------------------------------------
  // Auxiliares
  //-------------------------------------------------

  private linea(doc: any, x: number, ancho: number, y: number) {
    doc
      .moveTo(x, y)
      .lineTo(x + ancho, y)
      .stroke();
  }

  private nombreCompleto(persona?: {
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  }): string {
    if (!persona) {
      return '--';
    }

    return `${persona.nombres ?? ''} ${persona.apellidoPaterno ?? ''} ${
      persona.apellidoMaterno ?? ''
    }`.trim();
  }

  private formatearNumero(valor?: number | string): string {
    if (valor === null || valor === undefined || valor === ('' as any)) {
      return '--';
    }

    return Number(valor).toLocaleString('es-BO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  private formatearEntero(valor?: number | string): string {
    if (valor === null || valor === undefined || valor === ('' as any)) {
      return '--';
    }

    return `${Math.round(Number(valor))}`;
  }

  private formatearFechaHora(fecha?: string): string {
    if (!fecha) {
      return '';
    }

    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

    if (!match) {
      return fecha;
    }

    const [, anio, mes, dia, horas, minutos] = match;

    return `${horas}:${minutos} - ${dia}-${mes}-${anio}`;
  }
}
