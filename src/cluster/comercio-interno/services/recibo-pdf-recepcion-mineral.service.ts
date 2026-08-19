import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import * as fs from 'fs';
import { RecepcionMineral } from '../entities/recepcion-mineral/recepcion-mineral.entity';

const LOGO_PATH = join(process.cwd(), 'uploads', 'logo.png');

interface OpcionesLayout {
  x: number;
  ancho: number;
  logoAncho: number;
  logoCentrado: boolean;
}

@Injectable()
export class ReciboRecepcionMineralPdfService {
  //-------------------------------------------------
  // Impresión en ticket (rollo térmico 80mm)
  //-------------------------------------------------

  async generarPdftikeadora(recepcion: RecepcionMineral): Promise<Buffer> {
    const anchoPapel = 226.77; // 80mm

    const margen = 10;

    const opciones: OpcionesLayout = {
      x: margen,
      ancho: anchoPapel - margen * 2,
      logoAncho: 40,
      logoCentrado: true,
    };

    const alto = this.medirAltoContenido(
      recepcion,
      opciones,
      margen,
      anchoPapel,
    );

    return this.renderizar(recepcion, opciones, {
      size: [anchoPapel, alto],
      margin: margen,
    });
  }

  //-------------------------------------------------
  // Impresión en hoja carta horizontal
  //-------------------------------------------------

  async generarPdfhojaCarta(recepcion: RecepcionMineral): Promise<Buffer> {
    const anchoPaginaCarta = 792; // LETTER horizontal (11in x 8.5in)

    const anchoRecibo = 340;

    const margen = 20;

    const opciones: OpcionesLayout = {
      x: (anchoPaginaCarta - anchoRecibo) / 2 + margen,
      ancho: anchoRecibo - margen * 2,
      logoAncho: 32,
      logoCentrado: false,
    };

    return this.renderizar(recepcion, opciones, {
      size: 'LETTER',
      layout: 'landscape',
      margin: margen,
    });
  }

  //-------------------------------------------------
  // Generación del documento
  //-------------------------------------------------

  private renderizar(
    recepcion: RecepcionMineral,
    opciones: OpcionesLayout,
    configPagina: Record<string, any>,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        ...configPagina,
        bufferPages: true,
      });

      const buffers: Buffer[] = [];

      doc.on('data', (buffer) => buffers.push(buffer));

      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc.on('error', reject);

      this.dibujarCabecera(doc, recepcion, opciones);
      this.dibujarCuerpo(doc, recepcion, opciones);

      doc.end();
    });
  }

  /**
   * El rollo térmico no tiene un alto fijo: se dibuja el recibo en una
   * página de prueba muy alta para medir cuánto ocupa realmente y así
   * generar el ticket final sin espacio sobrante ni una segunda página.
   */
  private medirAltoContenido(
    recepcion: RecepcionMineral,
    opciones: OpcionesLayout,
    margen: number,
    anchoPapel: number,
  ): number {
    const docTemp = new PDFDocument({
      size: [anchoPapel, 3000],
      margin: margen,
      bufferPages: true,
    });

    docTemp.on('data', () => {});
    docTemp.on('error', () => {});

    this.dibujarCabecera(docTemp, recepcion, opciones);
    const yFinal = this.dibujarCuerpo(docTemp, recepcion, opciones);

    docTemp.end();

    // Margen de seguridad para evitar que un mínimo desfase entre la
    // medición y el render real (redondeos de fuente, etc.) empuje el
    // contenido a una segunda página.
    const margenSeguridad = 15;

    return Math.ceil(yFinal) + margen + margenSeguridad;
  }

  //-------------------------------------------------
  // Cabecera (logo, título, numeración)
  //-------------------------------------------------

  private dibujarCabecera(
    doc: any,
    recepcion: RecepcionMineral,
    opciones: OpcionesLayout,
  ) {
    const { x, ancho, logoAncho, logoCentrado } = opciones;

    doc.y = doc.page.margins.top;

    if (fs.existsSync(LOGO_PATH)) {
      const logoX = logoCentrado ? x + ancho / 2 - logoAncho / 2 : x;

      doc.image(LOGO_PATH, logoX, doc.y, {
        width: logoAncho,
      });

      doc.y += logoAncho + 6;
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('RECIBO DE RECEPCIÓN', x, doc.y, {
        width: ancho,
        align: 'center',
      });

    doc.font('Helvetica').fontSize(8).text('Recepción de Mineral', x, doc.y, {
      width: ancho,
      align: 'center',
    });

    doc.y += 3;

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(`Numeracion: ${recepcion.id}`, x, doc.y, {
        width: ancho,
        align: logoCentrado ? 'center' : 'right',
      });

    doc.y += 6;

    this.linea(doc, x, ancho, doc.y);

    doc.y += 8;
  }

  //-------------------------------------------------
  // Cuerpo (datos, observaciones y firmas)
  //-------------------------------------------------

  private dibujarCuerpo(
    doc: any,
    recepcion: RecepcionMineral,
    opciones: OpcionesLayout,
  ): number {
    const { x, ancho } = opciones;

    const col1 = Math.round(ancho * 0.45);

    const tableDatos = {
      headers: [
        {
          label: '',
          property: 'col1',
          width: col1,
          headerOpacity: '0.0',
        },
        {
          label: '',
          property: 'col2',
          width: ancho - col1,
          headerOpacity: '0.0',
        },
      ],
      datas: this.construirFilas(recepcion),
      options: {
        divider: {
          header: { disabled: true, width: 0.0, opacity: 0.0 },
          horizontal: { disabled: true, width: 0.0, opacity: 0.0 },
        },
      },
    };

    doc.x = x;
    doc.table(tableDatos, {
      columnSpacing: 2,
      prepareRow: () => {
        doc.font('Helvetica').fontSize(8);
        doc.x = x;
      },
    });

    doc.y += 6;

    this.linea(doc, x, ancho, doc.y);

    doc.y += 10;

    const observaciones = recepcion.observaciones?.trim();
    const mostrarObservaciones =
      !!observaciones && observaciones.toUpperCase() !== 'SIN OBSERVACIONES';

    if (mostrarObservaciones) {
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('Observaciones:', x, doc.y, { width: ancho });

      doc.font('Helvetica').fontSize(8).text(observaciones, x, doc.y, {
        width: ancho,
        align: 'justify',
      });
    }

    doc.y += 12;

    this.linea(doc, x, ancho, doc.y);

    doc.y += 26;

    const mitad = ancho / 2;

    doc.font('Helvetica').fontSize(8);

    const yLinea = doc.y;

    doc.text('_______________', x, yLinea, { width: mitad, align: 'center' });
    doc.text('_______________', x + mitad, yLinea, {
      width: mitad,
      align: 'center',
    });

    const yEtiqueta = yLinea + 12;

    doc.text('Muestrero', x, yEtiqueta, { width: mitad, align: 'center' });
    doc.text('Firma Cliente', x + mitad, yEtiqueta, {
      width: mitad,
      align: 'center',
    });

    doc.y = yEtiqueta + doc.currentLineHeight();

    return doc.y;
  }

  //-------------------------------------------------
  // Datos de la recepción
  //-------------------------------------------------

  private construirFilas(recepcion: RecepcionMineral): Record<string, any>[] {
    const filas: Record<string, any>[] = [
      {
        col1: 'bold:Código:',
        col2: recepcion.codigoOperacion,
      },
      {
        col1: 'bold:Fecha y Hora:',
        col2: this.formatearFechaHora(recepcion.fechaRecepcion),
      },
      {
        col1: 'bold:Proveedor:',
        col2: `${recepcion.persona?.nombres ?? ''} ${
          recepcion.persona?.apellidoPaterno ?? ''
        } ${recepcion.persona?.apellidoMaterno ?? ''}`,
      },
      {
        col1: 'bold:C.I.:',
        col2: recepcion.persona?.numeroDocumento ?? '--',
      },
      // {
      //   col1: 'bold:Celular:',
      //   col2: recepcion.persona?.celular ?? '--',
      // },
      {
        col1: 'bold:N° Sacos:',
        col2: `${recepcion.numeroSacos}`,
      },
      {
        col1: 'bold:Balanza (Kg):',
        col2: `${Math.round(recepcion.balanzaL)}`,
      },
      {
        col1: 'bold:Humedad (%):',
        col2: `${
          recepcion.humedad ? String(recepcion.humedad).split('.')[0] : '0'
        } `,
      },
      {
        col1: 'bold:Anticipo (Bs.):',
        col2:
          recepcion.anticipo !== null && recepcion.anticipo !== undefined
            ? `${Math.round(recepcion.anticipo)}`
            : '--',
      },
    ];

    // if (recepcion.humedad !== null && recepcion.humedad !== undefined) {
    //   filas.push({
    //     col1: 'bold:Humedad (%):',
    //     col2: `${Math.round(recepcion.humedad)}`,
    //   });
    // }

    filas.push({
      col1: 'bold:Muestrero:',
      col2: `${recepcion.personalInterno?.nombres ?? ''} ${
        recepcion.personalInterno?.apellidoPaterno ?? ''
      } ${recepcion.personalInterno?.apellidoMaterno ?? ''}`,
    });

    return filas;
  }

  private linea(doc: any, x: number, ancho: number, y: number) {
    doc
      .moveTo(x, y)
      .lineTo(x + ancho, y)
      .stroke();
  }

  private formatearFechaHora(fecha: Date | string): string {
    if (!fecha) {
      return '';
    }

    const valor = fecha instanceof Date ? fecha.toISOString() : fecha;

    const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

    if (!match) {
      return valor;
    }

    const [, anio, mes, dia, horas, minutos] = match;

    return `${dia}/${mes}/${anio} - ${horas}:${minutos}`;
  }
}
