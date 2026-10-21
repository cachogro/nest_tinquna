import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import { nitBajoLogo } from 'src/common/datos-empresa';
import * as fs from 'fs';
import { BoletaPago } from '../entities/boleta-pago.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { montoEnLetras } from 'src/common/utils/numero-a-letras.util';
import { formatearFechaHora } from '../fecha-hora.util';

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

const ETIQUETAS_COPIA = ['Original', 'Copia 1', 'Copia 2'];

// Filas de detalle por columna (ingresos / descuentos de ley / préstamos):
// al menos 3; hasta 5 si algún rubro las necesita (finiquito, horas extra).
const FILAS_DETALLE = 3;
const FILAS_DETALLE_MAX = 5;

const TITULOS: Record<string, string> = {
  SUELDO: 'BOLETA DE PAGO',
  AGUINALDO: 'BOLETA DE AGUINALDO',
  FINIQUITO: 'FINIQUITO',
  RETROACTIVO: 'BOLETA DE RETROACTIVO',
};

interface Fila {
  etiqueta: string;
  monto: number;
}

interface Columna {
  titulo: string;
  filas: Fila[];
  etiquetaTotal: string;
  total: number;
}

/**
 * PDF de la boleta de pago: mismo formato que el recibo vertical
 * (ReciboPdfService) — hoja carta con 3 copias apiladas (Original, Copia 1,
 * Copia 2) separadas por línea punteada, logo, título en pastilla, caja de
 * info arriba a la derecha y firmas abajo.
 *
 * El cuerpo muestra el salario por ley (INGRESOS y DESCUENTOS DE LEY hasta
 * el LÍQUIDO PAGABLE) y, con `conDetalleInterno`, una tercera columna con
 * lo descontado para préstamos y el NETO RECIBIDO (lo que salió de caja).
 */
@Injectable()
export class BoletaPagoPdfService {
  async generar(
    boleta: BoletaPago,
    usuarioActual: Usuario,
    conDetalleInterno = true,
  ): Promise<Buffer> {
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
      const empleado = this.datosEmpleado(boleta);

      for (let i = 0; i < 3; i++) {
        const yTop = margen + i * alturaCopia;
        this.dibujarCopia(
          doc,
          boleta,
          ETIQUETAS_COPIA[i],
          margen,
          yTop,
          anchoPagina,
          alturaCopia,
          entregadoPor,
          empleado,
          conDetalleInterno,
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
    boleta: BoletaPago,
    etiqueta: string,
    x: number,
    yTop: number,
    ancho: number,
    alto: number,
    entregadoPor: { nombre: string; ci: string },
    empleado: { nombre: string; ci: string },
    conDetalleInterno: boolean,
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
    nitBajoLogo(doc, xi, y + 23);

    // --- Caja de info (Boleta N° / Fecha de pago / Emitido / Recibo N°) ---
    const cajaAncho = 130;
    const cajaAlto = 42;
    const cajaX = x + ancho - pad - cajaAncho;
    doc.rect(cajaX, y, cajaAncho, cajaAlto).lineWidth(0.75).stroke();

    const filaAlto = cajaAlto / 4;
    this.filaEtiquetaValor(doc, cajaX, y, cajaAncho, filaAlto, 'Boleta N.º', String(boleta.numero).padStart(4, '0'));
    this.filaEtiquetaValor(doc, cajaX, y + filaAlto, cajaAncho, filaAlto, 'Fecha de pago', this.formatearFechaCorta(boleta.fechaPago));
    this.filaEtiquetaValor(
      doc,
      cajaX,
      y + filaAlto * 2,
      cajaAncho,
      filaAlto,
      'Emitido',
      boleta.fechaHoraGeneracion ? formatearFechaHora(boleta.fechaHoraGeneracion) : '',
    );
    this.filaEtiquetaValor(
      doc,
      cajaX,
      y + filaAlto * 3,
      cajaAncho,
      filaAlto,
      'Recibo N.º',
      boleta.recibo ? `${boleta.recibo.serie}-${String(boleta.recibo.numero).padStart(4, '0')}` : '-',
    );

    // --- Título (pastilla) centrado entre el logo y la caja de info ---
    const tituloX = xi + logoAncho + 8;
    const tituloAncho = cajaX - 8 - tituloX;
    const tituloAlto = 26;
    const tituloY = y + (cajaAlto - tituloAlto) / 2;
    doc
      .roundedRect(tituloX, tituloY, tituloAncho, tituloAlto, tituloAlto / 2)
      .fill('#9CC3E6');
    doc
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(TITULOS[boleta.tipo] ?? 'BOLETA DE PAGO', tituloX, tituloY + 7, {
        width: tituloAncho,
        align: 'center',
      });

    y += cajaAlto + 7;

    // --- Datos del empleado ---
    const mitad = anchoInterno / 2;
    this.campo(doc, xi, y, mitad - 8, 'Nombre', empleado.nombre, 48);
    this.campo(doc, xi + mitad, y, mitad, 'CI', empleado.ci, 20);
    y += 13;

    const tercio = anchoInterno / 3;
    this.campo(
      doc,
      xi,
      y,
      tercio * 2 - 8,
      'Periodo',
      `${this.formatearFechaLarga(boleta.fechaDesde)} al ${this.formatearFechaLarga(boleta.fechaHasta)}`,
      48,
    );
    this.campo(
      doc,
      xi + tercio * 2,
      y,
      tercio * 0.62 - 4,
      'Ingreso',
      this.formatearFechaCorta(boleta.persona?.fechaInicioLaboral ?? ''),
      36,
    );
    this.campo(
      doc,
      xi + tercio * 2 + tercio * 0.62,
      y,
      tercio * 0.38,
      'Días',
      boleta.diasTrabajados != null ? String(boleta.diasTrabajados) : '',
      24,
    );
    y += 17;

    // --- Columnas de detalle ---
    const columnas: Columna[] = [
      {
        titulo: 'INGRESOS',
        filas: this.filasIngresos(boleta),
        etiquetaTotal: 'TOTAL GANADO',
        total: Number(boleta.totalGanado),
      },
      {
        titulo: 'DESCUENTOS DE LEY',
        filas: [
          { etiqueta: 'Aporte laboral (Gestora)', monto: Number(boleta.aporteLaboral) },
          { etiqueta: 'RC-IVA', monto: Number(boleta.rcIva) },
          { etiqueta: 'Otros descuentos', monto: Number(boleta.otrosDescuentosLey) },
          ...(Number(boleta.descuentoAtrasos) > 0
            ? [{ etiqueta: this.etiquetaAtrasos(boleta), monto: Number(boleta.descuentoAtrasos) }]
            : []),
          ...this.filasSanciones(boleta),
        ],
        etiquetaTotal: 'TOTAL DESCUENTOS',
        total: Number(boleta.totalDescuentosLey),
      },
    ];
    if (conDetalleInterno) {
      columnas.push({
        titulo: 'DESCUENTO PRÉSTAMOS',
        filas: this.filasPrestamos(boleta),
        etiquetaTotal: 'TOTAL PRÉSTAMOS',
        total: Number(boleta.totalDescuentoPrestamos),
      });
    }

    const sep = 6;
    const anchoColumna = (anchoInterno - sep * (columnas.length - 1)) / columnas.length;
    const filasDetalle = Math.min(
      FILAS_DETALLE_MAX,
      Math.max(FILAS_DETALLE, ...columnas.map((c) => c.filas.length)),
    );
    let altoTabla = 0;
    columnas.forEach((col, i) => {
      altoTabla = this.dibujarColumna(doc, col, xi + i * (anchoColumna + sep), y, anchoColumna, filasDetalle);
    });
    y += altoTabla + 6;

    // --- Resumen: líquido pagable (y neto recibido) + monto en letras ---
    const montoFinal = conDetalleInterno ? Number(boleta.montoPagado) : Number(boleta.liquidoPagable);
    const resumen = conDetalleInterno
      ? [
          `LÍQUIDO PAGABLE: Bs ${this.formatearMonto(boleta.liquidoPagable)}`,
          `DESC. PRÉSTAMOS: Bs ${this.formatearMonto(boleta.totalDescuentoPrestamos)}`,
          `NETO RECIBIDO: Bs ${this.formatearMonto(boleta.montoPagado)}`,
        ]
      : [`LÍQUIDO PAGABLE: Bs ${this.formatearMonto(boleta.liquidoPagable)}`];

    doc.rect(xi, y, anchoInterno, 14).fill('#EEEEEE');
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);
    const anchoResumen = anchoInterno / resumen.length;
    resumen.forEach((texto, i) => {
      doc.text(texto, xi + i * anchoResumen, y + 3.5, {
        width: resumen.length === 1 ? anchoResumen - 6 : anchoResumen,
        align: resumen.length === 1 ? 'right' : 'center',
      });
    });
    y += 17;

    doc.font('Helvetica-Bold').fontSize(8).text('Son:', xi, y, { width: 24 });
    this.lineaPuntosConTexto(doc, xi + 24, y, anchoInterno - 24, montoEnLetras(montoFinal, 'BS'));

    // --- Saldo pendiente de cada préstamo tras este descuento ---
    const saldos = conDetalleInterno ? this.textoSaldosPrestamos(boleta) : '';
    if (saldos) {
      y += 15;
      doc.font('Helvetica-Bold').fontSize(8).text('Saldo préstamos:', xi, y, { width: 78 });
      this.lineaPuntosConTexto(doc, xi + 78, y, anchoInterno - 78, saldos);
    }

    // --- Firmas ---
    const yFirmas = yTop + alto - pad - 32;

    doc.lineWidth(0.75);
    doc.moveTo(xi + 10, yFirmas).lineTo(xi + mitad - 10, yFirmas).stroke();
    doc.moveTo(xi + mitad + 10, yFirmas).lineTo(xi + anchoInterno - 10, yFirmas).stroke();

    doc.font('Helvetica-Bold').fontSize(7);
    doc.text('Entregue conforme', xi, yFirmas + 2, { width: mitad, align: 'center' });
    doc.text('Recibi conforme', xi + mitad, yFirmas + 2, { width: mitad, align: 'center' });

    doc.font('Helvetica').fontSize(7);
    doc.text(`Nombre.º ${entregadoPor.nombre}`, xi, yFirmas + 13, { width: mitad, align: 'center' });
    doc.text(`CI: ${entregadoPor.ci}`, xi, yFirmas + 23, { width: mitad, align: 'center' });
    doc.text(`Nombre.º ${empleado.nombre}`, xi + mitad, yFirmas + 13, { width: mitad, align: 'center' });
    doc.text(`CI: ${empleado.ci}`, xi + mitad, yFirmas + 23, { width: mitad, align: 'center' });

    // --- Etiqueta de copia (Original / Copia 1 / Copia 2) ---
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(etiqueta, x + ancho / 2 - mitad / 2, yFirmas - 10, {
        width: mitad,
        align: 'center',
      });
  }

  /**
   * Ingresos de la boleta. SUELDO: básico, bono, horas extra y dominicales (si hay) y otros.
   * AGUINALDO / FINIQUITO / RETROACTIVO: sus rubros (detalle INGRESO); si
   * sobran filas, el resto se suma en "Otros rubros".
   */
  private filasIngresos(boleta: BoletaPago): Fila[] {
    if (boleta.tipo && boleta.tipo !== 'SUELDO') {
      const rubros: Fila[] = (boleta.detalles ?? [])
        .filter((d) => d.tipo === 'INGRESO')
        .sort((a, b) => a.orden - b.orden)
        .map((d) => ({ etiqueta: d.nombre, monto: Number(d.monto) }));
      if (rubros.length > FILAS_DETALLE_MAX) {
        const resto = rubros.slice(FILAS_DETALLE_MAX - 1);
        return [
          ...rubros.slice(0, FILAS_DETALLE_MAX - 1),
          { etiqueta: `Otros rubros (${resto.length})`, monto: resto.reduce((s, f) => s + f.monto, 0) },
        ];
      }
      return rubros.length ? rubros : [{ etiqueta: 'Otros ingresos', monto: Number(boleta.otrosIngresos) }];
    }
    const filas: Fila[] = [
      { etiqueta: 'Salario básico', monto: Number(boleta.salarioBase) },
      { etiqueta: 'Bono de antigüedad', monto: Number(boleta.bonoAntiguedad) },
    ];
    // "4 h × 25,00": el valor de cada una no se guarda, sale de importe / cantidad.
    const porUnidad = (cantidad: number, monto: number) =>
      cantidad > 0
        ? ` × ${(monto / cantidad).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '';
    if (Number(boleta.montoHorasExtra) > 0) {
      const horas = Number(boleta.horasExtra);
      filas.push({
        etiqueta: `Horas extra (${horas} h${porUnidad(horas, Number(boleta.montoHorasExtra))})`,
        monto: Number(boleta.montoHorasExtra),
      });
    }
    if (Number(boleta.montoDominicales) > 0) {
      const dias = Number(boleta.diasDominicales);
      filas.push({
        etiqueta: `Dominicales (${dias} d${porUnidad(dias, Number(boleta.montoDominicales))})`,
        monto: Number(boleta.montoDominicales),
      });
    }
    // Beneficios (lactancia, natalidad...): una fila por cada uno; si no
    // entran, una sola fila con la suma.
    const beneficios: Fila[] = (boleta.detalles ?? [])
      .filter((d) => d.tipo === 'INGRESO' && d.idPersonalBeneficio)
      .sort((a, b) => a.orden - b.orden)
      .map((d) => ({ etiqueta: d.nombre, monto: Number(d.monto) }));
    if (!beneficios.length && Number(boleta.montoBeneficios) > 0) {
      beneficios.push({ etiqueta: 'Beneficios', monto: Number(boleta.montoBeneficios) });
    }
    // Sin beneficios, "Otros ingresos" va siempre (como antes); con ellos, solo si hay.
    const otros = !beneficios.length || Number(boleta.otrosIngresos) > 0;
    const libres = FILAS_DETALLE_MAX - filas.length - (otros ? 1 : 0);
    if (beneficios.length > libres) {
      filas.push({
        etiqueta: `Beneficios (${beneficios.length})`,
        monto: beneficios.reduce((s, f) => s + f.monto, 0),
      });
    } else {
      filas.push(...beneficios);
    }
    if (otros) filas.push({ etiqueta: 'Otros ingresos', monto: Number(boleta.otrosIngresos) });
    return filas;
  }

  /**
   * Una columna con título, `filasDetalle` filas (etiqueta / monto) y el
   * total. Devuelve su alto.
   */
  private dibujarColumna(
    doc: any,
    col: Columna,
    x: number,
    y: number,
    ancho: number,
    filasDetalle = FILAS_DETALLE,
  ): number {
    // Con más de 3 filas se achica cada fila: la tabla crece como mucho 8 pt
    // para no pisar las firmas (son 3 copias por hoja carta).
    const altoFila = filasDetalle <= FILAS_DETALLE ? 10 : 58 / (filasDetalle + 2);
    const anchoMonto = 52;
    const alto = altoFila * (filasDetalle + 2) + 2;

    doc.rect(x, y, ancho, altoFila).fill('#DDDDDD');
    doc
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(col.titulo, x, y + 2, { width: ancho, align: 'center' });

    doc.font('Helvetica').fontSize(7);
    for (let i = 0; i < filasDetalle; i++) {
      const fila = col.filas[i];
      if (!fila) continue;
      const yf = y + altoFila * (i + 1) + 1;
      doc.text(this.recortar(doc, fila.etiqueta, ancho - anchoMonto - 6), x + 3, yf + 1, {
        width: ancho - anchoMonto - 6,
        lineBreak: false,
      });
      doc.text(this.formatearMonto(fila.monto), x + ancho - anchoMonto - 3, yf + 1, {
        width: anchoMonto,
        align: 'right',
      });
    }

    const yTotal = y + altoFila * (filasDetalle + 1) + 2;
    doc.moveTo(x, yTotal).lineTo(x + ancho, yTotal).lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fontSize(7);
    doc.text(col.etiquetaTotal, x + 3, yTotal + 2, { width: ancho - anchoMonto - 6 });
    doc.text(this.formatearMonto(col.total), x + ancho - anchoMonto - 3, yTotal + 2, {
      width: anchoMonto,
      align: 'right',
    });

    doc.rect(x, y, ancho, alto).lineWidth(0.75).stroke();
    return alto;
  }

  /** "Atrasos 45 min · 1 falta" (lo descontado en la boleta). */
  /**
   * Sanciones de memorándums: una fila por memorándum ("Sanción memo 021/2026")
   * o, si no entran en la columna, una sola con el total.
   */
  private filasSanciones(boleta: BoletaPago): Fila[] {
    if (!(Number(boleta.descuentoSanciones) > 0)) return [];
    const lineas = (boleta.detalles ?? []).filter((d) => d.tipo === 'SANCION');
    if (lineas.length === 1) {
      const cite = lineas[0].nombre.split('MEMO ').pop() ?? '';
      // "TINKURIQUNA/RRHH/MEMO/021/2026" → "021/2026"
      const corto = cite.split('/').slice(-2).join('/');
      return [{ etiqueta: `Sanción memo ${corto}`, monto: Number(lineas[0].monto) }];
    }
    return [
      {
        etiqueta: `Sanciones (${lineas.length} memos)`,
        monto: Number(boleta.descuentoSanciones),
      },
    ];
  }

  private etiquetaAtrasos(boleta: BoletaPago): string {
    const partes = ['Atrasos'];
    if (Number(boleta.minutosAtraso) > 0) partes.push(`${boleta.minutosAtraso} min`);
    const faltas = Number(boleta.diasFalta);
    if (faltas > 0) partes.push(`${faltas} falta${faltas === 1 ? '' : 's'}`);
    return partes.join(' · ');
  }

  private descuentosOrdenados(boleta: BoletaPago) {
    return [...(boleta.descuentosPrestamo ?? [])].sort(
      (a, b) => (a.prestamo?.numero ?? 0) - (b.prestamo?.numero ?? 0),
    );
  }

  /**
   * Una fila por préstamo descontado ("N° 1 COMPRA DE MOTO"). Si hay más
   * préstamos que filas, los sobrantes se suman en "Otros préstamos".
   */
  private filasPrestamos(boleta: BoletaPago): Fila[] {
    const filas: Fila[] = this.descuentosOrdenados(boleta).map((d) => ({
      etiqueta: `N° ${d.prestamo?.numero ?? ''} ${d.prestamo?.descripcion ?? ''}`,
      monto: Number(d.haber),
    }));
    if (filas.length === 0) {
      return [{ etiqueta: 'Sin descuentos', monto: 0 }];
    }
    if (filas.length > FILAS_DETALLE) {
      const resto = filas.slice(FILAS_DETALLE - 1);
      return [
        ...filas.slice(0, FILAS_DETALLE - 1),
        { etiqueta: `Otros préstamos (${resto.length})`, monto: resto.reduce((s, f) => s + f.monto, 0) },
      ];
    }
    return filas;
  }

  /** "N° 1: Bs 10.500,00 · N° 2: Bs 2.500,00" (saldo tras el descuento). */
  private textoSaldosPrestamos(boleta: BoletaPago): string {
    return this.descuentosOrdenados(boleta)
      .map((d) => `N° ${d.prestamo?.numero ?? ''}: Bs ${this.formatearMonto(d.saldo)}`)
      .join('   ·   ');
  }

  // ------------------------------------------------------------------ helpers de dibujo
  private campo(
    doc: any,
    x: number,
    y: number,
    ancho: number,
    etiqueta: string,
    valor: string,
    anchoEtiqueta: number,
  ) {
    doc.font('Helvetica-Bold').fontSize(8).text(etiqueta, x, y, { width: anchoEtiqueta });
    this.lineaPuntosConTexto(doc, x + anchoEtiqueta, y, ancho - anchoEtiqueta, valor);
  }

  private filaEtiquetaValor(
    doc: any,
    x: number,
    y: number,
    ancho: number,
    alto: number,
    etiqueta: string,
    valor: string,
  ) {
    const anchoEtiqueta = ancho * 0.45;
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

  private lineaPuntosConTexto(doc: any, x: number, y: number, ancho: number, texto: string) {
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(this.recortar(doc, texto ?? '', ancho), x, y, { width: ancho, lineBreak: false });
    doc
      .lineWidth(0.5)
      .dash(1, { space: 2 })
      .strokeColor('#999999')
      .moveTo(x, y + 11)
      .lineTo(x + ancho, y + 11)
      .stroke();
    doc.undash().strokeColor('#000000');
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

  /** Recorta el texto (con "…") para que entre en una sola línea del ancho dado. */
  private recortar(doc: any, texto: string, ancho: number): string {
    if (doc.widthOfString(texto) <= ancho) return texto;
    let t = texto;
    while (t.length > 1 && doc.widthOfString(`${t}…`) > ancho) {
      t = t.slice(0, -1);
    }
    return `${t.trimEnd()}…`;
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

  private datosEmpleado(boleta: BoletaPago): { nombre: string; ci: string } {
    const p = boleta.persona;
    return {
      nombre: [p?.nombres, p?.apellidoPaterno, p?.apellidoMaterno]
        .filter(Boolean)
        .join(' ')
        .trim()
        .toUpperCase(),
      ci: p?.numeroDocumento ?? '',
    };
  }

  private formatearMonto(monto: number | string): string {
    return new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(monto ?? 0));
  }

  private formatearFechaLarga(fecha: string): string {
    if (!fecha) return '';
    const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return fecha;
    return `${dia} de ${MESES[mes - 1]} de ${anio}`;
  }

  private formatearFechaCorta(fecha: string): string {
    if (!fecha) return '';
    const [anio, mes, dia] = fecha.slice(0, 10).split('-');
    if (!anio || !mes || !dia) return fecha;
    return `${dia}/${mes}/${anio}`;
  }
}
