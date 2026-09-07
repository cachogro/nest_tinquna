import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import * as fs from 'fs';
import { Recibo } from '../entities/recibo.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { montoEnLetrasBolivianos } from 'src/common/utils/numero-a-letras.util';

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

const ETIQUETAS_COPIA: Array<'Original' | 'Copia 1' | 'Copia 2'> = [
  'Original',
  'Copia 1',
  'Copia 2',
];

@Injectable()
export class ReciboPdfService {
  /**
   * Hoja carta con 3 copias del recibo apiladas (Original, Copia 1, Copia 2),
   * separadas por una línea punteada, replicando el talonario físico.
   */
  async generar(recibo: Recibo, usuarioActual: Usuario): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const margen = 20;
      const doc = new PDFDocument({
        size: 'LETTER',
        margin: margen,
        bufferPages: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (buffer) => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const anchoPagina = doc.page.width - margen * 2;
      const altoPagina = doc.page.height - margen * 2;
      const alturaCopia = altoPagina / 3;

      const entregadoPor = this.datosUsuario(usuarioActual);
      const recibidoPor = this.datosContraparte(recibo);

      for (let i = 0; i < 3; i++) {
        const yTop = margen + i * alturaCopia;
        this.dibujarCopia(
          doc,
          recibo,
          ETIQUETAS_COPIA[i],
          margen,
          yTop,
          anchoPagina,
          alturaCopia,
          entregadoPor,
          recibidoPor,
        );

        if (i < 2) {
          this.lineaPunteada(doc, margen, yTop + alturaCopia, anchoPagina);
        }
      }

      doc.end();
    });
  }

  // ------------------------------------------------------------------ copia
  private dibujarCopia(
    doc: any,
    recibo: Recibo,
    etiqueta: string,
    x: number,
    yTop: number,
    ancho: number,
    alto: number,
    entregadoPor: { nombre: string; ci: string },
    recibidoPor: { nombre: string; ci: string },
  ) {
    const pad = 10;
    const xi = x + pad;
    const anchoInterno = ancho - pad * 2;

    doc.rect(x, yTop, ancho, alto).lineWidth(0.75).stroke('#000000');

    let y = yTop + pad;

    // --- Logo ---
    const logoAncho = 72;
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, xi, y, { width: logoAncho });
    }

    // --- Caja de info (Recibo N° / Bs. / $us.), arriba a la derecha ---
    const cajaAncho = 120;
    const cajaAlto = 42;
    const cajaX = x + ancho - pad - cajaAncho;
    doc.rect(cajaX, y, cajaAncho, cajaAlto).lineWidth(0.75).stroke();

    const filaAlto = cajaAlto / 3;
    const numeroRecibo = `${recibo.serie}-${String(recibo.numero).padStart(4, '0')}`;
    this.filaEtiquetaValor(doc, cajaX, y, cajaAncho, filaAlto, 'Recibo N.º', numeroRecibo);
    this.filaEtiquetaValor(
      doc,
      cajaX,
      y + filaAlto,
      cajaAncho,
      filaAlto,
      'Bs.º',
      this.formatearMonto(recibo.montoTotal),
    );
    this.filaEtiquetaValor(doc, cajaX, y + filaAlto * 2, cajaAncho, filaAlto, '$us.º', '0');

    // --- Título (pastilla) centrado entre el logo y la caja de info ---
    const tituloX = xi + logoAncho + 8;
    const tituloAncho = cajaX - 8 - tituloX;
    const esEgreso = recibo.tipo === 'EGRESO';
    const colorTitulo = esEgreso ? '#F4A040' : '#E0E0E0';
    const tituloAlto = 26;
    const tituloY = y + (cajaAlto - tituloAlto) / 2;

    doc
      .roundedRect(tituloX, tituloY, tituloAncho, tituloAlto, tituloAlto / 2)
      .fill(colorTitulo);
    doc
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(`RECIBO DE ${recibo.tipo}`, tituloX, tituloY + 7, {
        width: tituloAncho,
        align: 'center',
      });

    y += cajaAlto + 8;

    // --- Recibí de ---
    doc.font('Helvetica-Bold').fontSize(8).text('Recibí de', xi, y, { width: 70 });
    this.lineaPuntosConTexto(doc, xi + 70, y, anchoInterno - 70, recibidoPor.nombre);

    y += 16;

    // --- Monto en letras ---
    this.lineaPuntosConTexto(
      doc,
      xi,
      y,
      anchoInterno,
      montoEnLetrasBolivianos(recibo.montoTotal),
      true,
    );

    y += 16;

    // --- Por concepto (INGRESO) / Por concepto de (EGRESO) ---
    const etiquetaConcepto = esEgreso ? 'Por concepto de' : 'Por concepto';
    doc.font('Helvetica-Bold').fontSize(8).text(etiquetaConcepto, xi, y, { width: 85 });
    this.lineaPuntosConTexto(doc, xi + 85, y, anchoInterno - 85, recibo.concepto);

    y += 18;

    // --- Efectivo / Cheque / Banco + Fecha ---
    const codigoFormaPago = recibo.formaPago?.codigo ?? null;
    const esEfectivo = codigoFormaPago === 'EFECTIVO';
    const esCheque = codigoFormaPago === 'CHEQUE';
    const esBanco = !!codigoFormaPago && !esEfectivo && !esCheque;

    const anchoCasillero = anchoInterno / 3;
    this.casillero(doc, xi, y, anchoCasillero, 'Efectivo.º', esEfectivo);
    this.casillero(doc, xi + anchoCasillero, y, anchoCasillero, 'Cheque.º', esCheque);
    this.casillero(doc, xi + anchoCasillero * 2, y, anchoCasillero, 'Banco.º', esBanco);

    y += 16;

    doc.font('Helvetica-Bold').fontSize(8).text('Fecha', xi, y, { width: 40 });
    this.lineaPuntosConTexto(doc, xi + 40, y, 200, this.formatearFechaLarga(recibo.fecha));

    if (esBanco) {
      const banco = recibo.cuentaBancaria?.entidadFinanciera?.sigla
        ?? recibo.cuentaBancaria?.entidadFinanciera?.nombre
        ?? '';
      const cuenta = recibo.cuentaBancaria?.numeroCuenta ?? '';
      const comprobante = recibo.nroComprobante ?? '';
      const detalleBanco = [banco, cuenta && `Cta. ${cuenta}`, comprobante && `Comp. ${comprobante}`]
        .filter(Boolean)
        .join(' - ');
      if (detalleBanco) {
        doc
          .font('Helvetica')
          .fontSize(7)
          .text(detalleBanco, xi + 250, y + 1, { width: anchoInterno - 250 });
      }
    }

    // --- Firmas ---
    const yFirmas = yTop + alto - pad - 32;
    const mitad = anchoInterno / 2;

    doc.font('Helvetica').fontSize(7);
    doc
      .moveTo(xi + 10, yFirmas)
      .lineTo(xi + mitad - 10, yFirmas)
      .stroke();
    doc
      .moveTo(xi + mitad + 10, yFirmas)
      .lineTo(xi + anchoInterno - 10, yFirmas)
      .stroke();

    doc.font('Helvetica-Bold').fontSize(7);
    doc.text('Entregue conforme', xi, yFirmas + 2, { width: mitad, align: 'center' });
    doc.text('Recibi conforme', xi + mitad, yFirmas + 2, { width: mitad, align: 'center' });

    doc.font('Helvetica').fontSize(7);
    doc.text(`Nombre.º ${entregadoPor.nombre}`, xi, yFirmas + 13, { width: mitad, align: 'center' });
    doc.text(`CI: ${entregadoPor.ci}`, xi, yFirmas + 23, { width: mitad, align: 'center' });
    doc.text(`Nombre.º ${recibidoPor.nombre}`, xi + mitad, yFirmas + 13, {
      width: mitad,
      align: 'center',
    });
    doc.text(`CI: ${recibidoPor.ci}`, xi + mitad, yFirmas + 23, { width: mitad, align: 'center' });

    // --- Etiqueta de copia (Original / Copia 1 / Copia 2) ---
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(etiqueta, x + ancho / 2 - mitad / 2, yFirmas - 10, {
        width: mitad,
        align: 'center',
      });
  }

  // ------------------------------------------------------------------ helpers de dibujo
  private filaEtiquetaValor(
    doc: any,
    x: number,
    y: number,
    ancho: number,
    alto: number,
    etiqueta: string,
    valor: string,
  ) {
    const anchoEtiqueta = ancho * 0.55;
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(etiqueta, x + 3, y + alto / 2 - 4, { width: anchoEtiqueta - 3 });
    doc
      .font('Helvetica')
      .fontSize(7)
      .text(valor, x + anchoEtiqueta, y + alto / 2 - 4, {
        width: ancho - anchoEtiqueta - 3,
        align: 'right',
      });
  }

  private lineaPuntosConTexto(
    doc: any,
    x: number,
    y: number,
    ancho: number,
    texto: string,
    centrado = false,
  ) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(texto ?? '', x, y, { width: ancho, align: centrado ? 'center' : 'left' });
    doc
      .moveTo(x, y + 11)
      .lineWidth(0.5)
      .dash(1, { space: 2 })
      .strokeColor('#999999')
      .moveTo(x, y + 11)
      .lineTo(x + ancho, y + 11)
      .stroke();
    doc.undash().strokeColor('#000000');
  }

  private casillero(doc: any, x: number, y: number, ancho: number, etiqueta: string, marcado: boolean) {
    const lado = 8;
    doc.rect(x, y + 1, lado, lado).lineWidth(0.75).stroke();
    if (marcado) {
      doc.font('Helvetica-Bold').fontSize(8).text('x', x + 1.5, y, { width: lado });
    }
    doc.font('Helvetica').fontSize(8).text(etiqueta, x + lado + 4, y, { width: ancho - lado - 4 });
  }

  private lineaPunteada(doc: any, x: number, y: number, ancho: number) {
    doc
      .lineWidth(0.75)
      .dash(2, { space: 2 })
      .strokeColor('#000000')
      .moveTo(x, y)
      .lineTo(x + ancho, y)
      .stroke();
    doc.undash();
  }

  // ------------------------------------------------------------------ datos
  private datosUsuario(usuario: Usuario): { nombre: string; ci: string } {
    const persona = usuario?.persona;
    const nombre = [persona?.nombres, persona?.apellidoPaterno, persona?.apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
      nombre: (nombre || usuario?.usuario || '').toUpperCase(),
      ci: persona?.numeroDocumento ?? '',
    };
  }

  private datosContraparte(recibo: Recibo): { nombre: string; ci: string } {
    return {
      nombre: (recibo.nombresApellidos ?? '').toUpperCase(),
      ci: recibo.persona?.numeroDocumento ?? '',
    };
  }

  private formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-BO', { minimumFractionDigits: 0 }).format(Number(monto));
  }

  private formatearFechaLarga(fecha: string): string {
    if (!fecha) return '';
    const [anio, mes, dia] = fecha.split('-').map(Number);
    if (!anio || !mes || !dia) return fecha;
    return `${dia} de ${MESES[mes - 1]} de ${anio}`;
  }
}
