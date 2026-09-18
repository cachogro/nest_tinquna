import { Injectable } from '@nestjs/common';
import { Workbook, Worksheet } from 'exceljs';
import { ExcelService } from 'src/common/excel/excel.service';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltroCajaFlujoExcelDto } from '../dto/movimiento-caja/filtro-caja-flujo-excel.dto';
import { MovimientoCajaService } from './movimiento-caja.service';

const TOTAL_COLUMNAS = 9;

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

/**
 * Genera el Excel provisional de la caja de flujo (hoja "CAJA DE FLUJO" del
 * modelo "caja de flujo y kardex.xlsx"), sin las columnas de bancos por
 * ahora: solo los registros de ingreso/egreso en efectivo de la moneda
 * pedida.
 */
@Injectable()
export class CajaFlujoExcelService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly movimientoCajaService: MovimientoCajaService,
  ) {}

  async generar(filtro: FiltroCajaFlujoExcelDto, user: Usuario): Promise<Buffer> {
    const { caja, periodos, movimientos: todosLosMovimientos } =
      await this.movimientoCajaService.listar(filtro);
    // El listado general incluye movimientos dados de baja (para el
    // historial); el reporte impreso solo debe reflejar los vigentes, igual
    // que el saldo por período que calcula el servicio.
    const movimientos = todosLosMovimientos.filter((m) => m.activo !== false);
    // gestión + mes ya vienen filtrados, así que `periodos` trae a lo sumo
    // el único período mensual pedido (o ninguno si todavía no se cargó
    // ningún movimiento en ese mes).
    const saldoInicialPeriodo = periodos[0]
      ? Number(periodos[0].saldoInicial)
      : Number(caja.saldoInicial);

    const workbook: Workbook = this.excelService.createWorkbook();
    const worksheet = workbook.addWorksheet('CAJA DE FLUJO', {
      properties: { defaultRowHeight: 20 },
      pageSetup: { orientation: 'landscape', fitToPage: true },
      views: [{ state: 'frozen', ySplit: 6 }],
    });

    worksheet.columns = [
      { width: 13 },
      { width: 40 },
      { width: 26 },
      { width: 16 },
      { width: 16 },
      { width: 26 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];

    this.excelService.addTitle(
      worksheet,
      `CAJA DE FLUJO - ${caja.nombre?.toUpperCase() ?? ''} (${filtro.moneda})`,
      TOTAL_COLUMNAS,
    );
    this.agregarCabecera(worksheet, filtro, user);

    const filaEncabezado = 6;
    const simbolo = filtro.moneda === 'USD' ? '$us.' : 'Bs.';
    this.excelService.addHeader(
      worksheet,
      [
        'FECHA',
        'CONCEPTO',
        'ENTREGA DE FONDOS A',
        'FACTURA Y/O RECIBO',
        'Nº CPTE',
        'DESTINO DEL GASTO',
        `INGRESO ${simbolo}`,
        `EGRESO ${simbolo}`,
        `SALDO ${simbolo}`,
      ],
      filaEncabezado,
    );

    let ultimaFila = filaEncabezado;
    if (movimientos.length === 0) {
      ultimaFila++;
      this.excelService.addRow(worksheet, [
        `01-${String(filtro.mes).padStart(2, '0')}-${filtro.gestion}`,
        'SALDO DE APERTURA',
        '',
        '',
        '',
        'SALDO INICIAL',
        null,
        null,
        saldoInicialPeriodo,
      ]);
    }

    movimientos.forEach((mov) => {
      this.excelService.addRow(
        worksheet,
        [
          this.formatearFecha(mov.fecha),
          mov.concepto,
          mov.entregaFondosA ?? '',
          mov.facturaRecibo || '',
          mov.nroComprobante || '',
          mov.destinoGasto?.nombre ?? '',
          Number(mov.ingreso) > 0 ? Number(mov.ingreso) : null,
          Number(mov.egreso) > 0 ? Number(mov.egreso) : null,
          Number(mov.saldo),
        ],
        [
          'center',
          undefined,
          undefined,
          'center',
          'center',
          undefined,
          'right',
          'right',
          'right',
        ],
      );
      ultimaFila++;
    });

    ['G', 'H', 'I'].forEach((col) => {
      worksheet.getColumn(col).numFmt = '#,##0.00';
    });

    this.agregarTotal(worksheet, movimientos, saldoInicialPeriodo, ultimaFila);

    this.excelService.autoFitColumns(worksheet, 12, { 1: 13 }, filaEncabezado);

    return this.excelService.generate(workbook);
  }

  private agregarCabecera(
    worksheet: Worksheet,
    filtro: FiltroCajaFlujoExcelDto,
    user: Usuario,
  ): void {
    worksheet.mergeCells(3, 1, 3, 4);
    const celdaResponsable = worksheet.getCell(3, 1);
    celdaResponsable.value = `RESPONSABLE: ${user.usuario?.toUpperCase() ?? ''}`;
    celdaResponsable.font = { bold: true, size: 11 };

    worksheet.mergeCells(3, 5, 3, TOTAL_COLUMNAS);
    const celdaGestion = worksheet.getCell(3, 5);
    celdaGestion.value = `GESTIÓN: ${filtro.gestion}`;
    celdaGestion.font = { bold: true, size: 11 };
    celdaGestion.alignment = { horizontal: 'right' };

    worksheet.mergeCells(4, 1, 4, TOTAL_COLUMNAS);
    const celdaPeriodo = worksheet.getCell(4, 1);
    celdaPeriodo.value = `PERÍODO: ${MESES[filtro.mes - 1]} DE ${filtro.gestion}`;
    celdaPeriodo.font = { italic: true, size: 11 };

    worksheet.mergeCells(5, 1, 5, TOTAL_COLUMNAS);
  }

  private agregarTotal(
    worksheet: Worksheet,
    movimientos: Array<{ ingreso: number; egreso: number; saldo: number }>,
    saldoInicialPeriodo: number,
    ultimaFila: number,
  ): void {
    const filaTotal = ultimaFila + 1;
    const totalIngreso = movimientos.reduce((acc, m) => acc + Number(m.ingreso), 0);
    const totalEgreso = movimientos.reduce((acc, m) => acc + Number(m.egreso), 0);
    const saldoFinal =
      movimientos.length > 0
        ? Number(movimientos[movimientos.length - 1].saldo)
        : saldoInicialPeriodo;

    worksheet.mergeCells(filaTotal, 1, filaTotal, 6);
    const celdaLabel = worksheet.getCell(filaTotal, 1);
    celdaLabel.value = 'TOTALES';
    celdaLabel.font = { bold: true, size: 12 };
    celdaLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const celdaIngreso = worksheet.getCell(filaTotal, 7);
    celdaIngreso.value = this.r2(totalIngreso);

    const celdaEgreso = worksheet.getCell(filaTotal, 8);
    celdaEgreso.value = this.r2(totalEgreso);

    const celdaSaldo = worksheet.getCell(filaTotal, 9);
    celdaSaldo.value = this.r2(saldoFinal);

    [celdaLabel, celdaIngreso, celdaEgreso, celdaSaldo].forEach((cell) => {
      cell.font = { bold: true, size: 12 };
      cell.numFmt = cell === celdaLabel ? undefined : '#,##0.00';
      cell.alignment = { horizontal: cell === celdaLabel ? 'right' : 'right', vertical: 'middle' };
      cell.border = {
        top: { style: 'double' },
        bottom: { style: 'double' },
      };
    });
  }

  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
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
