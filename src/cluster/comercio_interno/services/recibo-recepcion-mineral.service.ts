import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { join } from 'path';
import * as fs from 'fs';
import { RecepcionMineral } from '../entities/recepcion_mineral/recepcion-mineral.entity';



@Injectable()
export class ReciboRecepcionMineralService {
  async generarPdf(
    recepcion: RecepcionMineral,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A5',
        layout: 'portrait',
        margin: 40,
      });

      const buffers: Buffer[] = [];

      doc.on('data', (buffer) => buffers.push(buffer));

      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc.on('error', reject);

      this.dibujarDocumento(doc, recepcion);

      doc.end();
    });
  }

  private dibujarDocumento(
    doc: PDFKit.PDFDocument,
    recepcion: RecepcionMineral,
  ) {
    const logo = join(process.cwd(), 'uploads', 'logo.png');

    if (fs.existsSync(logo)) {
      doc.image(logo, 40, 25, {
        width: 70,
      });
    }

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('RECIBO DE RECEPCIÓN', 0, 35, {
        align: 'center',
      });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Recepción de Mineral', {
        align: 'center',
      });

    let y = 95;

    this.linea(doc, y);

    y += 15;

    this.textoIzquierdaDerecha(
      doc,
      'Lote:',
      recepcion.codigoOperacion,
      'Fecha:',
      this.formatearFecha(recepcion.fechaRecepcion),
      y,
    );

    y += 25;

    this.linea(doc, y);

    y += 15;

    doc.font('Helvetica-Bold');
    doc.text('Nombre:', 40, y);

    doc.font('Helvetica');

    doc.text(
      `${recepcion.persona.nombres} ${recepcion.persona.apellidoPaterno} ${recepcion.persona.apellidoMaterno}`,
      95,
      y,
    );

    y += 22;

    doc.font('Helvetica-Bold');
    doc.text('C.I.:', 40, y);

    doc.font('Helvetica');
    doc.text(recepcion.persona.numeroDocumento, 95, y);

    doc.font('Helvetica-Bold');
    doc.text('Cel.:', 250, y);

    doc.font('Helvetica');
    doc.text(recepcion.persona.celular ?? '', 285, y);

    y += 25;

    this.linea(doc, y);

    y += 15;

    doc.font('Helvetica-Bold');
    doc.text('Peso:', 40, y);

    doc.font('Helvetica');
    doc.text(`${recepcion.balanzaL} Kg`, 95, y);

    y += 30;

    this.dibujarMinerales(doc, recepcion, y);

    y += 35;

    this.linea(doc, y);

    y += 15;

    this.textoIzquierdaDerecha(
      doc,
      'N° Sacos:',
      String(recepcion.numeroSacos),
      'Anticipo:',
      `Bs. ${recepcion.anticipo}`,
      y,
    );

    y += 28;

    doc.font('Helvetica-Bold');
    doc.text('Humedad:', 40, y);

    doc.font('Helvetica');
    doc.text(
      recepcion.humedad
        ? `${recepcion.humedad}`
        : '____________________',
      105,
      y,
    );

    y += 30;

    this.linea(doc, y);

    y += 15;

    doc.font('Helvetica-Bold');
    doc.text('Observaciones', 40, y);

    y += 18;

    doc.font('Helvetica');

    doc.text(
      recepcion.observaciones ?? '',
      40,
      y,
      {
        width: 330,
        align: 'justify',
      },
    );

    y += 70;

    this.linea(doc, y);

    y += 45;

    doc.text(
      '_______________________',
      50,
      y,
    );

    doc.text(
      '_______________________',
      240,
      y,
    );

    y += 15;

    doc.text('Muestrero', 85, y);

    doc.text('Firma Cliente', 265, y);
  }

  private linea(
    doc: PDFKit.PDFDocument,
    y: number,
  ) {
    doc
      .moveTo(40, y)
      .lineTo(380, y)
      .stroke();
  }

  private textoIzquierdaDerecha(
    doc: PDFKit.PDFDocument,
    t1: string,
    v1: string,
    t2: string,
    v2: string,
    y: number,
  ) {
    doc.font('Helvetica-Bold');
    doc.text(t1, 40, y);

    doc.font('Helvetica');
    doc.text(v1, 75, y);

    doc.font('Helvetica-Bold');
    doc.text(t2, 220, y);

    doc.font('Helvetica');
    doc.text(v2, 260, y);
  }

  private dibujarMinerales(
    doc: PDFKit.PDFDocument,
    recepcion: RecepcionMineral,
    y: number,
  ) {
    const minerales = recepcion.codificacion?.minerales ?? [];

    const tiene = (descripcion: string) =>
      minerales.some(
        (m) =>
          m.descripcion.toUpperCase() ===
          descripcion.toUpperCase(),
      );

    const check = (valor: boolean) =>
      valor ? '☑' : '☐';

    doc.fontSize(11);

    doc.text(
      `${check(tiene('Plata'))} Plata`,
      40,
      y,
    );

    doc.text(
      `${check(tiene('Plomo'))} Plomo`,
      150,
      y,
    );

    doc.text(
      `${check(tiene('Zinc'))} Zinc`,
      270,
      y,
    );

    doc.fontSize(10);
  }

  private formatearFecha(fecha: Date | string): string {
    if (!fecha) return '';

    const f = new Date(fecha);

    const dia = String(f.getDate()).padStart(2, '0');
    const mes = String(f.getMonth() + 1).padStart(2, '0');
    const anio = f.getFullYear();

    return `${dia}/${mes}/${anio}`;
  }
}