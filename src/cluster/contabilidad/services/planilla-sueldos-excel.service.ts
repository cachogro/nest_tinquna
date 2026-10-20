import { Injectable } from '@nestjs/common';

import { Usuario } from 'src/security/entities/usuario.entity';
import {
  ColumnaContable,
  ContabilidadExcelService,
  FORMATO_CONTABLE,
  MESES,
  PALETAS,
} from './contabilidad-excel.service';
import { BoletaPagoService } from './boleta-pago.service';
import { PlanillaMensualDto } from '../dto/boleta-pago/planilla-mensual.dto';

/**
 * Excel "PLANILLA DE SUELDOS Y SALARIOS" del mes: una fila por boleta, con
 * cada descuento laboral y aporte patronal en su columna (los que se usaron
 * en el mes), totales y, al pie, lo que hay que pagarle a cada entidad.
 */
@Injectable()
export class PlanillaSueldosExcelService {
  constructor(
    private readonly contabilidadExcel: ContabilidadExcelService,
    private readonly boletaPagoService: BoletaPagoService,
  ) {}

  async generar(filtro: PlanillaMensualDto, user: Usuario): Promise<Buffer> {
    const planilla = await this.boletaPagoService.planillaMensual(
      filtro.gestion,
      filtro.mes,
      filtro.tipos,
    );
    const laborales = planilla.columnas.filter((c) => c.tipo === 'DESCUENTO_LABORAL');
    const patronales = planilla.columnas.filter((c) => c.tipo === 'APORTE_PATRONAL');
    // "Gestora - Aporte de vejez (jubilación)" -> "APORTE DE VEJEZ 10%": la
    // entidad ya sale en el cuadro de pago por entidad y son muchas columnas.
    const titulo = (c: { codigo: string; nombre: string; porcentaje: number | null }) => {
      // La AFP se conoce por su sigla; el resto, por su nombre sin la entidad.
      const corto = c.codigo === 'AFP'
        ? 'AFP'
        : c.nombre.split(' - ').pop()!.replace(/\s*\(.*\)\s*/g, ' ').trim();
      return `${corto.toUpperCase()}${c.porcentaje != null ? ` ${c.porcentaje}%` : ''}`;
    };

    const columnas: ColumnaContable[] = [
      { titulo: 'N°', ancho: 5, alineacion: 'center' },
      { titulo: 'NOMBRE COMPLETO', ancho: 30 },
      { titulo: 'CI', ancho: 12, alineacion: 'center' },
      { titulo: 'CARGO', ancho: 16 },
      { titulo: 'NUA / CUA', ancho: 12, alineacion: 'center' },
      { titulo: 'FECHA INGRESO', ancho: 12, fecha: true },
      { titulo: 'TIPO', ancho: 12, alineacion: 'center' },
      { titulo: 'DÍAS', ancho: 6, alineacion: 'center' },
      { titulo: 'HABER BÁSICO', ancho: 13, importe: true },
      { titulo: 'BONO ANTIGÜEDAD', ancho: 13, importe: true },
      { titulo: 'HORAS EXTRA', ancho: 12, importe: true },
      { titulo: 'DOMINICALES', ancho: 12, importe: true },
      { titulo: 'OTROS INGRESOS', ancho: 13, importe: true },
      { titulo: 'BENEFICIOS (LACTANCIA...)', ancho: 14, importe: true },
      { titulo: 'TOTAL GANADO', ancho: 14, importe: true },
      ...laborales.map((c) => ({ titulo: titulo(c), ancho: 13, importe: true })),
      { titulo: 'RC-IVA', ancho: 11, importe: true },
      { titulo: 'OTROS DESCUENTOS', ancho: 12, importe: true },
      { titulo: 'ATRASOS Y FALTAS', ancho: 12, importe: true },
      { titulo: 'TOTAL DESCUENTOS', ancho: 14, importe: true },
      { titulo: 'LÍQUIDO PAGABLE', ancho: 14, importe: true },
      ...patronales.map((c) => ({ titulo: `${titulo(c)} (EMPRESA)`, ancho: 13, importe: true })),
      { titulo: 'TOTAL APORTES EMPRESA', ancho: 14, importe: true },
    ];
    const total = columnas.length;
    const COL_PRIMER_IMPORTE = 9;

    const paleta = PALETAS.recibos;
    const excel = this.contabilidadExcel;
    const workbook = excel.crearLibro();
    const worksheet = excel.crearHoja(workbook, 'PLANILLA DE SUELDOS', columnas);
    const periodo = `${MESES[planilla.mes - 1]} ${planilla.gestion}`.toUpperCase();

    excel.agregarTitulos(worksheet, total, 'PLANILLA DE SUELDOS Y SALARIOS', `CORRESPONDIENTE A ${periodo}`);
    excel.agregarDatoCabecera(worksheet, 5, 1, 4, { etiqueta: 'PERÍODO', valor: periodo });
    excel.agregarDatoCabecera(worksheet, 5, 5, total, {
      etiqueta: 'GENERADO POR',
      valor: user.usuario?.toUpperCase() ?? '',
    }, 'right');

    const filaEncabezado = 7;
    excel.agregarEncabezado(worksheet, filaEncabezado, columnas, paleta);

    let fila = filaEncabezado + 1;
    planilla.filas.forEach((f, i) => {
      excel.agregarFila(worksheet, fila++, columnas, [
        i + 1,
        f.persona.nombre,
        f.persona.numeroDocumento ?? '',
        f.persona.cargo ?? '',
        f.persona.nuaCua ?? '',
        excel.fecha(f.persona.fechaInicioLaboral),
        f.tipo,
        f.diasTrabajados ?? '',
        f.salarioBase,
        f.bonoAntiguedad,
        f.montoHorasExtra,
        f.montoDominicales,
        f.otrosIngresos,
        f.montoBeneficios,
        f.totalGanado,
        ...laborales.map((c) => f.montos[c.codigo] ?? 0),
        f.rcIva,
        f.otrosDescuentosLey,
        f.descuentoAtrasos,
        f.totalDescuentosLey,
        f.liquidoPagable,
        ...patronales.map((c) => f.montos[c.codigo] ?? 0),
        f.totalAportePatronal,
      ]);
    });
    if (!planilla.filas.length) {
      excel.agregarFila(worksheet, fila++, columnas, [null, 'SIN BOLETAS PAGADAS EN EL MES']);
    }

    const t = planilla.totales;
    const importesTotales = [
      t.salarioBase,
      t.bonoAntiguedad,
      t.montoHorasExtra,
      t.montoDominicales,
      t.otrosIngresos,
      t.montoBeneficios,
      t.totalGanado,
      ...laborales.map((c) => t.porConcepto[c.codigo] ?? 0),
      t.rcIva,
      t.otrosDescuentosLey,
      t.descuentoAtrasos,
      t.totalDescuentosLey,
      t.liquidoPagable,
      ...patronales.map((c) => t.porConcepto[c.codigo] ?? 0),
      t.totalAportePatronal,
    ];
    excel.agregarTotal(
      worksheet,
      fila++,
      total,
      COL_PRIMER_IMPORTE - 1,
      'TOTALES',
      Object.fromEntries(importesTotales.map((v, i) => [COL_PRIMER_IMPORTE + i, v])),
      paleta,
    );

    // Resumen de pago por entidad (Gestora, CNS...): la etiqueta ocupa las
    // columnas de nombre a cargo y los importes van en las tres siguientes.
    fila += 1;
    const resumenColumnas: ColumnaContable[] = [
      { titulo: 'PAGO POR ENTIDAD', ancho: 0 },
      { titulo: 'DESCUENTO TRABAJADOR', ancho: 0, importe: true },
      { titulo: 'APORTE EMPRESA', ancho: 0, importe: true },
      { titulo: 'TOTAL A PAGAR', ancho: 0, importe: true },
    ];
    const filaResumen = (valores: Array<string | number | null>, encabezado = false) => {
      worksheet.mergeCells(fila, 2, fila, 4);
      const celdas = [2, 5, 6, 7];
      valores.forEach((v, i) => {
        const cell = worksheet.getCell(fila, celdas[i]);
        cell.value = v;
        cell.font = { name: 'Calibri', bold: encabezado || i === 0, size: 11 };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: encabezado ? 'center' : i === 0 ? 'left' : 'right',
          wrapText: true,
        };
        if (encabezado) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: paleta.encabezado } };
        } else if (resumenColumnas[i].importe) {
          cell.numFmt = FORMATO_CONTABLE;
        }
      });
      fila++;
    };
    filaResumen(resumenColumnas.map((c) => c.titulo), true);
    for (const e of planilla.porEntidad) {
      filaResumen([e.entidad, e.descuentoLaboral, e.aportePatronal, e.total]);
    }
    filaResumen(['COSTO DE LA PLANILLA (GANADO + APORTES EMPRESA)', null, null, t.costoEmpresa]);

    excel.agregarFirmas(worksheet, fila + 3, total, ['ELABORADO POR', 'REVISADO POR', 'APROBADO POR']);
    return excel.generar(workbook);
  }
}
