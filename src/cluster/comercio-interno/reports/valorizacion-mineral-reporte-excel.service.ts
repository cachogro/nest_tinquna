import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ExcelService } from 'src/common/excel/excel.service';
import { ValorizacionMineralReportesService } from './valorizacion-mineral-reportes.service';
import { FiltroReporteValorizacionDto } from '../dto/reportes/filtro-reporte-valorizacion.dto';

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

@Injectable()
export class ValorizacionMineralReporteExcelService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly reportesService: ValorizacionMineralReportesService,
  ) {}

  async generar(filtros: FiltroReporteValorizacionDto): Promise<Buffer> {
    const { resumen, valorizaciones, filtros: filtrosResueltos } =
      await this.reportesService.reporte(filtros);

    const workbook: Workbook = this.excelService.createWorkbook();
    const worksheet = this.excelService.createWorksheet(
      workbook,
      'Valorizaciones',
    );

    this.excelService.addTitle(worksheet, 'REPORTE DE VALORIZACIONES', 9);

    const filaInicio = this.excelService.addInformation(worksheet, {
      'Fecha de generación': new Date().toLocaleString('es-BO'),
      Estado: ETIQUETA_ESTADO[filtrosResueltos.estado] ?? filtrosResueltos.estado,
      Entregado:
        ETIQUETA_ENTREGADO[filtrosResueltos.entregado] ??
        filtrosResueltos.entregado,
      Codificación: filtrosResueltos.idCodificacion
        ? (filtrosResueltos.codificacion ??
          `ID ${filtrosResueltos.idCodificacion}`)
        : 'Todas',
      Desde: filtrosResueltos.desde
        ? new Date(filtrosResueltos.desde).toLocaleDateString('es-BO')
        : 'Todo el histórico',
      Hasta: filtrosResueltos.hasta
        ? new Date(filtrosResueltos.hasta).toLocaleDateString('es-BO')
        : 'Todo el histórico',
      'Cantidad de valorizaciones': resumen.cantidad,
    });

    this.excelService.addHeader(
      worksheet,
      [
        'Lote',
        'Referencia (Proveedor)',
        'N° Sacos',
        'Peso (Kg)',
        'Ley',
        'Monto a pagar (Bs)',
        'Entregado',
        'Estado',
        'Observaciones',
      ],
      filaInicio,
    );

    valorizaciones.forEach((fila) => {
      this.excelService.addRow(
        worksheet,
        [
          fila.codigoOperacion,
          fila.proveedor,
          fila.numeroSacos,
          this.formatDecimal(fila.pesoKg),
          this.resumenLeyes(fila.leyes),
          this.formatDecimal(fila.montoPagarBs),
          fila.entregado ? 'x' : '',
          fila.estadoValorizacion,
          fila.observaciones,
        ],
        [
          undefined,
          undefined,
          'right',
          'right',
          undefined,
          'right',
          'center',
          undefined,
          undefined,
        ],
      );
    });

    // Fila de totales
    this.excelService.addRow(
      worksheet,
      [
        'TOTAL',
        `${resumen.cantidad} valorizaciones`,
        resumen.totalSacos,
        this.formatDecimal(resumen.totalPesoKg),
        '',
        this.formatDecimal(resumen.totalMontoPagarBs),
        `${resumen.cantidadEntregados} / ${resumen.cantidad}`,
        '',
        '',
      ],
      [
        undefined,
        undefined,
        'right',
        'right',
        undefined,
        'right',
        'center',
        undefined,
        undefined,
      ],
    );

    this.excelService.autoFitColumns(worksheet, 12, { 1: 12, 2: 24 }, filaInicio);

    return this.excelService.generate(workbook);
  }

  private resumenLeyes(
    leyes: { mineral: string | null; ley: number; unidad: string | null }[],
  ): string {
    if (!leyes?.length) {
      return '';
    }

    return leyes
      .map((l) => {
        const etiqueta = l.mineral ? `${l.mineral}: ` : '';
        const unidad = l.unidad ? ` ${l.unidad}` : '';
        return `${etiqueta}${l.ley}${unidad}`;
      })
      .join('  |  ');
  }

  private formatDecimal(valor?: number | string | null): number | null {
    if (valor === null || valor === undefined || valor === ('' as any)) {
      return null;
    }

    return Math.round(Number(valor) * 100) / 100;
  }
}
