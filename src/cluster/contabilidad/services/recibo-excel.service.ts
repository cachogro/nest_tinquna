import { BadRequestException, Injectable } from '@nestjs/common';
import { Worksheet } from 'exceljs';

import { Usuario } from 'src/security/entities/usuario.entity';
import { EstadoRecibo, Recibo } from '../entities/recibo.entity';
import { MonedaCaja } from '../entities/periodo-caja.entity';
import { FiltroReciboExcelDto } from '../dto/recibo/filtro-recibo-excel.dto';
import {
  ColumnaContable,
  ContabilidadExcelService,
  FORMATO_CONTABLE,
  PALETAS,
} from './contabilidad-excel.service';
import { ReciboService } from './recibo.service';

const COLUMNAS: ColumnaContable[] = [
  { titulo: 'N°', ancho: 6, alineacion: 'center' },
  { titulo: 'FECHA', ancho: 12, fecha: true },
  { titulo: 'N° RECIBO', ancho: 11, alineacion: 'center' },
  { titulo: 'TIPO', ancho: 10, alineacion: 'center' },
  { titulo: 'ESTADO', ancho: 12, alineacion: 'center' },
  { titulo: 'NOMBRES Y APELLIDOS', ancho: 28 },
  { titulo: 'CONCEPTO', ancho: 38 },
  { titulo: 'FORMA DE PAGO', ancho: 30, alineacion: 'center' },
  { titulo: 'N° COMPROBANTE', ancho: 15, alineacion: 'center' },
  { titulo: 'MONEDA', ancho: 9, alineacion: 'center' },
  { titulo: 'T.C.', ancho: 9, alineacion: 'center' },
  // Importes en la moneda de cada recibo (ver columna MONEDA).
  { titulo: 'INGRESO', ancho: 15, importe: true },
  { titulo: 'EGRESO', ancho: 15, importe: true },
  { titulo: 'GENERADO POR', ancho: 14, alineacion: 'center' },
  { titulo: 'OBSERVACIÓN', ancho: 24 },
];
const TOTAL_COLUMNAS = COLUMNAS.length;
const COL_ESTADO = 5;
const COL_INGRESO = 12;
const COL_EGRESO = 13;
const COL_CANTIDAD = COL_INGRESO - 1;

const MONEDAS: MonedaCaja[] = ['BS', 'USD'];
const SIMBOLO: Record<MonedaCaja, string> = { BS: 'Bs.', USD: '$us' };

const ESTADOS: EstadoRecibo[] = ['PROCESADO', 'BORRADOR', 'ANULADO'];

/**
 * Genera el Excel "LIBRO DE RECIBOS": todos los recibos (serie R de ingreso
 * y serie C de egreso) que cumplan los filtros de la bandeja, en orden
 * cronológico, con su estado.
 *
 * Los totales del libro solo suman los PROCESADOS, que son los únicos que
 * generaron movimientos de kardex/caja. Los BORRADOR se sombrean (todavía
 * están pendientes) y los ANULADOS se imprimen tachados, para que el
 * correlativo quede completo sin que su monto cuente. Al pie va un resumen
 * con cantidad e importes por estado.
 *
 * Un recibo puede ser en Bs. o en $us: cada fila muestra el importe en su
 * moneda (con el tipo de cambio si es USD) y los totales van separados por
 * moneda, sin mezclarlas.
 */
@Injectable()
export class ReciboExcelService {
  constructor(
    private readonly contabilidadExcel: ContabilidadExcelService,
    private readonly reciboService: ReciboService,
  ) {}

  async generar(filtro: FiltroReciboExcelDto, user: Usuario): Promise<Buffer> {
    if (filtro.fechaDesde && filtro.fechaHasta && filtro.fechaDesde > filtro.fechaHasta) {
      throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta.');
    }
    const recibos = await this.reciboService.listarParaReporte(filtro);

    const paleta = PALETAS.recibos;
    const excel = this.contabilidadExcel;
    const workbook = excel.crearLibro();
    const worksheet = excel.crearHoja(workbook, 'LIBRO DE RECIBOS', COLUMNAS);

    excel.agregarTitulos(worksheet, TOTAL_COLUMNAS, 'LIBRO DE RECIBOS', this.subtitulo(recibos));
    excel.agregarDatoCabecera(worksheet, 5, 1, 6, {
      etiqueta: 'PERÍODO',
      valor: this.textoPeriodo(filtro),
    });
    excel.agregarDatoCabecera(
      worksheet,
      5,
      7,
      COL_CANTIDAD,
      { etiqueta: 'FILTROS', valor: this.textoFiltros(filtro) },
      'center',
    );
    excel.agregarDatoCabecera(
      worksheet,
      5,
      COL_INGRESO,
      TOTAL_COLUMNAS,
      { etiqueta: 'GENERADO POR', valor: user.usuario?.toUpperCase() ?? '' },
      'center',
    );

    const filaEncabezado = 7;
    excel.agregarEncabezado(worksheet, filaEncabezado, COLUMNAS, paleta);

    let fila = filaEncabezado + 1;
    recibos.forEach((recibo, i) => {
      const monto = this.r2(Number(recibo.montoTotal));
      excel.agregarFila(
        worksheet,
        fila,
        COLUMNAS,
        [
          i + 1,
          excel.fecha(recibo.fecha),
          this.numeroRecibo(recibo),
          recibo.tipo,
          recibo.estado,
          this.nombre(recibo),
          recibo.concepto,
          this.formaPago(recibo),
          recibo.nroComprobante ?? '',
          SIMBOLO[recibo.moneda] ?? recibo.moneda,
          recibo.moneda === 'USD' && recibo.tipoCambio ? Number(recibo.tipoCambio) : null,
          recibo.tipo === 'INGRESO' ? monto : null,
          recibo.tipo === 'EGRESO' ? monto : null,
          recibo.usuarioRegistro?.toUpperCase() ?? '',
          this.observacion(recibo),
        ],
        { relleno: recibo.estado === 'BORRADOR' ? paleta.suave : undefined },
      );
      if (recibo.estado === 'ANULADO') {
        this.marcarAnulado(worksheet, fila);
      }
      fila++;
    });

    if (recibos.length === 0) {
      excel.agregarFila(worksheet, fila++, COLUMNAS, [
        null, null, '', '', '', '', 'SIN RECIBOS PARA LOS FILTROS INDICADOS',
      ]);
    }

    // Una fila de total por moneda (no se mezclan Bs. con $us).
    const procesados = recibos.filter((r) => r.estado === 'PROCESADO');
    for (const moneda of this.monedasDelReporte(recibos)) {
      const lista = procesados.filter((r) => r.moneda === moneda);
      excel.agregarTotal(
        worksheet,
        fila++,
        TOTAL_COLUMNAS,
        COL_CANTIDAD,
        `TOTAL RECIBOS PROCESADOS ${SIMBOLO[moneda]}`,
        {
          [COL_INGRESO]: this.sumar(lista, 'INGRESO'),
          [COL_EGRESO]: this.sumar(lista, 'EGRESO'),
        },
        paleta,
      );
    }

    this.agregarResumen(worksheet, fila + 1, recibos);

    return excel.generar(workbook);
  }

  /**
   * Cuadro al pie con la cantidad de recibos y sus importes por estado,
   * separado por moneda. Va en las columnas de CONCEPTO a EGRESO para quedar
   * alineado con los montos del libro.
   */
  private agregarResumen(worksheet: Worksheet, filaInicio: number, recibos: Recibo[]): void {
    const filas: Array<[string, Recibo[], boolean]> = [];
    for (const moneda of this.monedasDelReporte(recibos)) {
      const deMoneda = recibos.filter((r) => r.moneda === moneda);
      for (const estado of ESTADOS) {
        filas.push([
          `${estado} ${SIMBOLO[moneda]}`,
          deMoneda.filter((r) => r.estado === estado),
          false,
        ]);
      }
      filas.push([`TOTAL EMITIDOS ${SIMBOLO[moneda]}`, deMoneda, true]);
    }
    const colDesde = 7;
    const borde = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const },
    };

    const estilizar = (fila: number, negrita: boolean, relleno?: string) => {
      for (let col = colDesde; col <= COL_EGRESO; col++) {
        const cell = worksheet.getCell(fila, col);
        cell.font = { name: 'Calibri', size: 11, bold: negrita };
        cell.border = borde;
        cell.alignment = {
          vertical: 'middle',
          horizontal: col < COL_CANTIDAD ? 'left' : col === COL_CANTIDAD ? 'center' : 'right',
        };
        if (col >= COL_INGRESO) {
          cell.numFmt = FORMATO_CONTABLE;
        }
        if (relleno) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: relleno } };
        }
      }
      worksheet.mergeCells(fila, colDesde, fila, COL_CANTIDAD - 1);
    };

    worksheet.getCell(filaInicio, colDesde).value = 'RESUMEN POR ESTADO';
    worksheet.getCell(filaInicio, COL_CANTIDAD).value = 'CANTIDAD';
    worksheet.getCell(filaInicio, COL_INGRESO).value = 'INGRESO';
    worksheet.getCell(filaInicio, COL_EGRESO).value = 'EGRESO';
    estilizar(filaInicio, true, PALETAS.recibos.encabezado);
    worksheet.getCell(filaInicio, COL_CANTIDAD).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell(filaInicio, COL_INGRESO).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell(filaInicio, COL_EGRESO).alignment = { horizontal: 'center', vertical: 'middle' };

    filas.forEach(([etiqueta, lista, esTotal], i) => {
      const fila = filaInicio + 1 + i;
      worksheet.getCell(fila, colDesde).value = etiqueta;
      worksheet.getCell(fila, COL_CANTIDAD).value = lista.length;
      worksheet.getCell(fila, COL_INGRESO).value = this.sumar(lista, 'INGRESO');
      worksheet.getCell(fila, COL_EGRESO).value = this.sumar(lista, 'EGRESO');
      estilizar(fila, esTotal, esTotal ? PALETAS.recibos.suave : undefined);
    });
  }

  /**
   * Monedas que se totalizan: las que aparecen en el reporte (Bs. por
   * defecto si no hay recibos).
   */
  private monedasDelReporte(recibos: Recibo[]): MonedaCaja[] {
    const presentes = MONEDAS.filter((m) => recibos.some((r) => r.moneda === m));
    return presentes.length ? presentes : ['BS'];
  }

  private subtitulo(recibos: Recibo[]): string {
    const monedas = this.monedasDelReporte(recibos);
    if (monedas.length > 1) {
      return '(Importes en la moneda de cada recibo)';
    }
    return monedas[0] === 'USD' ? '(Expresado en Dólares Americanos)' : '(Expresado en Bolivianos)';
  }

  /** Fila tachada y en gris: el recibo existe en el correlativo pero no cuenta. */
  private marcarAnulado(worksheet: Worksheet, fila: number): void {
    for (let col = 1; col <= TOTAL_COLUMNAS; col++) {
      const cell = worksheet.getCell(fila, col);
      cell.font = {
        ...cell.font,
        color: { argb: 'FF808080' },
        strike: col !== COL_ESTADO && col !== TOTAL_COLUMNAS,
      };
    }
    worksheet.getCell(fila, COL_ESTADO).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFC00000' },
    };
  }

  private observacion(recibo: Recibo): string {
    if (recibo.estado === 'ANULADO') {
      const quien = recibo.usuarioUltimaModificacion?.toUpperCase();
      const cuando = this.fechaDe(recibo.fechaUltimaModificacion);
      return ['Anulado', quien ? `por ${quien}` : '', cuando ? `el ${cuando}` : '']
        .filter(Boolean)
        .join(' ');
    }
    if (recibo.estado === 'BORRADOR') {
      return 'Pendiente de procesar';
    }
    return '';
  }

  /**
   * Forma de pago; si interviene un banco (transferencia, QR, cheque,
   * depósito...) se le concatena la cuenta y su moneda:
   * "TRANSFERENCIA - BUN - 1000123456 - USD".
   */
  private formaPago(recibo: Recibo): string {
    const forma = recibo.formaPago?.nombre ?? '';
    const cuenta = recibo.cuentaBancaria;
    if (!cuenta) {
      return forma;
    }
    const banco = cuenta.entidadFinanciera?.sigla?.trim() || cuenta.entidadFinanciera?.nombre || '';
    return [forma, banco, cuenta.numeroCuenta, cuenta.moneda].filter(Boolean).join(' - ');
  }

  private nombre(recibo: Recibo): string {
    if (recibo.nombresApellidos) {
      return recibo.nombresApellidos;
    }
    if (recibo.persona) {
      return [recibo.persona.nombres, recibo.persona.apellidoPaterno, recibo.persona.apellidoMaterno]
        .filter(Boolean)
        .join(' ')
        .trim();
    }
    return recibo.actorProductivoMinero?.nombre ?? recibo.cliente?.nombre ?? '';
  }

  private numeroRecibo(recibo: Recibo): string {
    return `${recibo.serie}-${String(recibo.numero).padStart(4, '0')}`;
  }

  private textoPeriodo(filtro: FiltroReciboExcelDto): string {
    const excel = this.contabilidadExcel;
    if (filtro.fechaDesde && filtro.fechaHasta) {
      return `DEL ${excel.fechaTexto(filtro.fechaDesde)} AL ${excel.fechaTexto(filtro.fechaHasta)}`;
    }
    if (filtro.fechaDesde) {
      return `DESDE EL ${excel.fechaTexto(filtro.fechaDesde)}`;
    }
    if (filtro.fechaHasta) {
      return `HASTA EL ${excel.fechaTexto(filtro.fechaHasta)}`;
    }
    return 'TODOS LOS RECIBOS';
  }

  private textoFiltros(filtro: FiltroReciboExcelDto): string {
    const partes = [
      filtro.tipo ?? 'INGRESOS Y EGRESOS',
      filtro.estado ?? 'TODOS LOS ESTADOS',
    ];
    if (filtro.busqueda) {
      partes.push(`"${filtro.busqueda}"`);
    }
    return partes.join(' / ');
  }

  private sumar(recibos: Recibo[], tipo: 'INGRESO' | 'EGRESO'): number {
    return this.r2(
      recibos.filter((r) => r.tipo === tipo).reduce((s, r) => s + Number(r.montoTotal), 0),
    );
  }

  private fechaDe(valor?: Date | string | null): string {
    if (!valor) {
      return '';
    }
    // Fecha local de Bolivia (UTC-4), igual que el resto del módulo.
    const d = new Date(new Date(valor).getTime() - 4 * 60 * 60 * 1000);
    return this.contabilidadExcel.fechaTexto(d.toISOString());
  }

  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
}
