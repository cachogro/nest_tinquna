import { Injectable } from '@nestjs/common';
import { Workbook, Worksheet } from 'exceljs';
import { ExcelService } from 'src/common/excel/excel.service';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { Kardex } from '../entities/kardex.entity';
import { KardexService } from './kardex.service';
import { MovimientoKardexService } from './movimiento-kardex.service';

const TOTAL_COLUMNAS = 9;

/**
 * Genera el Excel del kardex de anticipos actual de un actor o una persona,
 * con el mismo formato del modelo "caja de flujo y kardex.xlsx" (hoja de
 * kardex): cabecera con destinatario/cuenta/gestión, detalle de movimientos
 * y el total de anticipos por cobrar.
 */
@Injectable()
export class KardexExcelService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly kardexService: KardexService,
    private readonly movimientoKardexService: MovimientoKardexService,
  ) {}

  async generar(idKardex: string): Promise<Buffer> {
    const kardex = await this.kardexService.buscarPorId(idKardex);
    const { movimientos: todosLosMovimientos } =
      await this.movimientoKardexService.listar(idKardex);
    // El listado general incluye líneas dadas de baja; el reporte impreso
    // solo debe reflejar las vigentes, igual que `saldoActual` del kardex.
    const movimientos = todosLosMovimientos.filter((m) => m.activo !== false);

    const workbook: Workbook = this.excelService.createWorkbook();
    const worksheet = workbook.addWorksheet('KARDEX', {
      properties: { defaultRowHeight: 20 },
      pageSetup: { orientation: 'landscape', fitToPage: true },
      views: [{ state: 'frozen', ySplit: 7 }],
    });

    worksheet.columns = [
      { width: 6 },
      { width: 13 },
      { width: 16 },
      { width: 45 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 18 },
      { width: 28 },
    ];

    this.excelService.addTitle(worksheet, 'KARDEX DE ANTICIPOS', TOTAL_COLUMNAS);
    this.agregarSubtitulo(worksheet, `PRACTICADO AL ${this.formatearFecha(new Date().toISOString())}`);
    this.agregarCabeceraKardex(worksheet, kardex);

    const filaEncabezado = 7;
    this.excelService.addHeader(
      worksheet,
      [
        'N°',
        'FECHA',
        'N° DE COMP.',
        'DETALLE',
        'DEBE',
        'HABER',
        'SALDO',
        'FORMA DE PAGO',
        'COBRADOR',
      ],
      filaEncabezado,
    );

    let ultimaFila = filaEncabezado;
    movimientos.forEach((mov) => {
      this.excelService.addRow(
        worksheet,
        [
          mov.numeroLinea,
          this.formatearFecha(mov.fecha),
          mov.facturaRecibo || mov.nroComprobante || '',
          mov.detalle,
          Number(mov.debe) > 0 ? Number(mov.debe) : null,
          Number(mov.haber) > 0 ? Number(mov.haber) : null,
          Number(mov.saldo),
          mov.formaPago?.nombre ?? '',
          this.nombreCompleto(mov.cobrador),
        ],
        [
          'center',
          'center',
          'center',
          undefined,
          'right',
          'right',
          'right',
          undefined,
          undefined,
        ],
      );
      ultimaFila++;
    });

    ['E', 'F', 'G'].forEach((col) => {
      worksheet.getColumn(col).numFmt = '#,##0.00';
    });

    this.agregarTotal(worksheet, kardex, ultimaFila);

    this.excelService.autoFitColumns(worksheet, 12, { 1: 6, 2: 13 }, filaEncabezado);

    return this.excelService.generate(workbook);
  }

  private agregarSubtitulo(worksheet: Worksheet, texto: string): void {
    worksheet.mergeCells(2, 1, 2, TOTAL_COLUMNAS);

    const cell = worksheet.getCell(2, 1);
    cell.value = texto;
    cell.font = { italic: true, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  private agregarCabeceraKardex(worksheet: Worksheet, kardex: Kardex): void {
    worksheet.mergeCells(4, 1, 4, 6);
    const celdaSenor = worksheet.getCell(4, 1);
    celdaSenor.value = `SEÑOR: ${this.nombreTitular(kardex)}`;
    celdaSenor.font = { bold: true, italic: true, size: 13 };

    worksheet.mergeCells(4, 7, 4, TOTAL_COLUMNAS);
    const celdaNumero = worksheet.getCell(4, 7);
    celdaNumero.value = `KARDEX N° ${kardex.numero}   -   GESTIÓN ${kardex.gestion}`;
    celdaNumero.font = { bold: true, size: 12 };
    celdaNumero.alignment = { horizontal: 'right', vertical: 'middle' };

    worksheet.mergeCells(5, 1, 5, TOTAL_COLUMNAS);
    const celdaCuenta = worksheet.getCell(5, 1);
    celdaCuenta.value = `CUENTA: ${
      kardex.descripcion ??
      (kardex.tipo === 'ACTOR'
        ? 'Anticipos - Actor Productivo Minero'
        : 'Anticipos - Cuenta Personal')
    }`;
    celdaCuenta.font = { italic: true, size: 12 };

    worksheet.mergeCells(6, 1, 6, TOTAL_COLUMNAS);
  }

  private agregarTotal(
    worksheet: Worksheet,
    kardex: Kardex,
    ultimaFila: number,
  ): void {
    const filaTotal = ultimaFila + 1;

    worksheet.mergeCells(filaTotal, 1, filaTotal, 6);
    const celdaLabel = worksheet.getCell(filaTotal, 1);
    celdaLabel.value = 'TOTAL ANTICIPOS POR COBRAR';
    celdaLabel.font = { bold: true, size: 12 };
    celdaLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const celdaSaldo = worksheet.getCell(filaTotal, 7);
    celdaSaldo.value = Number(kardex.saldoActual);
    celdaSaldo.font = { bold: true, size: 12 };
    celdaSaldo.numFmt = '#,##0.00';
    celdaSaldo.alignment = { horizontal: 'right', vertical: 'middle' };

    [celdaLabel, celdaSaldo].forEach((cell) => {
      cell.border = {
        top: { style: 'double' },
        bottom: { style: 'double' },
      };
    });
  }

  private nombreTitular(kardex: Kardex): string {
    if (kardex.tipo === 'PERSONAL' && kardex.persona) {
      return this.nombreCompleto(kardex.persona) || 'S/N';
    }
    if (kardex.tipo === 'ACTOR' && kardex.actorProductivoMinero) {
      return kardex.actorProductivoMinero.nombre?.toUpperCase() ?? 'S/N';
    }
    return 'S/N';
  }

  private nombreCompleto(persona?: PersonaCi | null): string {
    if (!persona) {
      return '';
    }
    return [persona.nombres, persona.apellidoPaterno, persona.apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private formatearFecha(fecha?: string): string {
    if (!fecha) {
      return '';
    }
    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return fecha;
    }
    const [, anio, mes, dia] = match;
    return `${dia}-${mes}-${anio}`;
  }
}
