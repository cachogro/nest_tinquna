import { Injectable } from '@nestjs/common';
const PDFDocument = require('pdfkit-table');
import { join } from 'path';
import * as fs from 'fs';
import {
  FilaReporteValorizacion,
  ReporteValorizacionResultado,
  ValorizacionMineralReportesService,
} from './valorizacion-mineral-reportes.service';
import { FiltroReporteValorizacionDto } from '../dto/reportes/filtro-reporte-valorizacion.dto';

const LOGO_PATH = join(process.cwd(), 'uploads', 'logo.png');

const ETIQUETA_ESTADO: Record<string, string> = {
  ambas: 'Pre-valorizadas y valorizadas',
  pre_valorizadas: 'Solo pre-valorizadas',
  valorizadas: 'Solo valorizadas',
};

const ETIQUETA_ENTREGADO: Record<string, string> = {
  ambos: 'Entregados y no entregados',
  entregados: 'Solo entregados',
  no_entregados: 'Solo no entregados',
};

/**
 * PDF del reporte de valorizaciones: mismos datos, filtros y columnas que el
 * Excel (lote, proveedor, sacos, peso, ley, monto a pagar, entregado), en
 * carta horizontal con fila de totales y "Página X de Y".
 */
@Injectable()
export class ValorizacionMineralReportePdfService {
  constructor(
    private readonly reportesService: ValorizacionMineralReportesService,
  ) {}

  async generar(filtros: FiltroReporteValorizacionDto): Promise<Buffer> {
    const reporte = await this.reportesService.reporte(filtros);

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
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      let esPrimeraPagina = true;
      doc.on('pageAdded', () => {
        if (esPrimeraPagina) {
          this.dibujarCabecera(doc, margen, ancho, reporte);
          esPrimeraPagina = false;
        }
      });

      doc.addPage();

      (async () => {
        await this.dibujarTabla(doc, reporte, ancho);
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
    { filtros, resumen }: ReporteValorizacionResultado,
  ) {
    doc.y = doc.page.margins.top;

    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, margen, doc.y, { width: 100 });
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('REPORTE DE VALORIZACIONES', margen, doc.y + 4, {
        width: ancho,
        align: 'center',
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(`Valorizaciones: ${resumen.cantidad}`, margen, doc.y + 4, {
        width: ancho,
        align: 'right',
      });

    doc.y += 10;
    doc
      .moveTo(margen, doc.y)
      .lineTo(margen + ancho, doc.y)
      .stroke();
    doc.y += 6;

    const periodo =
      filtros.desde || filtros.hasta
        ? `Del ${this.fecha(filtros.desde)} al ${this.fecha(filtros.hasta)}`
        : 'Todo el histórico';
    const codificacion = filtros.idCodificacion
      ? (filtros.codificacion ?? `ID ${filtros.idCodificacion}`)
      : 'Todas';

    doc
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Período: ${periodo}   ·   Estado: ${ETIQUETA_ESTADO[filtros.estado] ?? filtros.estado}   ·   ` +
          `Entregado: ${ETIQUETA_ENTREGADO[filtros.entregado] ?? filtros.entregado}   ·   Codificación: ${codificacion}`,
        margen,
        doc.y,
        { width: ancho, align: 'left' },
      );

    doc.y += 10;
  }

  private async dibujarTabla(
    doc: any,
    { valorizaciones, resumen }: ReporteValorizacionResultado,
    ancho: number,
  ) {
    const anchosFijos = {
      nro: 26,
      lote: 62,
      proveedor: 150,
      sacos: 42,
      peso: 62,
      ley: 120,
      monto: 72,
      entregado: 50,
      estado: 70,
    };
    const anchoObservacion =
      ancho - Object.values(anchosFijos).reduce((a, b) => a + b, 0);

    const columna = (property: string, width: number, align = 'left') => ({
      label: '',
      property,
      width,
      align,
      valign: 'middle',
    });

    const totalFilas = valorizaciones.length;

    await doc.table(
      {
        headers: [
          columna('nro', anchosFijos.nro),
          columna('lote', anchosFijos.lote),
          columna('proveedor', anchosFijos.proveedor),
          columna('sacos', anchosFijos.sacos, 'right'),
          columna('peso', anchosFijos.peso, 'right'),
          columna('ley', anchosFijos.ley),
          columna('monto', anchosFijos.monto, 'right'),
          columna('entregado', anchosFijos.entregado, 'center'),
          columna('estado', anchosFijos.estado),
          columna('observaciones', anchoObservacion),
        ],
        datas: this.filas(valorizaciones, resumen),
        options: { divider: { horizontal: { opacity: 10 } } },
      },
      {
        columnSpacing: 2,
        padding: 4,
        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
          doc.font('Helvetica').fontSize(7);
          if (indexRow === 0) {
            doc.fontSize(8).font('Helvetica-Bold');
            doc.addBackground(rectRow, 'grey', 0.02);
            doc
              .lineWidth(0.5)
              .moveTo(rectRow.x, rectRow.y)
              .lineTo(rectRow.x + rectRow.width, rectRow.y)
              .stroke();
          }
          if (indexRow === totalFilas + 1) {
            doc.fontSize(7).font('Helvetica-Bold');
          }
          const { x, y, width, height } = rectCell;
          if (indexColumn === 0) {
            doc
              .lineWidth(0.5)
              .moveTo(x, y)
              .lineTo(x, y + height)
              .stroke();
          }
          doc
            .lineWidth(0.5)
            .moveTo(x + width, y)
            .lineTo(x + width, y + height)
            .stroke();
        },
      },
    );
  }

  private filas(
    valorizaciones: FilaReporteValorizacion[],
    resumen: ReporteValorizacionResultado['resumen'],
  ): any[] {
    const filas: any[] = [
      {
        nro: 'bold:Nro.',
        lote: 'bold:Lote',
        proveedor: 'bold:Referencia (Proveedor)',
        sacos: 'bold:Sacos',
        peso: 'bold:Peso (Kg)',
        ley: 'bold:Ley',
        monto: 'bold:Monto a pagar (Bs)',
        entregado: 'bold:Entregado',
        estado: 'bold:Estado',
        observaciones: 'bold:Observaciones',
      },
    ];

    valorizaciones.forEach((v, i) => {
      filas.push({
        nro: i + 1,
        lote: v.codigoOperacion ?? '',
        proveedor: v.proveedor,
        sacos: `${v.numeroSacos ?? ''}`,
        peso: this.decimal(v.pesoKg),
        ley: this.leyes(v.leyes),
        monto: this.decimal(v.montoPagarBs),
        entregado: v.entregado ? 'Sí' : 'No',
        estado: v.estadoValorizacion ?? '',
        observaciones: v.observaciones ?? '',
      });
    });

    const gris = (label = '') => ({
      label,
      options: { backgroundColor: 'grey', backgroundOpacity: 0.3 },
    });
    filas.push({
      nro: gris(),
      lote: gris(),
      proveedor: gris('bold:TOTAL'),
      sacos: `bold:${resumen.totalSacos}`,
      peso: `bold:${this.decimal(resumen.totalPesoKg)}`,
      ley: gris(),
      monto: `bold:${this.decimal(resumen.totalMontoPagarBs)}`,
      entregado: `bold:${resumen.cantidadEntregados} / ${resumen.cantidad}`,
      estado: gris(),
      observaciones: gris(),
    });

    return filas;
  }

  private dibujarNumeracionPaginas(doc: any, margen: number, ancho: number) {
    const rango = doc.bufferedPageRange();

    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);

      // Sin anular el margen inferior, escribir tan cerca del borde hace que
      // PDFKit agregue una hoja nueva en vez de estampar sobre la actual.
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

  private leyes(leyes: FilaReporteValorizacion['leyes']): string {
    return (leyes ?? [])
      .map((l) => {
        const etiqueta = l.mineral ? `${l.mineral}: ` : '';
        const unidad = l.unidad ? ` ${l.unidad}` : '';
        return `${etiqueta}${l.ley}${unidad}`;
      })
      .join('  |  ');
  }

  private decimal(valor?: number | null): string {
    if (valor === null || valor === undefined) return '--';
    return Number(valor).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private fecha(fecha: Date | null): string {
    return fecha ? new Date(fecha).toLocaleDateString('es-BO') : '…';
  }
}
