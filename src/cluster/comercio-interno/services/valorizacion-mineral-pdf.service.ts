import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import * as fs from 'fs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValorizacionMineral } from '../entities/valorizacion/valorizacion-mineral.entity';
import { ValorizacionCalculo } from '../entities/valorizacion/valorizacion-calculo.entity';
import { TipoCalculoValorizacion } from 'src/cluster/parametricas/entities/tipo-calculo-valorizacion.entity';
import { Usuario } from 'src/security/entities/usuario.entity';

const LOGO_PATH = join(process.cwd(), 'uploads', 'logo.png');

// Codificaciones que usan el formato "LIQUIDACIÓN PROVISIONAL"
// (valorización internacional en USD, con penalidades y gastos de
// tratamiento) en lugar del formato simple de ICC (Plata boliviana).
const CODIFICACIONES_LIQUIDACION_PROVISIONAL = ['BCL', 'BZL'];

// Codificaciones que usan el formato "LIQUIDACIÓN DE MINERAL" (ticket
// simple por tonelada: cargas mixtas sin cotización internacional).
const CODIFICACIONES_LIQUIDACION_MINERAL = ['RAM'];

@Injectable()
export class ValorizacionMineralPdfService {
  constructor(
    @InjectRepository(TipoCalculoValorizacion, 'ci')
    private readonly tipoCalculoRepository: Repository<TipoCalculoValorizacion>,
  ) {}

  //-------------------------------------------------
  // Impresión en hoja carta
  //-------------------------------------------------

  async generarPdf(
    valorizacion: ValorizacionMineral,
    liquidador?: Usuario,
  ): Promise<Buffer> {
    const anchoPagina = 612; // LETTER (8.5in)

    const codigoCodificacion =
      valorizacion.recepcionMineral?.codificacion?.codigo;

    const esBCLoBZL =
      CODIFICACIONES_LIQUIDACION_PROVISIONAL.includes(codigoCodificacion);

    const esRAM =
      CODIFICACIONES_LIQUIDACION_MINERAL.includes(codigoCodificacion);

    // BCL/BZL y RAM imprimen varias secciones propias (leyes, pesos,
    // cotización, descuentos, totales) y deben entrar completos en una
    // sola hoja carta, por lo que usan un margen más ajustado que AC/ICC.
    const margen = esBCLoBZL || esRAM ? 20 : 30;
    const ancho = anchoPagina - margen * 2;

    // El catálogo de penalidades/gastos de tratamiento se imprime completo
    // (aunque no todos los elementos tengan un cálculo registrado), por lo
    // que se obtiene antes de armar el documento.
    const catalogoTiposCalculo = esBCLoBZL
      ? await this.tipoCalculoRepository.find({
          where: { activo: true },
          order: { idTipoCalculo: 'ASC', descripcion: 'ASC' },
        })
      : [];

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

      if (esBCLoBZL) {
        this.dibujarLiquidacionProvisional(
          doc,
          valorizacion,
          margen,
          ancho,
          catalogoTiposCalculo,
          liquidador,
        );
      } else if (esRAM) {
        this.dibujarLiquidacionMineralSimple(doc, valorizacion, margen, ancho);
      } else {
        //es AC o ICC
        this.dibujarCabecera(doc, valorizacion, margen, ancho);
        this.dibujarInformacion(doc, valorizacion, margen, ancho);
        this.dibujarSeccionesEnColumnas(doc, valorizacion, margen, ancho);
        this.dibujarFirmas(doc, valorizacion, margen, ancho, liquidador);
      }

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
    titulo: string = 'VALORIZACIÓN DE MINERALES',
  ) {
    doc.y = doc.page.margins.top;

    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, margen, doc.y, { width: 100 });
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(titulo, margen, doc.y + 4, {
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

    const filas: Record<string, any>[] = [
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
    ];

    this.dibujarTablaInformacion(
      doc,
      filas,
      { col1, col2, col3, col4 },
      margen,
      ancho,
    );
  }

  //-------------------------------------------------
  // Formato compartido de la sección de información: caja con fondo gris
  // detrás de una tabla libre. Reutilizado por dibujarInformacion,
  // dibujarInfoLiquidacion y dibujarDatosLiquidacionMineral, cada uno con
  // sus propias columnas y filas.
  //-------------------------------------------------

  private dibujarTablaInformacion(
    doc: any,
    filas: Record<string, any>[],
    anchosColumnas: Record<string, number>,
    margen: number,
    ancho: number,
  ) {
    const headers = Object.keys(anchosColumnas).map((propiedad) => ({
      label: '',
      property: propiedad,
      width: anchosColumnas[propiedad],
      headerOpacity: '0.0',
    }));

    const tableInfo = {
      headers,
      datas: filas,
      options: {
        divider: {
          header: { disabled: true, width: 0.0, opacity: 0.0 },
          horizontal: { disabled: true, width: 0.5, opacity: 0.5 },
        },
      },
    };

    const alturaTabla = this.calcularAlturaFilas(
      doc,
      filas,
      anchosColumnas,
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
    ];

    // Solo algunas codificaciones (ej. BCL) descuentan humedad antes de la
    // merma; en las demás este campo llega null y se omite la fila.
    if (
      valorizacion.pesoBrutoSecoKilogramos !== null &&
      valorizacion.pesoBrutoSecoKilogramos !== undefined
    ) {
      filas.push({
        col1: 'bold:Peso Bruto Seco (Kg):',
        col2: this.formatearNumero(valorizacion.pesoBrutoSecoKilogramos),
      });
    }

    filas.push({
      col1: 'bold:Peso Neto (Kg):',
      col2: this.formatearNumero(valorizacion.pesoNetoSecoKilogramos),
    });

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
        col2: `${this.formatearNumero(valorizacion.totalValorBrutoBolivianos)} Bs.`,
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
          valorizacion.totalValorLiquidoVentaBolivianos,
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
  // Liquidación provisional (codificaciones BCL / BZL)
  //
  // Valorización internacional en USD: leyes pagables + penalidades por
  // elemento + gastos de tratamiento (maquila), convertida a bolivianos
  // recién en el líquido pagable final.
  //-------------------------------------------------

  private dibujarLiquidacionProvisional(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
    catalogoTiposCalculo: TipoCalculoValorizacion[],
    liquidador?: Usuario,
  ) {
    const gastosCatalogo = catalogoTiposCalculo.filter(
      (t) => t.idTipoCalculo === 1,
    );
    const penalidadesCatalogo = catalogoTiposCalculo.filter(
      (t) => t.idTipoCalculo === 2,
    );

    const calculos = valorizacion.calculos ?? [];
    const calculoAl = calculos.find(
      (c) => c.tipoCalculoValorizacion?.descripcion?.toUpperCase() === 'AL',
    );
    const otrosCalculos = calculos.filter(
      (c) => c.tipoCalculoValorizacion?.idTipoCalculo === 3 && c !== calculoAl,
    );

    this.dibujarCabecera(
      doc,
      valorizacion,
      margen,
      ancho,
      'LIQUIDACIÓN PROVISIONAL',
    );

    this.dibujarInfoLiquidacion(doc, valorizacion, margen, ancho);
    this.dibujarMineralesPesosCotizacion(
      doc,
      valorizacion,
      margen,
      ancho,
      penalidadesCatalogo,
    );
    this.dibujarPagosPorTm(doc, valorizacion, margen, ancho);

    const totalGastos = this.dibujarGastosTratamiento(
      doc,
      valorizacion,
      margen,
      ancho,
      gastosCatalogo,
    );
    const totalPenalidades = this.dibujarPenalidades(
      doc,
      valorizacion,
      margen,
      ancho,
      penalidadesCatalogo,
    );

    this.dibujarResumenLote(
      doc,
      valorizacion,
      margen,
      ancho,
      totalGastos + totalPenalidades,
      calculoAl,
    );
    this.dibujarAportesYRetenciones(
      doc,
      valorizacion,
      margen,
      ancho,
      otrosCalculos,
    );
    this.dibujarFirmasTriple(doc, valorizacion, margen, ancho, liquidador);
  }

  private dibujarInfoLiquidacion(
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

    const filas: Record<string, any>[] = [
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
    ];

    this.dibujarTablaInformacion(
      doc,
      filas,
      { col1, col2, col3, col4 },
      margen,
      ancho,
    );
  }

  //-------------------------------------------------
  // Minerales/Leyes + Pesos + Cotización LME (3 columnas)
  //-------------------------------------------------

  private dibujarMineralesPesosCotizacion(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
    penalidadesCatalogo: TipoCalculoValorizacion[],
  ) {
    const espacio = 10;
    const anchoColumna = Math.round((ancho - espacio * 2) / 3);
    const xMinerales = margen;
    const xPesos = margen + anchoColumna + espacio;
    const xCotizacion = margen + (anchoColumna + espacio) * 2;

    const detalles = valorizacion.detalles ?? [];
    const calculos = valorizacion.calculos ?? [];

    const yInicio = doc.y;

    // --- Minerales / Leyes ---
    doc.y = yInicio;
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('MINERALES: LEYES', xMinerales, doc.y, { width: anchoColumna });
    doc.y += 2;

    const filasMinerales: Record<string, any>[] = detalles.map((detalle) => ({
      col1: `bold:${detalle.mineral?.simbolo?.toUpperCase() ?? '--'}`,
      col2: this.formatearNumero(detalle.ley),
    }));

    penalidadesCatalogo.forEach((tipo) => {
      const calculo = calculos.find(
        (c) => c.idTipoCalculoValorizacion === tipo.id,
      );
      const ley = calculo?.extras?.ley;

      filasMinerales.push({
        col1: `bold:${tipo.descripcion}`,
        col2:
          ley === null || ley === undefined
            ? '--.--'
            : this.formatearNumero(ley),
      });
    });

    this.dibujarTablaDosColumnas(
      doc,
      filasMinerales,
      xMinerales,
      anchoColumna,
      7,
    );
    const yFinMinerales = doc.y;

    // --- Pesos ---
    doc.y = yInicio;
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('PESOS', xPesos, doc.y, { width: anchoColumna });
    doc.y += 2;

    const aguaKilogramos =
      valorizacion.pesoBrutoHumedoKilogramos !== null &&
      valorizacion.pesoBrutoHumedoKilogramos !== undefined &&
      valorizacion.pesoBrutoSecoKilogramos !== null &&
      valorizacion.pesoBrutoSecoKilogramos !== undefined
        ? Number(valorizacion.pesoBrutoHumedoKilogramos) -
          Number(valorizacion.pesoBrutoSecoKilogramos)
        : null;

    const filasPesos: Record<string, any>[] = [
      {
        col1: 'bold:PHB (Kg):',
        col2: this.formatearNumero(valorizacion.pesoBrutoHumedoKilogramos),
      },
      {
        col1: `bold:H2O (${this.formatearNumero(valorizacion.humedadPorcentaje)}%):`,
        col2:
          aguaKilogramos === null ? '--' : this.formatearNumero(aguaKilogramos),
      },
      {
        col1: 'bold:PSB (Kg):',
        col2: this.formatearNumero(valorizacion.pesoBrutoSecoKilogramos),
      },
      {
        col1: `bold:MERMA (${this.formatearNumero(valorizacion.mermaPorcentaje)}%):`,
        col2: this.formatearNumero(valorizacion.mermaKilogramos),
      },
      {
        col1: 'bold:PNS (Kg):',
        col2: this.formatearNumero(valorizacion.pesoNetoSecoKilogramos),
      },
    ];

    this.dibujarTablaDosColumnas(doc, filasPesos, xPesos, anchoColumna, 7);
    const yFinPesos = doc.y;

    // --- Cotización LME ---
    doc.y = yInicio;
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('COTIZACIÓN LME', xCotizacion, doc.y, { width: anchoColumna });
    doc.y += 2;

    const filasCotizacion: Record<string, any>[] = detalles.map((detalle) => ({
      col1: `bold:${detalle.mineral?.simbolo?.toUpperCase() ?? '--'}`,
      col2: this.formatearNumero(
        detalle.cotizacionAplicada ??
          detalle.cotizacionMineral?.cotizacionMineralDolares,
      ),
    }));

    this.dibujarTablaDosColumnas(
      doc,
      filasCotizacion,
      xCotizacion,
      anchoColumna,
      7,
    );
    const yFinCotizacion = doc.y;

    doc.y = Math.max(yFinMinerales, yFinPesos, yFinCotizacion) + 4;
  }

  //-------------------------------------------------
  // Pagos por TM (leyes pagables convertidas a precio USD/TM)
  //-------------------------------------------------

  private dibujarPagosPorTm(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    const detalles = valorizacion.detalles ?? [];

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('PAGOS POR TM', margen, doc.y, { width: ancho });
    doc.y += 2;

    const anchoMineral = Math.round(ancho * 0.15);
    const anchoLey = Math.round(ancho * 0.2);
    const anchoAjuste = Math.round(ancho * 0.2);
    const anchoFactor = Math.round(ancho * 0.15);

    const anchos = {
      mineral: anchoMineral,
      ley: anchoLey,
      ajuste: anchoAjuste,
      factor: anchoFactor,
      precio: ancho - anchoMineral - anchoLey - anchoAjuste - anchoFactor,
    };

    const datas = detalles.map((detalle) => ({
      mineral: detalle.mineral?.simbolo?.toUpperCase() ?? '--',
      ley: this.formatearNumero(detalle.ley),
      ajuste:
        detalle.ajustePuntosLey === null ||
        detalle.ajustePuntosLey === undefined
          ? '--'
          : this.formatearNumero(-Math.abs(Number(detalle.ajustePuntosLey))),
      factor:
        detalle.factorPorsentaje === null ||
        detalle.factorPorsentaje === undefined
          ? '--'
          : `${Math.round(Number(detalle.factorPorsentaje))}%`,
      precio: `${this.formatearNumero(detalle.precioUsdTm)} $us`,
    }));

    const tabla = {
      headers: [
        { label: 'Mineral', property: 'mineral', width: anchos.mineral },
        {
          label: 'Ley',
          property: 'ley',
          width: anchos.ley,
          align: 'right',
        },
        {
          label: 'Ajuste',
          property: 'ajuste',
          width: anchos.ajuste,
          align: 'right',
        },
        {
          label: 'Factor',
          property: 'factor',
          width: anchos.factor,
          align: 'right',
        },
        {
          label: 'Precio USD/TM',
          property: 'precio',
          width: anchos.precio,
          align: 'right',
        },
      ],
      datas,
    };

    doc.x = margen;
    doc.table(tabla, {
      columnSpacing: 2,
      prepareRow: () => {
        doc.font('Helvetica').fontSize(7);
        doc.x = margen;
      },
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(7),
    });

    const totalPagos = detalles.reduce(
      (acumulado, detalle) => acumulado + Number(detalle.precioUsdTm ?? 0),
      0,
    );

    this.dibujarTablaDosColumnas(
      doc,
      [
        {
          col1: 'bold:Total Pagos:',
          col2: `bold:${this.formatearNumero(totalPagos)} $us`,
        },
      ],
      margen,
      ancho,
      7,
    );

    doc.y += 4;
  }

  //-------------------------------------------------
  // Gastos de tratamiento (maquila, ajuste de maquila, refinación, etc)
  //-------------------------------------------------

  private dibujarGastosTratamiento(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
    gastosCatalogo: TipoCalculoValorizacion[],
  ): number {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('GASTOS DE TRATAMIENTO', margen, doc.y, { width: ancho });
    doc.y += 2;

    const calculos = (valorizacion.calculos ?? []).filter(
      (c) => c.tipoCalculoValorizacion?.idTipoCalculo === 1,
    );

    if (calculos.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(7)
        .text('Sin gastos de tratamiento registrados.', margen, doc.y, {
          width: ancho,
        });
      doc.y += 8;
      return 0;
    }

    const anchoDescripcion = Math.round(ancho * 0.3);
    const anchoActual = Math.round(ancho * 0.15);
    const anchoBase = Math.round(ancho * 0.15);
    const anchoEscalador = Math.round(ancho * 0.15);

    const anchos = {
      descripcion: anchoDescripcion,
      actual: anchoActual,
      base: anchoBase,
      escalador: anchoEscalador,
      importe:
        ancho - anchoDescripcion - anchoActual - anchoBase - anchoEscalador,
    };

    const datas = calculos.map((calculo) => {
      const extras = calculo.extras ?? {};

      return {
        descripcion: calculo.tipoCalculoValorizacion?.descripcion ?? '--',
        actual:
          extras.actual === undefined
            ? '--'
            : this.formatearNumero(extras.actual),
        base:
          extras.base === undefined ? '--' : this.formatearNumero(extras.base),
        escalador:
          extras.escalador === undefined
            ? '--'
            : this.formatearNumero(extras.escalador),
        importe: `${this.formatearNumero(calculo.importeBolivianos)} $us`,
      };
    });

    const tabla = {
      headers: [
        {
          label: 'Descripción',
          property: 'descripcion',
          width: anchos.descripcion,
        },
        {
          label: 'Actual',
          property: 'actual',
          width: anchos.actual,
          align: 'right',
        },
        {
          label: 'Base',
          property: 'base',
          width: anchos.base,
          align: 'right',
        },
        {
          label: 'Escalador',
          property: 'escalador',
          width: anchos.escalador,
          align: 'right',
        },
        {
          label: 'Importe',
          property: 'importe',
          width: anchos.importe,
          align: 'right',
        },
      ],
      datas,
    };

    doc.x = margen;
    doc.table(tabla, {
      columnSpacing: 2,
      prepareRow: () => {
        doc.font('Helvetica').fontSize(7);
        doc.x = margen;
      },
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(7),
    });

    doc.y += 4;

    return calculos.reduce(
      (acumulado, calculo) =>
        acumulado + Number(calculo.importeBolivianos ?? 0),
      0,
    );
  }

  //-------------------------------------------------
  // Penalidades por elemento (catálogo completo, con o sin cálculo)
  //-------------------------------------------------

  private dibujarPenalidades(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
    penalidadesCatalogo: TipoCalculoValorizacion[],
  ): number {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('PENALIDADES', margen, doc.y, { width: ancho });
    doc.y += 2;

    const calculos = valorizacion.calculos ?? [];

    const anchoElemento = Math.round(ancho * 0.12);
    const anchoLey = Math.round(ancho * 0.15);
    const anchoLibre = Math.round(ancho * 0.15);
    const anchoCargo = Math.round(ancho * 0.38);

    const anchos = {
      elemento: anchoElemento,
      ley: anchoLey,
      libre: anchoLibre,
      cargo: anchoCargo,
      importe: ancho - anchoElemento - anchoLey - anchoLibre - anchoCargo,
    };

    let totalPenalidades = 0;

    const datas = penalidadesCatalogo.map((tipo) => {
      const calculo = calculos.find(
        (c) => c.idTipoCalculoValorizacion === tipo.id,
      );
      const extras = tipo.extras ?? {};
      const ley = calculo?.extras?.ley;
      const importe = Number(calculo?.importeBolivianos ?? 0);

      totalPenalidades += importe;

      return {
        elemento: tipo.descripcion,
        ley:
          ley === null || ley === undefined
            ? '--.--'
            : this.formatearNumero(ley),
        libre:
          extras.leyLibre === undefined
            ? '--'
            : `${this.formatearNumero(extras.leyLibre)}${extras.unidadLey ?? ''}`,
        cargo:
          extras.cargo === undefined
            ? '--'
            : `${this.formatearNumero(extras.cargo)} ${extras.unidadCargo ?? ''} c/${extras.cada === undefined ? '--' : this.formatearNumero(extras.cada)}${extras.unidadLey ?? ''}`,
        importe: `${this.formatearNumero(calculo?.importeBolivianos ?? 0)} $us`,
      };
    });

    const tabla = {
      headers: [
        { label: 'Elemento', property: 'elemento', width: anchos.elemento },
        {
          label: 'Ley',
          property: 'ley',
          width: anchos.ley,
          align: 'right',
        },
        {
          label: 'Libre',
          property: 'libre',
          width: anchos.libre,
          align: 'right',
        },
        {
          label: 'Cargo',
          property: 'cargo',
          width: anchos.cargo,
          align: 'right',
        },
        {
          label: 'Importe',
          property: 'importe',
          width: anchos.importe,
          align: 'right',
        },
      ],
      datas,
    };

    doc.x = margen;
    doc.table(tabla, {
      columnSpacing: 2,
      prepareRow: () => {
        doc.font('Helvetica').fontSize(7);
        doc.x = margen;
      },
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(7),
    });

    doc.y += 4;

    return totalPenalidades;
  }

  //-------------------------------------------------
  // Resumen del lote: total deducciones, valor neto TM, AL (valoración del lote)
  //-------------------------------------------------

  private dibujarResumenLote(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
    totalDeducciones: number,
    calculoAl?: ValorizacionCalculo,
  ) {
    const filas: Record<string, any>[] = [
      {
        col1: 'bold:Total Deducciones:',
        col2: `${this.formatearNumero(totalDeducciones)} $us`,
      },
      {
        col1: 'bold:Valor Neto TM:',
        col2: {
          label: `bold:${this.formatearNumero(valorizacion.totalValorNetoVentaBolivianos)} Bs.`,
          options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
        },
      },
    ];

    if (calculoAl) {
      filas.push({
        col1: `bold:AL. (${this.formatearNumero(calculoAl.baseCalculo)}%) Valoración del Lote:`,
        col2: `bold:${this.formatearNumero(calculoAl.importeBolivianos)} $us`,
      });
    }

    this.dibujarTablaDosColumnas(doc, filas, margen, ancho, 7);

    doc.y += 4;
  }

  //-------------------------------------------------
  // Aportes y retenciones (entidades de aporte + otros descuentos: rollback, flete)
  //-------------------------------------------------

  private dibujarAportesYRetenciones(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
    otrosCalculos: ValorizacionCalculo[],
  ) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('APORTES Y RETENCIONES', margen, doc.y, { width: ancho });
    doc.y += 2;

    const aportes = valorizacion.calculoAportes ?? [];

    const col1 = Math.round(ancho * 0.55);
    const col2 = Math.round(ancho * 0.2);
    const col3 = ancho - col1 - col2;

    const datas: Record<string, any>[] = [];

    aportes.forEach((aporte) => {
      datas.push({
        col1: `bold:${aporte.entidadAporte?.descripcion ?? '--'}`,
        col2: `${this.formatearNumero(aporte.porcentajeAporte)} %`,
        col3: `${this.formatearNumero(aporte.importeBolivianos)} Bs.`,
      });
    });

    otrosCalculos.forEach((calculo) => {
      datas.push({
        col1: `bold:${calculo.tipoCalculoValorizacion?.descripcion ?? '--'}`,
        col2: this.formatearNumero(calculo.baseCalculo),
        col3: `${this.formatearNumero(calculo.importeBolivianos)} Bs.`,
      });
    });

    const tableAportes = {
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
    doc.table(tableAportes, {
      columnSpacing: 2,
      prepareRow: () => {
        doc.font('Helvetica').fontSize(7);
        doc.x = margen;
      },
    });

    doc.y += 4;

    this.dibujarTablaDosColumnas(
      doc,
      [
        {
          col1: 'bold:Líquido Pagable:',
          col2: `${this.formatearNumero(valorizacion.totalValorLiquidoVentaUsd)} $us`,
        },
        {
          col1: 'bold:Expresado en Bolivianos:',
          col2: {
            label: `bold:${this.formatearNumero(valorizacion.totalValorLiquidoVentaBolivianos)} Bs.`,
            options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
          },
        },
      ],
      margen,
      ancho,
      7,
    );

    doc.y += 6;
  }

  //-------------------------------------------------
  // Firmas (preparado por / aprobado por / interesado)
  //-------------------------------------------------

  private dibujarFirmasTriple(
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

    const tercio = ancho / 3;
    const margenInterno = 10;

    const yLinea = doc.y + 18;

    const columnas = [
      { x: margen, titulo: 'Preparado Por:', nombre: nombreLiquidador },
      {
        x: margen + tercio,
        titulo: 'Aprobado Por:',
        nombre: '--',
      },
      {
        x: margen + tercio * 2,
        titulo: 'Interesado Por:',
        nombre: this.nombreCompleto(persona),
      },
    ];

    columnas.forEach((columna) => {
      doc
        .moveTo(columna.x, yLinea)
        .lineTo(columna.x + tercio - margenInterno, yLinea)
        .stroke();

      doc.font('Helvetica').fontSize(7);

      doc.text(columna.nombre, columna.x, yLinea + 3, {
        width: tercio - margenInterno,
        align: 'center',
      });

      doc.text(columna.titulo, columna.x, yLinea + 12, {
        width: tercio - margenInterno,
        align: 'center',
      });
    });
  }

  //-------------------------------------------------
  // Liquidación de mineral (codificación RAM / CARGAS)
  //
  // Ticket simple de liquidación por tonelada, para lotes mixtos que no
  // usan cotización internacional (a diferencia de BCL/BZL): leyes por
  // mineral, peso seco, valor por tonelada y valoración del lote, seguido
  // de los descuentos (regalía y aportes) y el líquido pagable final.
  //-------------------------------------------------

  private dibujarLiquidacionMineralSimple(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    this.dibujarCabecera(
      doc,
      valorizacion,
      margen,
      ancho,
      'LIQUIDACIÓN DE MINERAL',
    );
    this.dibujarDatosLiquidacionMineral(doc, valorizacion, margen, ancho);
    this.dibujarLeyesPesoValor(doc, valorizacion, margen, ancho);
    this.dibujarDescuentosLiquidacionMineral(doc, valorizacion, margen, ancho);
    this.dibujarTotalesLiquidacionMineral(doc, valorizacion, margen, ancho);
    this.dibujarFirmasLiquidacionMineral(doc, valorizacion, margen, ancho);
  }

  private dibujarDatosLiquidacionMineral(
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

    const filas: Record<string, any>[] = [
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
    ];

    this.dibujarTablaInformacion(
      doc,
      filas,
      { col1, col2, col3, col4 },
      margen,
      ancho,
    );
  }

  //-------------------------------------------------
  // Leyes por mineral + Peso Seco + Valor Tonelada + Valoración del Lote,
  // dibujado como una grilla con bordes (no con la tabla libre del resto
  // del documento) para reproducir el ticket de liquidación.
  //-------------------------------------------------

  private dibujarLeyesPesoValor(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    const detalles = valorizacion.detalles ?? [];

    const yInicio = doc.y;
    const alturaFila = 12;
    const relleno = 5;
    const anchoIzquierda = Math.round(ancho * 0.45);
    const anchoDerecha = ancho - anchoIzquierda;
    const xDerecha = margen + anchoIzquierda;

    // La derecha siempre dibuja 2 filas fijas (Peso Seco, Valor Tonelada);
    // la altura del bloque superior debe cubrir la columna más alta.
    const filasSuperior = Math.max(detalles.length, 1, 2);
    const alturaSuperior = filasSuperior * alturaFila + relleno * 2;
    const alturaInferior = 18;
    const alturaTotal = alturaSuperior + alturaInferior;

    doc.save();
    doc.lineWidth(0.8);
    doc.rect(margen, yInicio, ancho, alturaTotal).stroke();
    doc
      .moveTo(xDerecha, yInicio)
      .lineTo(xDerecha, yInicio + alturaSuperior)
      .stroke();
    doc
      .moveTo(margen, yInicio + alturaSuperior)
      .lineTo(margen + ancho, yInicio + alturaSuperior)
      .stroke();
    doc.restore();

    // --- Leyes por mineral (izquierda) ---
    const anchoEtiquetaIzquierda = Math.round(anchoIzquierda * 0.5);
    const anchoValorIzquierda =
      anchoIzquierda - relleno * 2 - anchoEtiquetaIzquierda;

    let y = yInicio + relleno;

    if (detalles.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .text('Sin minerales registrados.', margen + relleno, y, {
          width: anchoIzquierda - relleno * 2,
        });
    }

    detalles.forEach((detalle) => {
      const simbolo =
        detalle.mineral?.simbolo?.toUpperCase() ??
        detalle.mineral?.descripcion?.toUpperCase() ??
        '--';

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(`LEY ${simbolo}:`, margen + relleno, y, {
          width: anchoEtiquetaIzquierda,
        });

      doc
        .font('Helvetica')
        .fontSize(8)
        .text(
          this.formatearNumero(detalle.ley),
          margen + relleno + anchoEtiquetaIzquierda,
          y,
          { width: anchoValorIzquierda, align: 'right' },
        );

      y += alturaFila;
    });

    // --- Peso Seco / Valor Tonelada (derecha) ---
    const anchoEtiquetaDerecha = Math.round(anchoDerecha * 0.6);
    const anchoValorDerecha = anchoDerecha - relleno * 2 - anchoEtiquetaDerecha;

    let yDerecha = yInicio + relleno;

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Peso Seco (Kg):', xDerecha + relleno, yDerecha, {
        width: anchoEtiquetaDerecha,
      });
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(
        this.formatearNumero(valorizacion.pesoNetoSecoKilogramos),
        xDerecha + relleno + anchoEtiquetaDerecha,
        yDerecha,
        { width: anchoValorDerecha, align: 'right' },
      );

    yDerecha += alturaFila;

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Valor Tonelada Bs.:', xDerecha + relleno, yDerecha, {
        width: anchoEtiquetaDerecha,
      });
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(
        this.formatearNumero(valorizacion.totalValorToneladaBolivianos),
        xDerecha + relleno + anchoEtiquetaDerecha,
        yDerecha,
        { width: anchoValorDerecha, align: 'right' },
      );

    // --- Valoración del lote (fila inferior, ancho completo) ---
    const yInferior = yInicio + alturaSuperior;

    doc.save();
    doc
      .rect(margen + 0.5, yInferior + 0.5, ancho - 2, alturaInferior - 2)
      .fill('#D9D9D9');
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('VALORACIÓN LOTE Bs.:', margen + relleno, yInferior + 4, {
      width: Math.round(ancho * 0.6),
    });
    doc.text(
      this.formatearNumero(valorizacion.totalValorBrutoBolivianos),
      margen,
      yInferior + 4,
      { width: ancho - relleno, align: 'right' },
    );

    doc.y = yInferior + alturaInferior + 6;
  }

  //-------------------------------------------------
  // Descuentos: regalía y aportes registrados en la valorización (no se
  // imprime un catálogo fijo, a diferencia de las penalidades de
  // BCL/BZL, porque las entidades de aporte son un catálogo abierto).
  //-------------------------------------------------

  private dibujarDescuentosLiquidacionMineral(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    const aportes = valorizacion.calculoAportes ?? [];

    const col1 = Math.round(ancho * 0.55);
    const col2 = Math.round(ancho * 0.2);
    const col3 = ancho - col1 - col2;

    const datas: Record<string, any>[] = aportes.map((aporte) => ({
      col1: aporte.entidadAporte?.descripcion ?? '--',
      col2:
        aporte.porcentajeAporte === null ||
        aporte.porcentajeAporte === undefined
          ? ''
          : `${this.formatearNumero(aporte.porcentajeAporte)} %`,
      col3: this.formatearNumero(aporte.importeBolivianos),
    }));

    if (datas.length === 0) {
      datas.push({
        col1: 'Sin descuentos registrados.',
        col2: '',
        col3: '',
      });
    }

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
    doc.table(tabla, {
      columnSpacing: 2,
      prepareRow: () => {
        doc.font('Helvetica').fontSize(7);
        doc.x = margen;
      },
    });

    doc.y += 3;
    this.linea(doc, margen, ancho, doc.y);
    doc.y += 3;

    this.dibujarTablaDosColumnas(
      doc,
      [
        {
          col1: 'bold:TOTAL DESCUENTOS:',
          col2: `bold:${this.formatearNumero(valorizacion.totalAportesBolivianos)}`,
        },
      ],
      margen,
      ancho,
      7,
    );

    doc.y += 4;
  }

  //-------------------------------------------------
  // Total liquidación, deducciones (anticipos) y líquido pagable final.
  //-------------------------------------------------

  private dibujarTotalesLiquidacionMineral(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    this.dibujarTablaDosColumnas(
      doc,
      [
        {
          col1: 'bold:TOTAL LIQUIDACIÓN:',
          col2: `bold:${this.formatearNumero(valorizacion.totalValorNetoVentaBolivianos)}`,
        },
      ],
      margen,
      ancho,
      7,
    );

    doc.y += 4;

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('DEDUCCIONES:', margen, doc.y, { width: ancho });

    doc.y += 2;

    this.dibujarTablaDosColumnas(
      doc,
      [
        {
          col1: 'Otros Anticipos:',
          col2: this.formatearNumero(valorizacion.otrosAnticipo),
        },
        {
          col1: 'Anticipo:',
          col2: this.formatearNumero(valorizacion.anticipo),
        },
      ],
      margen,
      ancho,
      7,
    );

    doc.y += 4;

    this.dibujarTablaDosColumnas(
      doc,
      [
        {
          col1: 'bold:LÍQUIDO PAGABLE:',
          col2: {
            label: `bold:${this.formatearNumero(valorizacion.totalValorLiquidoVentaBolivianos)} Bs.`,
            options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
          },
        },
      ],
      margen,
      ancho,
      7,
    );

    doc.y += 6;
  }

  //-------------------------------------------------
  // Firmas (administrador / cliente)
  //-------------------------------------------------

  private dibujarFirmasLiquidacionMineral(
    doc: any,
    valorizacion: ValorizacionMineral,
    margen: number,
    ancho: number,
  ) {
    const persona = valorizacion.recepcionMineral?.persona;

    const mitad = ancho / 2;
    const yLinea = doc.y + 18;

    doc
      .moveTo(margen, yLinea)
      .lineTo(margen + mitad - 15, yLinea)
      .stroke();
    doc
      .moveTo(margen + mitad + 15, yLinea)
      .lineTo(margen + ancho, yLinea)
      .stroke();

    doc.font('Helvetica-Bold').fontSize(7);

    doc.text('ADMINISTRADOR', margen, yLinea + 3, {
      width: mitad - 15,
      align: 'center',
    });
    doc.text('CLIENTE', margen + mitad + 15, yLinea + 3, {
      width: mitad - 15,
      align: 'center',
    });

    doc.font('Helvetica').fontSize(7);

    doc.text('C.I.:', margen, yLinea + 12, {
      width: mitad - 15,
      align: 'center',
    });
    doc.text(
      `C.I.: ${persona?.numeroDocumento ?? '--'}`,
      margen + mitad + 15,
      yLinea + 12,
      {
        width: mitad - 15,
        align: 'center',
      },
    );

    doc.text('Entregue conforme', margen, yLinea + 21, {
      width: mitad - 15,
      align: 'center',
    });
    doc.text('Recibí conforme', margen + mitad + 15, yLinea + 21, {
      width: mitad - 15,
      align: 'center',
    });
  }

  //-------------------------------------------------
  // Auxiliares
  //-------------------------------------------------

  private dibujarTablaDosColumnas(
    doc: any,
    filas: Record<string, any>[],
    margen: number,
    ancho: number,
    fontSize: number = 8,
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
        doc.font('Helvetica').fontSize(fontSize);
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

    return Number(valor).toLocaleString('en-US', {
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
