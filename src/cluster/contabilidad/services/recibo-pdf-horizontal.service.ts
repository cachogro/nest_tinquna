import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import * as fs from 'fs';
import { Recibo } from '../entities/recibo.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { montoEnLetras } from 'src/common/utils/numero-a-letras.util';
import { aBolivianos } from '../moneda.util';

const LOGO_PATH = join(process.cwd(), 'uploads', 'logo.png');

const ETIQUETAS_COPIA: Array<'Original' | 'Copia 1' | 'Copia 2'> = [
  'Original',
  'Copia 1',
  'Copia 2',
];

const NOTAS = [
  '1) Una vez entregado el efectivo proceder con su revisión ya que no se aceptarán reclamos posteriores.',
  '2) Cualquier variación posterior provocará un ajuste al momento de la devolución.',
];

const COLOR_BORDE_CAJA = '#FF914C';
const COLOR_LINEA = '#FF914C';

/**
 * Tabla Code 39 (bar/space alternados, empezando por barra).
 * n = módulo angosto, w = módulo ancho.
 */
// const CODE39: Record<string, string> = {
//   '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
//   '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
//   '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
//   A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw',
//   E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn',
//   I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww',
//   M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn',
//   Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
//   U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw',
//   Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
//   '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
//   '*': 'nwnnwnwnn',
// };

@Injectable()
export class ReciboPdfHorizontalService {
  constructor(
    @InjectRepository(Recibo, 'ci')
    private readonly reciboRepository: Repository<Recibo>,
  ) {}

  /**
   * Marca la PRIMERA vez que se generó el PDF de este recibo. Update
   * atómico y condicional (`WHERE fecha_primera_impresion IS NULL`):
   * impresiones posteriores no la pisan.
   */
  private async registrarPrimeraImpresionSiCorresponde(
    id: string,
  ): Promise<void> {
    await this.reciboRepository
      .createQueryBuilder()
      .update(Recibo)
      .set({ fechaPrimeraImpresion: () => 'NOW()' })
      .where('id = :id', { id })
      .andWhere('fecha_primera_impresion IS NULL')
      .execute();
  }

  /**
   * Hoja CARTA HORIZONTAL con 3 copias del recibo en columnas
   * (Original, Copia 1, Copia 2), separadas por línea punteada de corte.
   */
  async generar(recibo: Recibo, usuarioActual: Usuario): Promise<Buffer> {
    const pdf = await this.generarPdf(recibo, usuarioActual, recibo.concepto);
    await this.registrarPrimeraImpresionSiCorresponde(recibo.id);
    return pdf;
  }

  /**
   * Igual que `generar()`, pero en "Concep/Gar" muestra el desglose de a
   * qué se aplicó cada porción del recibo cuando está PROCESADO.
   */
  async generarProcesado(
    recibo: Recibo,
    usuarioActual: Usuario,
  ): Promise<Buffer> {
    const pdf = await this.generarPdf(
      recibo,
      usuarioActual,
      this.textoConDesglose(recibo),
    );
    await this.registrarPrimeraImpresionSiCorresponde(recibo.id);
    return pdf;
  }

  private async generarPdf(
    recibo: Recibo,
    usuarioActual: Usuario,
    textoConcepto: string,
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

      const entregadoPor = this.datosUsuario(usuarioActual);
      const recibidoPor = this.datosContraparte(recibo);
      const fechaImpresion = this.formatearFechaHora(
        recibo.fechaPrimeraImpresion
          ? new Date(recibo.fechaPrimeraImpresion as any)
          : new Date(),
      );

      for (let i = 0; i < 3; i++) {
        const xLeft = margen + i * anchoCopia;
        this.dibujarCopia(
          doc,
          recibo,
          ETIQUETAS_COPIA[i],
          xLeft,
          margen,
          anchoCopia,
          altoPagina,
          entregadoPor,
          recibidoPor,
          textoConcepto,
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
    recibo: Recibo,
    etiqueta: string,
    x: number,
    yTop: number,
    ancho: number,
    alto: number,
    entregadoPor: { nombre: string; ci: string },
    recibidoPor: { nombre: string; ci: string; celular: string },
    textoConcepto: string,
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
    // empieso del todo el contenido 15
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

    const numeroRecibo = this.numeroRecibo(recibo);
    doc
      .rect(cajaNroX, yHeader + filaAlto, cajaNroAncho, filaAlto)
      .lineWidth(0.75)
      .strokeColor(COLOR_BORDE_CAJA)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(numeroRecibo, cajaNroX + 3, yHeader + filaAlto + 3.5, {
        width: cajaNroAncho - 6,
        align: 'left',
      });

    // Caja del título "RECIBO DE ...", misma Y y misma altura que la caja NRO
    const tituloAncho = cajaNroX - xDerecha;
    const tituloAlto = alturaFilaHeader;
    doc
      .rect(xDerecha, yHeader, tituloAncho, tituloAlto)
      .lineWidth(0.75)
      .strokeColor(COLOR_BORDE_CAJA)
      .stroke();
    doc
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(
        this.titulo(recibo),
        xDerecha + 2,
        yHeader + (tituloAlto - 10) / 2,
        {
          width: tituloAncho - 4,
          align: 'center',
          lineGap: -1,
        },
      );

    // Fecha de impresión, debajo de la fila de recuadros
    const yFechaImpresion = yHeader + alturaFilaHeader + 2;
    doc
      .font('Helvetica')
      .fontSize(5.5)
      .fillColor('#333333')
      .text(`F. imp: ${fechaImpresion}`, cajaNroX, yFechaImpresion, {
        width: cajaNroAncho,
        align: 'left',
      });
    doc.fillColor('#000000').strokeColor('#000000');

    const yFechaImpresionx = yHeader + alturaFilaHeader + 2;
    doc
      .font('Helvetica')
      .fontSize(5.5)
      .fillColor('#333333')
      .text(`Por: ${entregadoPor.nombre}`, xDerecha, yFechaImpresionx, {
        width: cajaNroAncho,
        align: 'left',
      });
    doc.fillColor('#000000').strokeColor('#000000');

    const logoAlto = 36; // alto aproximado del logo a este ancho
    y = Math.max(y + logoAlto, yFechaImpresion + 8) + 4;

    // ---------------------------------------------------------- "Por:"
    y = this.campo(doc, xi, y, anchoInterno, 'Por:', entregadoPor.nombre, 26);

    // --------------------------- cuerpo ---------------------
    const anchoEtiqueta = 60;

    y = this.campo(
      doc,
      xi,
      y,
      anchoInterno,
      'CK:',
      this.codigoCk(recibo),
      anchoEtiqueta,
    );
    y = this.campo(
      doc,
      xi,
      y,
      anchoInterno,
      'Para:',
      recibidoPor.nombre,
      anchoEtiqueta,
    );

    // Monto numérico + monto en letras (dos renglones, como en el talonario)
    y = this.campo(
      doc,
      xi,
      y,
      anchoInterno,
      'Monto:',
      recibo.moneda === 'USD'
        ? `${this.formatearMontoDecimal(recibo.montoTotal)} $us (T.C. ${new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(recibo.tipoCambio))} = ${this.formatearMontoDecimal(aBolivianos(recibo.montoTotal, 'USD', recibo.tipoCambio ?? null))} Bs.)`
        : `${this.formatearMontoDecimal(recibo.montoTotal)} Bs.`,
      anchoEtiqueta,
      true,
    );
    y = this.campo(
      doc,
      xi,
      y,
      anchoInterno,
      '',
      montoEnLetras(recibo.montoTotal, recibo.moneda),
      anchoEtiqueta,
    );

    // Tipo de pago + N.º de cheque / comprobante en la misma línea
    const formaPago = (recibo.formaPago?.codigo ?? '').toUpperCase();
    const anchoTipoPago = anchoInterno * 0.55;
    const yTipoPago = y;
    y = this.campo(
      doc,
      xi,
      y,
      anchoTipoPago,
      'Tipo pago:',
      formaPago,
      anchoEtiqueta,
    );

    const nroComprobante = recibo.nroComprobante ?? '';
    if (nroComprobante) {
      const etiquetaComprobante = formaPago === 'CHEQUE' ? 'Cheq.:' : 'Comp.:';
      this.campo(
        doc,
        xi + anchoTipoPago + 8,
        yTipoPago,
        anchoInterno - anchoTipoPago - 8,
        etiquetaComprobante,
        nroComprobante,
        34,
      );
    }

    y = this.campo(
      doc,
      xi,
      y,
      anchoInterno,
      'Concep/Gar:',
      textoConcepto,
      anchoEtiqueta,
    );
    y = this.campo(
      doc,
      xi,
      y,
      anchoInterno,
      'Obs:',
      this.observaciones(recibo),
      anchoEtiqueta,
    );
    y = this.campo(
      doc,
      xi,
      y,
      anchoInterno,
      'Fecha:',
      this.formatearFechaCorta(recibo.fecha),
      anchoEtiqueta,
    );

    // ---------------------------------------------------------- pie
    const yLineaFirma = yTop + alto - 112;

    // Notas (justo encima del bloque de firma, sin encimarse con el cuerpo)
    const yNotas = Math.max(y + 8, yLineaFirma - 40);
    doc
      .font('Helvetica-Bold')
      .fontSize(5.5)
      .text('Nota:', xi, yNotas, { width: 20 });
    doc
      .font('Helvetica')
      .fontSize(5.5)
      .text(NOTAS.join('\n'), xi + 20, yNotas, {
        width: anchoInterno - 20,
        lineGap: 1,
      });

    // Etiqueta de copia
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#000000')
      .text(etiqueta, xi, yLineaFirma - 11, { width: anchoInterno });

    // Línea de firma
    doc
      .lineWidth(0.75)
      .strokeColor('#000000')
      .moveTo(xi, yLineaFirma)
      .lineTo(xi + anchoInterno, yLineaFirma)
      .stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Firma', xi, yLineaFirma + 3, {
        width: anchoInterno,
        align: 'center',
      });

    // Datos de quien firma
    doc.font('Helvetica-Bold').fontSize(7.5);
    doc.text('Nombre:', xi, yLineaFirma + 20, { width: 44 });
    doc.text('C.I.:', xi, yLineaFirma + 32, { width: 44 });
    doc.text('Cel.:', xi, yLineaFirma + 44, { width: 44 });

    doc.font('Helvetica').fontSize(7.5);
    doc.text(recibidoPor.nombre, xi + 44, yLineaFirma + 20, {
      width: anchoInterno - 44,
      height: 10,
      ellipsis: true,
    });
    doc.text(recibidoPor.ci, xi + 44, yLineaFirma + 32, {
      width: anchoInterno - 44,
    });
    doc.text(recibidoPor.celular, xi + 44, yLineaFirma + 44, {
      width: anchoInterno - 44,
    });

    // Código de barras abajo a la derecha
    const bcAncho = Math.min(120, anchoInterno);
    // this.dibujarCodigoBarras(
    //   doc,
    //   numeroRecibo,
    //   xi + anchoInterno - bcAncho,
    //   yTop + alto - pad - 26,
    //   bcAncho,
    //   22,
    // );
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

    if (etiqueta) {
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#000000')
        .text(etiqueta, x, y, {
          width: anchoEtiqueta - 2,
        });
    }

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

  /** Código de barras Code 39 (con delimitadores `*`). */
  // private dibujarCodigoBarras(
  //   doc: any,
  //   texto: string,
  //   x: number,
  //   y: number,
  //   ancho: number,
  //   alto: number,
  // ) {
  //   const limpio = (texto ?? '')
  //     .toUpperCase()
  //     .replace(/[^0-9A-Z\-. ]/g, '');
  //   if (!limpio) return;

  //   const patrones = [...`*${limpio}*`].map((c) => CODE39[c]).filter(Boolean) as string[];
  //   if (patrones.length === 0) return;

  //   const ratio = 2; // módulo ancho = 2 módulos angostos
  //   const unidades = patrones.length * (6 + 3 * ratio) + (patrones.length - 1);
  //   const u = ancho / unidades;

  //   let cursor = x;
  //   doc.fillColor('#000000');
  //   for (const patron of patrones) {
  //     for (let j = 0; j < 9; j++) {
  //       const w = (patron[j] === 'w' ? ratio : 1) * u;
  //       if (j % 2 === 0) {
  //         doc.rect(cursor, y, w, alto).fill('#000000');
  //       }
  //       cursor += w;
  //     }
  //     cursor += u; // espacio entre caracteres
  //   }
  //   doc.fillColor('#000000').strokeColor('#000000');
  // }

  // ------------------------------------------------------------------ datos
  private titulo(recibo: Recibo): string {
    return `RECIBO DE ${recibo.tipo}`;
  }

  private numeroRecibo(recibo: Recibo): string {
    return `${recibo.serie}-${String(recibo.numero).padStart(4, '0')}`;
  }

  /** Código interno mostrado como "CK:" (cuenta bancaria asociada). */
  private codigoCk(recibo: Recibo): string {
    return recibo.cuentaBancaria?.numeroCuenta ?? '';
  }

  /** Ajustar al nombre real del campo de observaciones de la entidad. */
  private observaciones(recibo: Recibo): string {
    const r = recibo as any;
    return r.observaciones ?? r.observacion ?? '';
  }

  private datosUsuario(usuario: Usuario): { nombre: string; ci: string } {
    const persona = usuario?.persona;
    const nombre = [
      persona?.nombres,
      persona?.apellidoPaterno,
      persona?.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
      nombre: (nombre || usuario?.usuario || '').toUpperCase(),
      ci: persona?.numeroDocumento ?? '',
    };
  }

  private datosContraparte(recibo: Recibo): {
    nombre: string;
    ci: string;
    celular: string;
  } {
    const persona = recibo.persona as any;
    return {
      nombre: (recibo.nombresApellidos ?? '').toUpperCase(),
      ci: persona?.numeroDocumento ?? '',
      celular: persona?.celular ?? persona?.telefono ?? '',
    };
  }

  private formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-BO', { minimumFractionDigits: 0 }).format(
      Number(monto),
    );
  }

  private formatearMontoDecimal(monto: number): string {
    return new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(monto));
  }

  private formatearFechaCorta(fecha: string): string {
    if (!fecha) return '';
    const [anio, mes, dia] = fecha.split('-');
    if (!anio || !mes || !dia) return fecha;
    return `${dia}/${mes}/${anio}`;
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

  /**
   * Concepto + desglose de a qué se aplicó cada línea del recibo. Si el
   * recibo no tiene `detalles` (BORRADOR/ANULADO), devuelve solo el concepto.
   */
  private textoConDesglose(recibo: Recibo): string {
    const detalles = recibo.detalles ?? [];
    if (detalles.length === 0) {
      return recibo.concepto;
    }

    const partes = detalles.map((detalle) => {
      const monto = `${recibo.moneda === 'USD' ? '$us' : 'Bs'} ${this.formatearMonto(detalle.monto)}`;
      if (detalle.destino === 'PERSONAL') return `${monto} a kardex personal`;
      if (detalle.destino === 'ACTOR') return `${monto} a kardex de actor`;
      if (detalle.destino === 'CLIENTE') return `${monto} a kardex de cliente`;
      return `${monto} en efectivo`;
    });

    return `${recibo.concepto}: ${this.unirConY(partes)}`;
  }

  private unirConY(items: string[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
  }
}
