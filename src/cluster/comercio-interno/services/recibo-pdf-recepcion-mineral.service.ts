import { proveedorDeRecepcion } from 'src/cluster/comercio-interno/recepcion-proveedor.util';
import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import * as fs from 'fs';
import { RecepcionMineral } from '../entities/recepcion-mineral/recepcion-mineral.entity';
import { PersonaCi } from '../entities/persona-ci.entity';
import { Usuario } from 'src/security/entities/usuario.entity';

const LOGO_PATH = join(process.cwd(), 'uploads', 'logo.png');

const ETIQUETAS_COPIA: Array<'Original' | 'Copia 1' | 'Copia 2'> = [
  'Original',
  'Copia 1',
  'Copia 2',
];

const COLOR_BORDE_CAJA = '#FF914C';
const COLOR_LINEA = '#FF914C';

/**
 * Comprobante "RM-" de recepción de mineral: constancia de que el proveedor
 * dejó su carga. Se emite SIEMPRE, haya o no anticipo, y no lleva montos (el
 * dinero del anticipo va aparte, en el recibo de EGRESO serie C).
 *
 * No es un contabilidad.recibo: nace de la recepción y su número es el mismo
 * correlativo de esta (recepción ICC-0045 -> RM-0045). Mismo formato visual
 * que el recibo horizontal de contabilidad (ReciboPdfHorizontalService).
 */
@Injectable()
export class ReciboRecepcionMineralPdfService {
  /** Número del comprobante: "RM-" + correlativo de la recepción. */
  numeroComprobante(recepcion: RecepcionMineral): string {
    // Se toma del código de operación para respetar el mismo relleno de
    // ceros (CORRELATIVO_LONGITUD) con el que se generó.
    const correlativo =
      recepcion.codigoOperacion?.split('-').pop() ||
      String(recepcion.correlativo ?? '').padStart(4, '0');
    return `RM-${correlativo}`;
  }

  /**
   * Hoja CARTA HORIZONTAL con 3 copias del comprobante en columnas
   * (Original, Copia 1, Copia 2), separadas por línea punteada de corte.
   */
  async generar(
    recepcion: RecepcionMineral,
    usuarioActual: Usuario,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margen = 12;
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margin: margen,
        bufferPages: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (buffer) => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const anchoPagina = doc.page.width - margen * 2;
      const altoPagina = doc.page.height - margen * 2;
      const anchoCopia = anchoPagina / 3;

      const emitidoPor = this.nombreUsuario(usuarioActual);
      const fechaImpresion = this.formatearFechaHora(new Date());

      for (let i = 0; i < 3; i++) {
        const xLeft = margen + i * anchoCopia;
        this.dibujarCopia(
          doc,
          recepcion,
          ETIQUETAS_COPIA[i],
          xLeft,
          margen,
          anchoCopia,
          altoPagina,
          emitidoPor,
          fechaImpresion,
        );

        // Línea de corte vertical entre copias
        if (i < 2) {
          this.lineaCorteVertical(doc, xLeft + anchoCopia, margen, altoPagina);
        }
      }

      doc.end();
    });
  }

  // ------------------------------------------------------------------ copia
  private dibujarCopia(
    doc: any,
    recepcion: RecepcionMineral,
    etiqueta: string,
    x: number,
    yTop: number,
    ancho: number,
    alto: number,
    emitidoPor: string,
    fechaImpresion: string,
  ) {
    const pad = 12;
    const xi = x + pad;
    const anchoInterno = ancho - pad * 2;

    doc
      .rect(x, yTop, ancho, alto)
      .lineWidth(0.75)
      .strokeColor('#000000')
      .stroke();

    let y = yTop + pad + 20;

    // ---------------------------------------------------------- encabezado
    const logoAncho = 50;
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, xi, y + 4, { width: logoAncho });
    }

    const xDerecha = xi + logoAncho + 6;
    const anchoDerecha = anchoInterno - logoAncho - 6;

    // Ambos recuadros (título y NRO) comparten la misma fila: misma Y
    // de inicio y misma altura total.
    const filaAlto = 15;
    const cajaNroAncho = Math.min(96, anchoDerecha * 0.52);
    const cajaNroX = xi + anchoInterno - cajaNroAncho;
    const alturaFilaHeader = filaAlto * 2; // caja NRO tiene 2 filas apiladas
    const yHeader = y;

    // Caja NRO. (arriba a la derecha), 2 filas: "NRO." y el número
    doc
      .rect(cajaNroX, yHeader, cajaNroAncho, filaAlto)
      .lineWidth(0.75)
      .strokeColor(COLOR_BORDE_CAJA)
      .stroke();
    doc
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .fontSize(7)
      .text('NRO.', cajaNroX, yHeader + 3.5, {
        width: cajaNroAncho,
        align: 'center',
      });

    doc
      .rect(cajaNroX, yHeader + filaAlto, cajaNroAncho, filaAlto)
      .lineWidth(0.75)
      .strokeColor(COLOR_BORDE_CAJA)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(
        this.numeroComprobante(recepcion),
        cajaNroX + 3,
        yHeader + filaAlto + 3.5,
        {
          width: cajaNroAncho - 6,
          align: 'left',
        },
      );

    // Caja del título, misma Y y misma altura que la caja NRO
    const titulo = 'RECEPCIÓN DE MINERAL';
    const tituloAncho = cajaNroX - xDerecha;
    const tituloAlto = alturaFilaHeader;
    doc
      .rect(xDerecha, yHeader, tituloAncho, tituloAlto)
      .lineWidth(0.75)
      .strokeColor(COLOR_BORDE_CAJA)
      .stroke();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9);
    const altoTitulo = doc.heightOfString(titulo, {
      width: tituloAncho - 4,
      align: 'center',
      lineGap: -1,
    });
    doc.text(titulo, xDerecha + 2, yHeader + (tituloAlto - altoTitulo) / 2 + 1, {
      width: tituloAncho - 4,
      align: 'center',
      lineGap: -1,
    });

    // Quién emite y fecha de impresión, debajo de la fila de recuadros
    const yFechaImpresion = yHeader + alturaFilaHeader + 2;
    doc
      .font('Helvetica')
      .fontSize(5.5)
      .fillColor('#333333')
      .text(`Por: ${emitidoPor}`, xDerecha, yFechaImpresion, {
        width: cajaNroAncho,
        align: 'left',
      });
    doc.text(`F. imp: ${fechaImpresion}`, cajaNroX, yFechaImpresion, {
      width: cajaNroAncho,
      align: 'left',
    });
    doc.fillColor('#000000').strokeColor('#000000');

    const logoAlto = 36; // alto aproximado del logo a este ancho
    y = Math.max(y + logoAlto, yFechaImpresion + 8) + 4;

    // --------------------------- cuerpo ---------------------
    const anchoEtiqueta = 60;
    const proveedor = this.nombrePersona(proveedorDeRecepcion(recepcion));

    const campos: Array<[string, string]> = [
      ['Código:', recepcion.codigoOperacion ?? ''],
      ['Recibí de:', proveedor],
      ['C.I.:', recepcion.persona?.numeroDocumento ?? ''],
      ['Fecha y hora:', this.formatearFechaRecepcion(recepcion.fechaRecepcion)],
      ['N° Sacos:', `${recepcion.numeroSacos ?? 0}`],
      ['Balanza (Kg):', `${Math.round(Number(recepcion.balanzaL ?? 0))}`],
      [
        'Humedad (%):',
        recepcion.humedad ? String(recepcion.humedad).split('.')[0] : '0',
      ],
      ['Muestrero:', this.nombrePersona(recepcion.personalInterno)],
      ['Obs:', this.observaciones(recepcion)],
    ];

    for (const [etiquetaCampo, valor] of campos) {
      y = this.campo(
        doc,
        xi,
        y,
        anchoInterno,
        etiquetaCampo,
        valor,
        anchoEtiqueta,
        etiquetaCampo === 'Código:',
      );
    }

    // ---------------------------------------------------------- pie
    const yLineaFirma = yTop + alto - 112;
    const mitad = anchoInterno / 2;

    // Etiqueta de copia
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#000000')
      .text(etiqueta, xi, yLineaFirma - 40, { width: anchoInterno });

    // Líneas de firma: muestrero (quien recibe) y proveedor (quien entrega)
    doc.lineWidth(0.75).strokeColor('#000000');
    doc
      .moveTo(xi, yLineaFirma)
      .lineTo(xi + mitad - 8, yLineaFirma)
      .stroke();
    doc
      .moveTo(xi + mitad + 8, yLineaFirma)
      .lineTo(xi + anchoInterno, yLineaFirma)
      .stroke();
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('Muestrero', xi, yLineaFirma + 3, {
      width: mitad - 8,
      align: 'center',
    });
    doc.text('Firma Proveedor', xi + mitad + 8, yLineaFirma + 3, {
      width: mitad - 8,
      align: 'center',
    });

    // Datos del proveedor que firma
    const persona = recepcion.persona as any;
    doc.font('Helvetica-Bold').fontSize(7.5);
    doc.text('Nombre:', xi, yLineaFirma + 20, { width: 44 });
    doc.text('C.I.:', xi, yLineaFirma + 32, { width: 44 });
    doc.text('Cel.:', xi, yLineaFirma + 44, { width: 44 });

    doc.font('Helvetica').fontSize(7.5);
    doc.text(proveedor, xi + 44, yLineaFirma + 20, {
      width: anchoInterno - 44,
      height: 10,
      ellipsis: true,
    });
    doc.text(persona?.numeroDocumento ?? '', xi + 44, yLineaFirma + 32, {
      width: anchoInterno - 44,
    });
    doc.text(persona?.celular ?? '', xi + 44, yLineaFirma + 44, {
      width: anchoInterno - 44,
    });
  }

  // ------------------------------------------------------------------ helpers de dibujo
  /**
   * Etiqueta en negrita + valor sobre línea punteada (se ajusta solo si el
   * valor ocupa varias líneas). Devuelve la Y donde sigue el próximo campo.
   */
  private campo(
    doc: any,
    x: number,
    y: number,
    ancho: number,
    etiqueta: string,
    valor: string,
    anchoEtiqueta: number,
    valorEnNegrita = false,
  ): number {
    const texto = (valor ?? '').toString();
    const xValor = x + anchoEtiqueta;
    const anchoValor = ancho - anchoEtiqueta;

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#000000')
      .text(etiqueta, x, y, {
        width: anchoEtiqueta - 2,
      });

    doc
      .font(valorEnNegrita ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(8)
      .fillColor('#000000');
    const altura = Math.max(
      9,
      doc.heightOfString(texto || ' ', { width: anchoValor }),
    );
    if (texto) {
      doc.text(texto, xValor, y, { width: anchoValor });
    }

    this.lineaPuntos(doc, xValor, y + altura + 1, anchoValor);
    return y + altura + 8;
  }

  private lineaPuntos(doc: any, x: number, y: number, ancho: number) {
    doc
      .lineWidth(0.5)
      .dash(1, { space: 2 })
      .strokeColor(COLOR_LINEA)
      .moveTo(x, y)
      .lineTo(x + ancho, y)
      .stroke();
    doc.undash().strokeColor('#000000');
  }

  private lineaCorteVertical(doc: any, x: number, yTop: number, alto: number) {
    doc
      .lineWidth(0.75)
      .dash(3, { space: 3 })
      .strokeColor('#000000')
      .moveTo(x, yTop)
      .lineTo(x, yTop + alto)
      .stroke();
    doc.undash();
  }

  // ------------------------------------------------------------------ datos
  private nombrePersona(persona?: PersonaCi | null): string {
    return [persona?.nombres, persona?.apellidoPaterno, persona?.apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toUpperCase();
  }

  private nombreUsuario(usuario: Usuario): string {
    const persona = usuario?.persona;
    const nombre = [
      persona?.nombres,
      persona?.apellidoPaterno,
      persona?.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    return (nombre || usuario?.usuario || '').toUpperCase();
  }

  private observaciones(recepcion: RecepcionMineral): string {
    const observaciones = recepcion.observaciones?.trim();
    if (!observaciones || observaciones.toUpperCase() === 'SIN OBSERVACIONES') {
      return '';
    }
    return observaciones;
  }

  // fecha_de_entrega se guarda como texto ISO con zona horaria: se imprime la
  // hora local tal como se registró, sin convertir.
  private formatearFechaRecepcion(fecha: Date | string): string {
    if (!fecha) return '';
    const valor = fecha instanceof Date ? fecha.toISOString() : fecha;
    const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return valor;
    const [, anio, mes, dia, horas, minutos] = match;
    return `${dia}/${mes}/${anio} - ${horas}:${minutos}`;
  }

  private formatearFechaHora(fecha: Date): string {
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const aaaa = fecha.getFullYear();
    const hh = String(fecha.getHours()).padStart(2, '0');
    const mi = String(fecha.getMinutes()).padStart(2, '0');
    const ss = String(fecha.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${aaaa} ${hh}:${mi}:${ss}`;
  }
}
