import { BadRequestException, Injectable } from '@nestjs/common';
import { Worksheet } from 'exceljs';

import { Usuario } from 'src/security/entities/usuario.entity';
import { MonedaCaja } from '../entities/periodo-caja.entity';
import { Traspaso, TipoTraspaso } from '../entities/traspaso.entity';
import { FiltroTraspasoExcelDto } from '../dto/traspaso/filtro-traspaso-excel.dto';
import {
  ColumnaContable,
  ContabilidadExcelService,
  FORMATO_CONTABLE,
  PALETAS,
} from './contabilidad-excel.service';
import { TraspasoService } from './traspaso.service';

const COLUMNAS: ColumnaContable[] = [
  { titulo: 'N°', ancho: 6, alineacion: 'center' },
  { titulo: 'FECHA', ancho: 12, fecha: true },
  { titulo: 'TIPO', ancho: 11, alineacion: 'center' },
  { titulo: 'ESTADO', ancho: 13, alineacion: 'center' },
  { titulo: 'CONCEPTO', ancho: 36 },
  { titulo: 'CUENTA BANCARIA', ancho: 26 },
  { titulo: 'N° COMPROBANTE', ancho: 15, alineacion: 'center' },
  { titulo: 'DESTINO DEL GASTO', ancho: 22 },
  { titulo: 'MONEDA', ancho: 9, alineacion: 'center' },
  { titulo: 'DEPÓSITO (CAJA → BANCO)', ancho: 16, importe: true },
  { titulo: 'RETIRO (BANCO → CAJA)', ancho: 16, importe: true },
  { titulo: 'REGISTRADO POR', ancho: 14, alineacion: 'center' },
  { titulo: 'OBSERVACIÓN', ancho: 24 },
];
const TOTAL_COLUMNAS = COLUMNAS.length;
const COL_ESTADO = 4;
const COL_DEPOSITO = 10;
const COL_RETIRO = 11;
const COL_CANTIDAD = 9;

const MONEDAS: MonedaCaja[] = ['BS', 'USD'];
const SIMBOLO: Record<MonedaCaja, string> = { BS: 'Bs.', USD: '$us' };

/**
 * Genera el Excel "LIBRO DE TRASPASOS CAJA - BANCO": todos los traspasos
 * internos que cumplan los filtros, en orden cronológico.
 *
 * Mismo criterio que el libro de recibos: los totales solo suman los
 * traspasos vigentes (los únicos con movimientos activos en caja y banco);
 * los desactivados se imprimen tachados para que el historial quede
 * completo sin que su monto cuente. Como un traspaso puede ser en Bs. o en
 * $us (según la cuenta bancaria), los totales van separados por moneda.
 */
@Injectable()
export class TraspasoExcelService {
  constructor(
    private readonly contabilidadExcel: ContabilidadExcelService,
    private readonly traspasoService: TraspasoService,
  ) {}

  async generar(filtro: FiltroTraspasoExcelDto, user: Usuario): Promise<Buffer> {
    if (filtro.fechaDesde && filtro.fechaHasta && filtro.fechaDesde > filtro.fechaHasta) {
      throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta.');
    }
    const traspasos = await this.traspasoService.listarParaReporte(filtro);

    const paleta = PALETAS.traspasos;
    const excel = this.contabilidadExcel;
    const workbook = excel.crearLibro();
    const worksheet = excel.crearHoja(workbook, 'LIBRO DE TRASPASOS', COLUMNAS);

    excel.agregarTitulos(
      worksheet,
      TOTAL_COLUMNAS,
      'LIBRO DE TRASPASOS CAJA - BANCO',
      this.subtitulo(filtro),
    );
    excel.agregarDatoCabecera(worksheet, 5, 1, 5, {
      etiqueta: 'PERÍODO',
      valor: this.textoPeriodo(filtro),
    });
    excel.agregarDatoCabecera(
      worksheet,
      5,
      6,
      9,
      { etiqueta: 'FILTROS', valor: this.textoFiltros(filtro, traspasos) },
      'center',
    );
    excel.agregarDatoCabecera(
      worksheet,
      5,
      10,
      TOTAL_COLUMNAS,
      { etiqueta: 'GENERADO POR', valor: user.usuario?.toUpperCase() ?? '' },
      'center',
    );

    const filaEncabezado = 7;
    excel.agregarEncabezado(worksheet, filaEncabezado, COLUMNAS, paleta);

    let fila = filaEncabezado + 1;
    traspasos.forEach((traspaso, i) => {
      const monto = this.r2(Number(traspaso.monto));
      excel.agregarFila(worksheet, fila, COLUMNAS, [
        i + 1,
        excel.fecha(traspaso.fecha),
        traspaso.tipo,
        traspaso.activo ? 'VIGENTE' : 'DESACTIVADO',
        traspaso.concepto,
        this.cuenta(traspaso),
        traspaso.nroComprobante ?? '',
        traspaso.destinoGasto?.nombre ?? '',
        SIMBOLO[traspaso.moneda] ?? traspaso.moneda,
        traspaso.tipo === 'DEPOSITO' ? monto : null,
        traspaso.tipo === 'RETIRO' ? monto : null,
        traspaso.usuarioRegistro?.toUpperCase() ?? '',
        this.observacion(traspaso),
      ]);
      if (!traspaso.activo) {
        this.marcarDesactivado(worksheet, fila);
      }
      fila++;
    });

    if (traspasos.length === 0) {
      excel.agregarFila(worksheet, fila++, COLUMNAS, [
        null, null, '', '', 'SIN TRASPASOS PARA LOS FILTROS INDICADOS',
      ]);
    }

    // Una fila de total por moneda (no se mezclan Bs. con $us).
    const vigentes = traspasos.filter((t) => t.activo);
    for (const moneda of this.monedasDelReporte(filtro, traspasos)) {
      const lista = vigentes.filter((t) => t.moneda === moneda);
      excel.agregarTotal(
        worksheet,
        fila++,
        TOTAL_COLUMNAS,
        9,
        `TOTAL TRASPASOS VIGENTES ${SIMBOLO[moneda]}`,
        {
          [COL_DEPOSITO]: this.sumar(lista, 'DEPOSITO'),
          [COL_RETIRO]: this.sumar(lista, 'RETIRO'),
        },
        paleta,
      );
    }

    this.agregarResumen(worksheet, fila + 1, filtro, traspasos);

    return excel.generar(workbook);
  }

  /**
   * Cuadro al pie con la cantidad de traspasos y sus importes por estado,
   * separado por moneda. Va en las columnas de N° COMPROBANTE a RETIRO para
   * quedar alineado con los montos del libro.
   */
  private agregarResumen(
    worksheet: Worksheet,
    filaInicio: number,
    filtro: FiltroTraspasoExcelDto,
    traspasos: Traspaso[],
  ): void {
    const colDesde = 7;
    const borde = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const },
    };
    const estilizar = (fila: number, negrita: boolean, relleno?: string) => {
      for (let col = colDesde; col <= COL_RETIRO; col++) {
        const cell = worksheet.getCell(fila, col);
        cell.font = { name: 'Calibri', size: 11, bold: negrita };
        cell.border = borde;
        cell.alignment = {
          vertical: 'middle',
          horizontal: col <= colDesde + 1 ? 'left' : col === COL_CANTIDAD ? 'center' : 'right',
        };
        if (col >= COL_DEPOSITO) {
          cell.numFmt = FORMATO_CONTABLE;
        }
        if (relleno) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: relleno } };
        }
      }
      worksheet.mergeCells(fila, colDesde, fila, colDesde + 1);
    };

    ['RESUMEN POR ESTADO', '', 'CANTIDAD', 'DEPÓSITOS', 'RETIROS'].forEach((titulo, i) => {
      worksheet.getCell(filaInicio, colDesde + i).value = titulo || null;
    });
    estilizar(filaInicio, true, PALETAS.traspasos.encabezado);
    for (const col of [COL_CANTIDAD, COL_DEPOSITO, COL_RETIRO]) {
      worksheet.getCell(filaInicio, col).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    let fila = filaInicio + 1;
    for (const moneda of this.monedasDelReporte(filtro, traspasos)) {
      const deMoneda = traspasos.filter((t) => t.moneda === moneda);
      const filas: Array<[string, Traspaso[]]> = [
        [`VIGENTES ${SIMBOLO[moneda]}`, deMoneda.filter((t) => t.activo)],
        [`DESACTIVADOS ${SIMBOLO[moneda]}`, deMoneda.filter((t) => !t.activo)],
        [`TOTAL REGISTRADOS ${SIMBOLO[moneda]}`, deMoneda],
      ];
      filas.forEach(([etiqueta, lista], i) => {
        const esTotal = i === filas.length - 1;
        worksheet.getCell(fila, colDesde).value = etiqueta;
        worksheet.getCell(fila, COL_CANTIDAD).value = lista.length;
        worksheet.getCell(fila, COL_DEPOSITO).value = this.sumar(lista, 'DEPOSITO');
        worksheet.getCell(fila, COL_RETIRO).value = this.sumar(lista, 'RETIRO');
        estilizar(fila, esTotal, esTotal ? PALETAS.traspasos.suave : undefined);
        fila++;
      });
    }
  }

  /**
   * Monedas que se totalizan: la del filtro, o las que aparecen en el
   * reporte (Bs. por defecto si no hay traspasos).
   */
  private monedasDelReporte(filtro: FiltroTraspasoExcelDto, traspasos: Traspaso[]): MonedaCaja[] {
    if (filtro.moneda) {
      return [filtro.moneda];
    }
    const presentes = MONEDAS.filter((m) => traspasos.some((t) => t.moneda === m));
    return presentes.length ? presentes : ['BS'];
  }

  /** Fila tachada y en gris: el traspaso existió pero sus movimientos no cuentan. */
  private marcarDesactivado(worksheet: Worksheet, fila: number): void {
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

  private observacion(traspaso: Traspaso): string {
    if (traspaso.activo) {
      return '';
    }
    const quien = traspaso.usuarioUltimaModificacion?.toUpperCase();
    const cuando = this.fechaDe(traspaso.fechaUltimaModificacion);
    return ['Desactivado', quien ? `por ${quien}` : '', cuando ? `el ${cuando}` : '']
      .filter(Boolean)
      .join(' ');
  }

  /** "BUN - CTA OPERATIVA" / "BANCO UNIÓN - 1000123456". */
  private cuenta(traspaso: Traspaso): string {
    const cuenta = traspaso.cuentaBancaria;
    if (!cuenta) {
      return '';
    }
    const entidad = cuenta.entidadFinanciera?.sigla?.trim() || cuenta.entidadFinanciera?.nombre || '';
    const etiqueta = cuenta.alias?.trim() || cuenta.numeroCuenta;
    return [entidad, etiqueta].filter(Boolean).join(' - ');
  }

  private subtitulo(filtro: FiltroTraspasoExcelDto): string {
    if (filtro.moneda === 'USD') {
      return '(Expresado en Dólares Americanos)';
    }
    if (filtro.moneda === 'BS') {
      return '(Expresado en Bolivianos)';
    }
    return '(Importes en la moneda de cada traspaso)';
  }

  private textoPeriodo(filtro: FiltroTraspasoExcelDto): string {
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
    return 'TODOS LOS TRASPASOS';
  }

  private textoFiltros(filtro: FiltroTraspasoExcelDto, traspasos: Traspaso[]): string {
    const partes = [
      filtro.tipo ?? 'DEPÓSITOS Y RETIROS',
      filtro.estado === 'ACTIVO'
        ? 'VIGENTES'
        : filtro.estado === 'INACTIVO'
          ? 'DESACTIVADOS'
          : 'TODOS LOS ESTADOS',
    ];
    if (filtro.idCuentaBancaria) {
      const conCuenta = traspasos.find((t) => t.cuentaBancaria);
      partes.push(conCuenta ? `CTA ${this.cuenta(conCuenta)}` : `CTA ${filtro.idCuentaBancaria}`);
    }
    if (filtro.busqueda) {
      partes.push(`"${filtro.busqueda}"`);
    }
    return partes.join(' / ');
  }

  private sumar(traspasos: Traspaso[], tipo: TipoTraspaso): number {
    return this.r2(
      traspasos.filter((t) => t.tipo === tipo).reduce((s, t) => s + Number(t.monto), 0),
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
