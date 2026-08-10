import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import * as fs from 'fs';
import { ValorizacionMineral } from '../entities/valorizacion/valorizacion-mineral.entity';
import { Usuario } from 'src/security/entities/usuario.entity';

const LOGO_PATH = join(process.cwd(), 'uploads', 'logo.png');

@Injectable()
export class ValorizacionMineralPdfService {
  //-------------------------------------------------
  // Impresión en hoja carta
  //-------------------------------------------------

  async generarPdf(
    valorizacion: ValorizacionMineral,
    liquidador?: Usuario,
  ): Promise<Buffer> {
    const anchoPagina = 612; // LETTER (8.5in)
    const margen = 30;
    const ancho = anchoPagina - margen * 2;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margin: margen,
        bufferPages: true,
      });

      const buffers: Buffer[] = [];

      doc.on('data', (buffer) => buffers.push(buffer));

      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc.on('error', reject);

      this.dibujarCabecera(doc, valorizacion, margen, ancho);
      this.dibujarInformacion(doc, valorizacion, margen, ancho);
      this.dibujarSeccionesEnColumnas(doc, valorizacion, margen, ancho);
      this.dibujarFirmas(doc, valorizacion, margen, ancho, liquidador);

      doc.end();
    });
  }

  //-------------------------------------------------
  // Cabecera (logo, título, numeración)
  //-------------------------------------------------

  private dibujarCabecera(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    doc.y = doc.page.margins.top;

    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, margen, doc.y, { width: 100 });
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('VALORIZACIÓN DE MINERALES', margen, doc.y + 4, {
        width: ancho,
        align: 'center',
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(
        `No: ${String(valorizacion.id).padStart(4, '0')}`,
        margen,
        doc.y + 4,
        {
          width: ancho,
          align: 'right',
        },
      );

    doc.y += 10;

    this.linea(doc, margen, ancho, doc.y);

    doc.y += 8;
  }

  //-------------------------------------------------
  // Información general (producto, cliente, lote, fechas, cooperativa)
  //-------------------------------------------------

  private dibujarInformacion(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    const recepcion = valorizacion.recepcionMineral;
    const persona = recepcion?.persona;

    const producto =
      (valorizacion.detalles ?? [])
        .map((detalle) => detalle.mineral?.descripcion)
        .filter((descripcion) => !!descripcion)
        .join(', ') || '--';

    const nombreCliente = this.nombreCompleto(persona);

    const col1 = Math.round(ancho * 0.1);
    const col2 = Math.round(ancho * 0.4);
    const col3 = Math.round(ancho * 0.15);
    const col4 = ancho - col1 - col2 - col3;

    const tableInfo = {
      headers: [
        { label: '', property: 'col1', width: col1, headerOpacity: '0.0' },
        { label: '', property: 'col2', width: col2, headerOpacity: '0.0' },
        { label: '', property: 'col3', width: col3, headerOpacity: '0.0' },
        { label: '', property: 'col4', width: col4, headerOpacity: '0.0' },
      ],
      datas: [
        {
          col1: 'bold:Producto:',
          col2: producto,
          col3: 'bold:Fecha Entrega:',
          col4: this.formatearFecha(recepcion?.fechaRecepcion),
        },
        {
          col1: 'bold:Cliente:',
          col2: `${nombreCliente}   C.I.: ${persona?.numeroDocumento ?? '--'}`,
          col3: 'bold:Fecha Transacción:',
          col4: this.formatearFecha(valorizacion.fechaValorizacion),
        },
        {
          col1: 'bold:Lote:',
          col2: recepcion?.codigoOperacion ?? '--',
          col3: `bold:${persona?.actorProductivoMinero?.tipoActorProductivoMinero?.descripcion ?? '--'}:`,
          col4: persona?.actorProductivoMinero?.nombre ?? '--',
        },
      ],
      options: {
        divider: {
          header: { disabled: true, width: 0.0, opacity: 0.0 },
          horizontal: { disabled: true, width: 0.5, opacity: 0.5 },
        },
      },
    };

    const alturaTabla = this.calcularAlturaFilas(
      doc,
      tableInfo.datas,
      { col1, col2, col3, col4 },
      8,
      3,
    );

    doc.save();
    doc.rect(margen, doc.y, ancho, alturaTabla).fill('#D9D9D9');
    doc.restore();

    doc.x = margen;
    doc.table(tableInfo, {
      columnSpacing: 1,
      prepareRow: () => {
        doc.font('Helvetica').fontSize(8);
        doc.x = margen;
      },
    });

    doc.y += 6;
  }

  //-------------------------------------------------
  // Distribución en dos columnas: pesos/leyes + resultado económico
  // a la izquierda, descuentos de ley a la derecha
  //-------------------------------------------------

  private dibujarSeccionesEnColumnas(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    const espacioEntreColumnas = 10;
    const anchoColumna = Math.round((ancho - espacioEntreColumnas) / 2);
    const xIzquierda = margen;
    const xDerecha = margen + anchoColumna + espacioEntreColumnas;

    const yInicio = doc.y;

    doc.y = yInicio;
    this.dibujarPesosYLeyes(doc, valorizacion, xIzquierda, anchoColumna);
    this.dibujarResultadoEconomico(doc, valorizacion, xIzquierda, anchoColumna);
    const yFinIzquierda = doc.y;

    doc.y = yInicio;
    this.dibujarDescuentosDeLey(doc, valorizacion, xDerecha, anchoColumna);
    const yFinDerecha = doc.y;

    doc.y = Math.max(yFinIzquierda, yFinDerecha);
  }

  //-------------------------------------------------
  // Pesos y leyes del mineral
  //-------------------------------------------------

  private dibujarPesosYLeyes(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    const detalles = valorizacion.detalles ?? [];

    const filas: Record<string, any>[] = [
      {
        col1: 'bold:Peso Bruto (Kg):',
        col2: this.formatearNumero(valorizacion.pesoBrutoHumedoKilogramos),
      },
      {
        col1: 'bold:Peso Neto (Kg):',
        col2: this.formatearNumero(
          valorizacion.pesoNetoSecoKilogramos ??
            valorizacion.pesoNetoHumedoKilogramos,
        ),
      },
    ];

    detalles.forEach((detalle) => {
      const simbolo = detalle.mineral?.simbolo?.toUpperCase() ?? '--';

      filas.push({
        col1: `bold:Ley ${simbolo} (${detalle.leyUnidad ?? '%'}):`,
        col2: this.formatearNumero(detalle.ley),
      });
    });

    this.dibujarTablaDosColumnas(doc, filas, margen, ancho);

    doc.y += 6;
  }

  //-------------------------------------------------
  // Descuentos de ley (regalía minera y aportes)
  //-------------------------------------------------

  private dibujarDescuentosDeLey(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('DESCUENTOS DE LEY', margen, doc.y, { width: ancho });

    doc.y += 3;

    const calculos = valorizacion.calculos ?? [];
    const aportes = valorizacion.calculoAportes ?? [];

    const col1 = Math.round(ancho * 0.55);
    const col2 = Math.round(ancho * 0.2);
    const col3 = ancho - col1 - col2;

    const datas: Record<string, any>[] = [];

    calculos.forEach((calculo) => {
      datas.push({
        col1: `bold:${calculo.tipoCalculoValorizacion?.descripcion ?? '--'}`,
        col2: '',
        col3: `${this.formatearNumero(calculo.importeBolivianos)} Bs.`,
      });
    });

    aportes.forEach((aporte) => {
      datas.push({
        col1: `bold:${aporte.entidadAporte?.descripcion ?? '--'}`,
        col2: `${this.formatearNumero(aporte.porcentajeAporte)} %`,
        col3: `${this.formatearNumero(aporte.importeBolivianos)} Bs.`,
      });
    });

    const totalDescuentos =
      calculos.reduce(
        (acumulado, calculo) =>
          acumulado + Number(calculo.importeBolivianos ?? 0),
        0,
      ) +
      aportes.reduce(
        (acumulado, aporte) =>
          acumulado + Number(aporte.importeBolivianos ?? 0),
        0,
      );

    datas.push({
      col1: 'bold:Descuento Total:',
      col2: '',
      col3: `bold:${this.formatearNumero(totalDescuentos)} Bs.`,
    });

    const tableDescuentos = {
      headers: [
        { label: '', property: 'col1', width: col1, headerOpacity: '0.0' },
        {
          label: '',
          property: 'col2',
          width: col2,
          align: 'right',
          headerOpacity: '0.0',
        },
        {
          label: '',
          property: 'col3',
          width: col3,
          align: 'right',
          headerOpacity: '0.0',
        },
      ],
      datas,
      options: {
        divider: {
          header: { disabled: true, width: 0.0, opacity: 0.0 },
          horizontal: { disabled: true, width: 0.5, opacity: 0.5 },
        },
      },
    };

    doc.x = margen;
    doc.table(tableDescuentos, {
      columnSpacing: 2,
      prepareRow: () => {
        doc.font('Helvetica').fontSize(8);
        doc.x = margen;
      },
    });

    doc.y += 6;
  }

  //-------------------------------------------------
  // Resultado económico (precio, líquido pagable, anticipo, saldo)
  //-------------------------------------------------

  private dibujarResultadoEconomico(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    const detalles = valorizacion.detalles ?? [];

    const filas: Record<string, any>[] = [];

    detalles
      .filter(
        (detalle) =>
          detalle.precioKilo !== null && detalle.precioKilo !== undefined,
      )
      .forEach((detalle) => {
        const simbolo = detalle.mineral?.simbolo?.toUpperCase() ?? '--';

        filas.push({
          col1: `bold:Precio Kilo ${simbolo}:`,
          col2: `${this.formatearNumero(detalle.precioKilo)} Bs.`,
        });
      });

    filas.push(
      {
        col1: 'bold:Líquido Pagable:',
        col2: `${this.formatearNumero(valorizacion.liquidoPagableBolivianos)} Bs.`,
      },
      {
        col1: 'bold:Anticipo:',
        col2: `${this.formatearNumero(Number(valorizacion.anticipo ?? 0))} Bs.`,
      },
    );

    if (
      valorizacion.otrosAnticipo !== null &&
      valorizacion.otrosAnticipo !== undefined &&
      Number(valorizacion.otrosAnticipo) !== 0
    ) {
      filas.push({
        col1: 'bold:Otros Anticipos:',
        col2: `${this.formatearNumero(valorizacion.otrosAnticipo)} Bs.`,
      });
    }

    if (
      valorizacion.totalAportesBolivianos !== null &&
      valorizacion.totalAportesBolivianos !== undefined &&
      Number(valorizacion.totalAportesBolivianos) !== 0
    ) {
      filas.push({
        col1: 'bold:Total Descuentos de Ley:',
        col2: `${this.formatearNumero(valorizacion.totalAportesBolivianos)} Bs.`,
      });
    }

    if (
      valorizacion.ajusteTransporte !== null &&
      valorizacion.ajusteTransporte !== undefined &&
      Number(valorizacion.ajusteTransporte) !== 0
    ) {
      filas.push({
        col1: 'bold:Transporte:',
        col2: `${this.formatearNumero(valorizacion.ajusteTransporte)} Bs.`,
      });
    }

    filas.push({
      col1: 'bold:Saldo a Pagar:',
      col2: {
        label: `bold:${this.formatearNumero(
          valorizacion.saldoPagarBolivianos,
        )} Bs.`,
        options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
      },
    });

    this.dibujarTablaDosColumnas(doc, filas, margen, ancho);

    doc.y += 10;
  }

  //-------------------------------------------------
  // Firmas
  //-------------------------------------------------

  private dibujarFirmas(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
    liquidador?: Usuario,
  ) {
    const persona = valorizacion.recepcionMineral?.persona;

    const nombreLiquidador = liquidador?.persona
      ? this.nombreCompleto(liquidador.persona)
      : (liquidador?.usuario ?? '--');

    const mitad = ancho / 2;

    const yLinea = doc.y + 30;

    doc
      .moveTo(margen, yLinea)
      .lineTo(margen + mitad - 15, yLinea)
      .stroke();
    doc
      .moveTo(margen + mitad + 15, yLinea)
      .lineTo(margen + ancho, yLinea)
      .stroke();

    doc.font('Helvetica').fontSize(8);

    doc.text(`Liquidador: ${nombreLiquidador}`, margen, yLinea + 4, {
      width: mitad - 15,
      align: 'center',
    });

    doc.text(
      `C.I.: ${liquidador?.persona?.numeroDocumento ?? '--'}`,
      margen,
      yLinea + 16,
      { width: mitad - 15, align: 'center' },
    );

    doc.text(
      `Cliente: ${this.nombreCompleto(persona)}`,
      margen + mitad + 15,
      yLinea + 4,
      { width: mitad - 15, align: 'center' },
    );

    doc.text(
      `C.I.: ${persona?.numeroDocumento ?? '--'}`,
      margen + mitad + 15,
      yLinea + 16,
      {
        width: mitad - 15,
        align: 'center',
      },
    );

    doc.text(
      `Teléfono: ${persona?.celular ?? '--'}`,
      margen + mitad + 15,
      yLinea + 28,
      {
        width: mitad - 15,
        align: 'center',
      },
    );
  }

  //-------------------------------------------------
  // Auxiliares
  //-------------------------------------------------

  private dibujarTablaDosColumnas(
    doc: any,
    filas: Record<string, any>[],
    margen: number,
    ancho: number,
  ) {
    const col1 = Math.round(ancho * 0.4);
    const col2 = ancho - col1;

    const tabla = {
      headers: [
        { label: '', property: 'col1', width: col1, headerOpacity: '0.0' },
        {
          label: '',
          property: 'col2',
          width: col2,
          align: 'right',
          headerOpacity: '0.0',
        },
      ],
      datas: filas,
      options: {
        divider: {
          header: { disabled: true, width: 0.0, opacity: 0.0 },
          horizontal: { disabled: true, width: 0.5, opacity: 0.5 },
        },
      },
    };

    doc.x = margen;
    doc.table(tabla, {
      columnSpacing: 2,
      prepareRow: () => {
        doc.font('Helvetica').fontSize(8);
        doc.x = margen;
      },
    });
  }

  private calcularAlturaFilas(
    doc: any,
    filas: Record<string, any>[],
    anchosColumnas: Record<string, number>,
    fontSize: number,
    columnSpacing: number,
  ): number {
    doc.save();
    doc.font('Helvetica').fontSize(fontSize);

    const altura = filas.reduce((total, fila) => {
      const alturaFila = Object.keys(anchosColumnas).reduce((max, columna) => {
        const texto = String(fila[columna] ?? '').replace(/^bold:/, '');
        const alturaTexto = doc.heightOfString(texto, {
          width: anchosColumnas[columna],
          align: 'left',
        });
        return Math.max(max, alturaTexto);
      }, 0);

      return total + alturaFila + columnSpacing;
    }, 0);

    doc.restore();

    return altura;
  }

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

  private formatearNumero(valor: number | string | null | undefined): string {
    if (valor === null || valor === undefined || valor === '') {
      return '--';
    }

    return Number(valor).toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private formatearFecha(fecha: Date | string | null | undefined): string {
    if (!fecha) {
      return '--';
    }

    const valor = fecha instanceof Date ? fecha.toISOString() : fecha;

    const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) {
      return valor;
    }

    const [, anio, mes, dia] = match;

    return `${dia}/${mes}/${anio}`;
  }
}
