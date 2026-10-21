import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import * as fs from 'fs';
import { datosEmpresa, nitBajoLogo, ubicacionEmpresa } from 'src/common/datos-empresa';
import { Memorandum } from '../entities/memorandum.entity';
import { MemorandumService } from './memorandum.service';

const LOGO_PATH = join(process.cwd(), 'uploads', 'logo.png');

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const TEXTO_CIERRE =
  'Este proceder suyo indica falta de cumplimiento en sus obligaciones asumidas en virtud de la relación de trabajo que mantiene con nosotros. En ese sentido invocamos a que rectifique su conducta y muestre la capacidad para desarrollar las actividades de la empresa y evite que tomemos medidas más drásticas.';

const TEXTO_DESCUENTO = 'El importe de la sanción será descontado de su haber mensual.';

/**
 * PDF del memorándum, hoja carta, una página. Formato de memorándum
 * institucional: título "MEMORÁNDUM" con el asunto debajo; destinatario a la
 * izquierda y CITE + lugar y fecha a la derecha, separados por una línea
 * vertical y cerrados con doble línea; cuerpo, tabla N° / OBSERVACIÓN /
 * SANCIÓN / IMPORTE DESCONTADO, texto de cierre y firmas de quien emite y
 * de quien recibe.
 */
@Injectable()
export class MemorandumPdfService {
  async generar(memo: Memorandum): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margen = 60;
      const doc = new PDFDocument({ size: 'LETTER', margin: margen, bufferPages: true });

      const buffers: Buffer[] = [];
      doc.on('data', (b) => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const x = margen;
      const ancho = doc.page.width - margen * 2;
      let y = 40;

      // --- Encabezado: logo + datos de la empresa ---
      if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, x, y, { width: 80 });
      }
      nitBajoLogo(doc, x, y + 28);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(datosEmpresa().razonSocial, x + 100, y, { width: ancho - 100, align: 'right' });
      const ubicacion = ubicacionEmpresa();
      if (ubicacion) {
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#333333')
          .text(ubicacion, x + 100, doc.y + 2, { width: ancho - 100, align: 'right' })
          .fillColor('#000000');
      }
      y = 95;

      // --- Título ---
      doc.font('Helvetica-Bold').fontSize(30);
      const titulo = 'MEMORÁNDUM';
      const espaciado = 5;
      const anchoTitulo = doc.widthOfString(titulo, { characterSpacing: espaciado }) - espaciado;
      const xTitulo = x + (ancho - anchoTitulo) / 2;
      doc.text(titulo, xTitulo, y, { characterSpacing: espaciado, lineBreak: false });
      doc
        .lineWidth(2)
        .moveTo(xTitulo, y + 31)
        .lineTo(xTitulo + anchoTitulo, y + 31)
        .stroke();
      y += 37;
      doc.font('Helvetica-Bold').fontSize(11).text(memo.asunto, x, y, { width: ancho, align: 'center' });
      y += 18;

      // --- Destinatario | CITE, lugar y fecha ---
      const xDivision = x + ancho * 0.52;
      const yBloque = y;
      const anchoIzq = xDivision - x - 12;
      const anchoDer = x + ancho - xDivision - 12;

      doc.font('Helvetica-Bold').fontSize(11);
      doc.text(memo.cite, xDivision + 12, yBloque + 14, { width: anchoDer });

      let yi = yBloque + 36;
      doc.text('Señor(a):', x + 8, yi, { width: anchoIzq });
      yi = doc.y + 6;
      doc.text(this.destinatario(memo), x + 8, yi, { width: anchoIzq });
      yi = doc.y;
      if (memo.cargo) {
        doc.font('Helvetica').fontSize(10).text(memo.cargo, x + 8, yi + 1, { width: anchoIzq });
        yi = doc.y;
      }
      doc.font('Helvetica-Bold').fontSize(11).text('Presente. -', x + 8, yi + 10, { width: anchoIzq });
      const yFinIzq = doc.y;

      doc.text(this.lugarFecha(memo), xDivision + 12, yFinIzq - 13, { width: anchoDer });

      const yDoble = Math.max(yFinIzq, doc.y) + 6;
      doc
        .lineWidth(1.2)
        .moveTo(xDivision, yBloque)
        .lineTo(xDivision, yDoble + 3)
        .stroke();
      doc.lineWidth(1.5).moveTo(x, yDoble).lineTo(x + ancho, yDoble).stroke();
      doc.lineWidth(0.8).moveTo(x, yDoble + 3).lineTo(x + ancho, yDoble + 3).stroke();
      y = yDoble + 24;

      // --- Cuerpo ---
      doc.font('Helvetica').fontSize(11).text('Señor (a):', x, y);
      y = doc.y + 12;
      doc
        .font('Helvetica')
        .text('Mediante el presente nos vemos en la necesidad de hacer llegar a usted una ', x, y, {
          width: ancho,
          align: 'left',
          continued: true,
        })
        .font('Helvetica-Bold')
        .text(`${MemorandumService.ordinal(memo.numeroLlamada)} ${memo.asunto}`, { continued: true })
        .font('Helvetica')
        .text(', de acuerdo con el siguiente detalle:');
      y = doc.y + 14;

      y = this.tabla(doc, memo, x, y, ancho);

      doc.font('Helvetica').fontSize(11);
      if (Number(memo.importeSancion) > 0) {
        doc.text(TEXTO_DESCUENTO, x, y, { width: ancho, align: 'justify' });
        y = doc.y + 10;
      }
      doc.text(TEXTO_CIERRE, x, y, { width: ancho, align: 'justify' });
      y = doc.y + 18;
      doc.text('Atentamente.', x, y);

      // --- Firmas ---
      const yFirma = Math.max(doc.y + 85, 600);
      const anchoFirma = ancho / 2 - 30;
      const emisor = memo.emisor;
      this.firma(
        doc,
        x,
        yFirma,
        anchoFirma,
        [emisor.tratamiento, emisor.nombre].filter(Boolean).join(' '),
        emisor.cargo,
        emisor.ci,
        null,
      );
      this.firma(
        doc,
        x + ancho - anchoFirma,
        yFirma,
        anchoFirma,
        this.destinatario(memo),
        memo.cargo ?? null,
        memo.persona?.numeroDocumento ?? null,
        'RECIBÍ CONFORME',
      );

      // --- Pie ---
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#333333')
        .text('c.c.: File personal / Archivo', x, doc.page.height - margen - 10, { lineBreak: false })
        .fillColor('#000000');

      if (memo.estado === 'ANULADO') this.selloAnulado(doc);

      doc.end();
    });
  }

  // ------------------------------------------------------------------ tabla
  private tabla(doc: any, memo: Memorandum, x: number, y: number, ancho: number): number {
    const conSancion = memo.tipoSancion !== 'NINGUNA';
    const proporciones = conSancion ? [0.08, 0.47, 0.2, 0.25] : [0.08, 0.92];
    const titulos = conSancion
      ? ['N.º', 'OBSERVACIÓN', 'SANCIÓN', 'IMPORTE DESCONTADO']
      : ['N.º', 'OBSERVACIÓN'];
    const valores = [
      '1',
      this.capitalizar(memo.motivo),
      ...(conSancion
        ? [MemorandumService.textoSancion(memo), `Bs ${this.formatearMonto(memo.importeSancion)}.-`]
        : []),
    ];
    const anchos = proporciones.map((p) => p * ancho);
    const pad = 6;

    const altoFila = (textos: string[], fuente: string) => {
      doc.font(fuente).fontSize(10);
      return Math.max(...textos.map((t, i) => doc.heightOfString(t, { width: anchos[i] - pad * 2 }))) + pad * 2;
    };

    const dibujarFila = (textos: string[], fuente: string, yFila: number, alineaciones: string[]) => {
      const alto = altoFila(textos, fuente);
      let xc = x;
      textos.forEach((t, i) => {
        doc.lineWidth(0.8).rect(xc, yFila, anchos[i], alto).stroke();
        doc.font(fuente).fontSize(10).text(t, xc + pad, yFila + pad, {
          width: anchos[i] - pad * 2,
          align: alineaciones[i],
        });
        xc += anchos[i];
      });
      return yFila + alto;
    };

    y = dibujarFila(titulos, 'Helvetica-Bold', y, titulos.map(() => 'center'));
    y = dibujarFila(valores, 'Helvetica', y, ['center', 'left', 'center', 'center']);
    return y + 18;
  }

  // ------------------------------------------------------------------ firmas
  private firma(
    doc: any,
    x: number,
    y: number,
    ancho: number,
    nombre: string,
    cargo: string | null,
    ci: string | null,
    leyenda: string | null,
  ) {
    doc.lineWidth(0.8).moveTo(x, y).lineTo(x + ancho, y).stroke();
    doc.font('Helvetica-Bold').fontSize(9).text(nombre, x, y + 4, { width: ancho, align: 'center' });
    doc.font('Helvetica').fontSize(9);
    if (cargo) doc.text(cargo, x, doc.y + 1, { width: ancho, align: 'center' });
    doc.text(`C.I.: ${ci ?? ''}`, x, doc.y + 1, { width: ancho, align: 'center' });
    if (leyenda) {
      doc.font('Helvetica-Bold').fontSize(8).text(leyenda, x, doc.y + 3, { width: ancho, align: 'center' });
      doc.font('Helvetica').fontSize(8).text('Fecha: ____/____/________', x, doc.y + 2, {
        width: ancho,
        align: 'center',
      });
    }
  }

  private selloAnulado(doc: any) {
    const cx = doc.page.width / 2;
    const cy = doc.page.height / 2;
    doc.save();
    doc.rotate(-35, { origin: [cx, cy] });
    doc
      .font('Helvetica-Bold')
      .fontSize(90)
      .fillColor('#CC0000')
      .fillOpacity(0.18)
      .text('ANULADO', cx - 260, cy - 45, { width: 520, align: 'center', lineBreak: false });
    doc.restore();
    doc.fillOpacity(1).fillColor('#000000');
  }

  // ------------------------------------------------------------------ formato
  private destinatario(memo: Memorandum): string {
    const p = memo.persona;
    const nombre = [p?.nombres, p?.apellidoPaterno, p?.apellidoMaterno]
      .map((s) => (s ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .toUpperCase();
    return [memo.tratamiento, nombre].filter(Boolean).join(' ');
  }

  /** "Potosí, 01 de octubre de 2026". */
  private lugarFecha(memo: Memorandum): string {
    const [anio, mes, dia] = memo.fecha.slice(0, 10).split('-');
    // La ciudad del empleador se guarda en mayúsculas: "LA PAZ" → "La Paz".
    const lugar = memo.lugar.toLowerCase().replace(/(^|\s)\p{L}/gu, (l) => l.toUpperCase());
    return `${lugar}, ${dia} de ${MESES[Number(mes) - 1]} de ${anio}`;
  }

  private capitalizar(t: string): string {
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  private formatearMonto(monto: number | string): string {
    return new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(monto ?? 0));
  }
}
