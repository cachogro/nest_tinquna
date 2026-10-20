import { Injectable } from '@nestjs/common';
import { PaperSize, Worksheet } from 'exceljs';

import { PlanillaConfigService } from 'src/cluster/parametricas/services/planilla-config.service';
import {
  ColumnaContable,
  ContabilidadExcelService,
  MESES,
  PALETAS,
} from './contabilidad-excel.service';
import { BoletaPagoService } from './boleta-pago.service';
import { PlanillaFirmasDto } from '../dto/boleta-pago/planilla-firmas.dto';

const FUENTE = 'Calibri';

/**
 * Excel "PLANILLA DE SUELDOS Y SALARIOS" para firmas, con el formato de la
 * planilla del Ministerio de Trabajo: cabecera del empleador, una fila por
 * trabajador con su salario establecido y una columna en blanco para que
 * firme al recoger su pago; al pie, nombre, CI y firma del representante
 * legal.
 */
@Injectable()
export class PlanillaFirmasExcelService {
  constructor(
    private readonly contabilidadExcel: ContabilidadExcelService,
    private readonly boletaPagoService: BoletaPagoService,
    private readonly planillaConfigService: PlanillaConfigService,
  ) {}

  async generar(filtro: PlanillaFirmasDto): Promise<Buffer> {
    const [planilla, empleador] = await Promise.all([
      this.boletaPagoService.planillaFirmas(filtro.gestion, filtro.mes, filtro.idTipoContrato),
      this.planillaConfigService.datosEmpleador(),
    ]);
    const descuentos = planilla.columnasDescuento;
    const pct = (n: number) => `${String(n).replace('.', ',')}%`;

    const columnas: ColumnaContable[] = [
      { titulo: 'Nº', ancho: 5, alineacion: 'center' },
      { titulo: 'CARNET DE IDENTIDAD', ancho: 12, alineacion: 'center' },
      { titulo: 'APELLIDOS Y NOMBRE', ancho: 38 },
      { titulo: 'NACIONALIDAD', ancho: 12, alineacion: 'center' },
      { titulo: 'FECHA DE NACIMIENTO', ancho: 11, fecha: true },
      { titulo: 'SEXO (F/M)', ancho: 6, alineacion: 'center' },
      { titulo: 'OCUPACIÓN QUE DESEMPEÑA', ancho: 20 },
      { titulo: 'FECHA DE INGRESO', ancho: 11, fecha: true },
      { titulo: 'DÍAS PAGADOS MES', ancho: 7, alineacion: 'center' },
      { titulo: 'HORAS / DÍA', ancho: 6, alineacion: 'center' },
      { titulo: 'HABER BÁSICO', ancho: 12, importe: true },
      { titulo: 'BONO DE ANTIGÜEDAD', ancho: 12, importe: true },
      { titulo: 'TOTAL GANADO', ancho: 13, importe: true },
      ...descuentos.map((c) => ({
        titulo: `${c.codigo === 'AFP' ? 'AFP' : c.nombre.toUpperCase()} ${pct(c.porcentaje)}`,
        ancho: 12,
        importe: true,
      })),
      { titulo: 'ANTICIPOS', ancho: 12, importe: true },
      { titulo: 'TOTAL DESCUENTOS', ancho: 12, importe: true },
      { titulo: 'LÍQUIDO PAGABLE', ancho: 13, importe: true },
      { titulo: 'FIRMA DEL EMPLEADO', ancho: 40 },
    ];
    const total = columnas.length;
    const COL_HABER = 11;

    const excel = this.contabilidadExcel;
    const paleta = PALETAS.recibos;
    const workbook = excel.crearLibro();
    const worksheet = excel.crearHoja(workbook, 'PLANILLA DE SUELDOS', columnas);
    // Muchas columnas: hoja oficio (Legal, código 5) horizontal.
    worksheet.pageSetup.paperSize = 5 as PaperSize;

    // ------------------------------------------------ datos del empleador
    const datos: Array<[string, string | null | undefined]> = [
      ['NOMBRE O RAZÓN SOCIAL', empleador.razonSocial],
      ['Nº EMPLEADOR MINISTERIO DE TRABAJO', empleador.numeroEmpleadorMteps],
      ['Nº DE NIT', empleador.nit],
      ['Nº DE EMPLEADOR (Caja de Salud)', empleador.numeroEmpleadorCns],
    ];
    datos.forEach(([etiqueta, valor], i) => {
      const fila = i + 1;
      this.combinar(worksheet, fila, 1, 3, etiqueta, { bold: true, size: 10 }, 'left', true);
      this.combinar(worksheet, fila, 4, 7, valor ?? '', { size: 10 }, 'left', true);
    });

    // --------------------------------------------------------------- títulos
    const periodo = `${MESES[planilla.mes - 1]} ${planilla.gestion}`;
    this.combinar(worksheet, 6, 1, total, 'PLANILLA DE SUELDOS Y SALARIOS', { bold: true, size: 14 });
    this.combinar(
      worksheet,
      7,
      1,
      total,
      planilla.tipoContrato ? `PERSONAL ${planilla.tipoContrato}` : 'TODO EL PERSONAL',
      { bold: true, size: 11 },
    );
    this.combinar(worksheet, 8, 1, total, '(En Bolivianos)', { italic: true, size: 10 });
    this.combinar(worksheet, 9, 1, total, `Correspondiente al mes de: ${periodo}`, { bold: true, size: 11 });

    // ------------------------------------------------------------- detalle
    const filaEncabezado = 11;
    excel.agregarEncabezado(worksheet, filaEncabezado, columnas, paleta);
    worksheet.getRow(filaEncabezado).height = 42;

    let fila = filaEncabezado + 1;
    planilla.filas.forEach((f, i) => {
      excel.agregarFila(worksheet, fila, columnas, [
        i + 1,
        f.numeroDocumento ?? '',
        f.nombre,
        f.nacionalidad ?? '',
        excel.fecha(f.fechaNacimiento),
        f.sexo ?? '',
        f.ocupacion ?? '',
        excel.fecha(f.fechaIngreso),
        f.diasPagados,
        f.horasDia,
        f.haberBasico,
        f.bonoAntiguedad,
        f.totalGanado,
        ...descuentos.map((c) => f.descuentos[c.codigo] ?? 0),
        f.anticipos,
        this.r2(f.totalDescuentos + f.anticipos),
        f.liquidoPagable,
        null, // firma: en blanco
      ]);
      // Alto suficiente para firmar a mano.
      worksheet.getRow(fila).height = 34;
      fila++;
    });
    if (!planilla.filas.length) {
      excel.agregarFila(worksheet, fila++, columnas, [null, null, 'SIN PERSONAL ACTIVO EN EL MES']);
    }

    const t = planilla.totales;
    const importes = [
      t.haberBasico,
      t.bonoAntiguedad,
      t.totalGanado,
      ...descuentos.map((c) => t.porDescuento[c.codigo] ?? 0),
      t.anticipos,
      this.r2(t.totalDescuentos + t.anticipos),
      t.liquidoPagable,
    ];
    excel.agregarTotal(
      worksheet,
      fila,
      total,
      COL_HABER - 1,
      'TOTAL',
      Object.fromEntries(importes.map((v, i) => [COL_HABER + i, v])),
      paleta,
    );
    // La columna de firma no lleva importe.
    worksheet.getCell(fila, total).numFmt = '@';

    // ------------------------------------- pie: representante legal
    const filaPie = fila + 5;
    const tercio = Math.floor(total / 3);
    const bloques: Array<[number, number, string, string]> = [
      [1, tercio, empleador.representanteLegal ?? '', 'NOMBRE DEL EMPLEADOR O REPRESENTANTE LEGAL'],
      [tercio + 1, 2 * tercio, empleador.ciRepresentanteLegal ?? '', 'Nº DE DOCUMENTO DE IDENTIDAD'],
      [2 * tercio + 1, total, '', 'FIRMA'],
    ];
    for (const [desde, hasta, valor, etiqueta] of bloques) {
      // Deja una columna de separación entre bloques.
      const fin = hasta === total ? hasta : hasta - 1;
      this.combinar(worksheet, filaPie, desde, fin, valor, { bold: true, size: 11 }, 'center', false, 'bottom');
      this.combinar(worksheet, filaPie + 1, desde, fin, etiqueta, { bold: true, size: 9 }, 'center', false, 'top');
      for (let col = desde; col <= fin; col++) {
        worksheet.getCell(filaPie + 1, col).border = { top: { style: 'thin' } };
      }
    }
    worksheet.getRow(filaPie).height = 30;

    return excel.generar(workbook);
  }

  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private combinar(
    worksheet: Worksheet,
    fila: number,
    desde: number,
    hasta: number,
    valor: string,
    fuente: { bold?: boolean; italic?: boolean; size: number },
    horizontal: 'left' | 'center' = 'center',
    conBorde = false,
    vertical: 'middle' | 'top' | 'bottom' = 'middle',
  ): void {
    if (hasta > desde) worksheet.mergeCells(fila, desde, fila, hasta);
    const cell = worksheet.getCell(fila, desde);
    cell.value = valor;
    cell.font = { name: FUENTE, ...fuente };
    cell.alignment = { horizontal, vertical, wrapText: true };
    if (conBorde) {
      for (let col = desde; col <= hasta; col++) {
        worksheet.getCell(fila, col).border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: col === desde ? { style: 'thin' } : undefined,
          right: col === hasta ? { style: 'thin' } : undefined,
        };
      }
    }
  }
}
