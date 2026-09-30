import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { Borders, Worksheet } from 'exceljs';

import { Usuario } from 'src/security/entities/usuario.entity';
import { Caja } from 'src/cluster/parametricas/entities/caja.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { MovimientoCaja } from '../entities/movimiento-caja.entity';
import { PeriodoCaja, MonedaCaja } from '../entities/periodo-caja.entity';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { PeriodoBanco } from '../entities/periodo-banco.entity';
import { FiltroCajaConsolidadoExcelDto } from '../dto/movimiento-caja/filtro-caja-consolidado-excel.dto';
import {
  ColumnaContable,
  ContabilidadExcelService,
  FORMATO_CONTABLE,
  MESES,
  PALETAS,
} from './contabilidad-excel.service';

const ID_CAJA_EMPRESA = 1;
const FUENTE = 'Calibri';
const BORDE_FINO: Partial<Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};
// Rellenos alternados de los grupos de importes (caja Bs., caja $us., bancos).
const RELLENOS_GRUPO = ['FFB4C6E7', 'FFC6E0B4', 'FFFFE699', 'FFF8CBAD', 'FFD9D2E9', 'FFBDD7EE'];

/** Una "cuenta" del consolidado: la caja en una moneda o una cuenta bancaria. */
interface CuentaConsolidada {
  clave: string;
  titulo: string;
  simbolo: string;
  saldoInicial: number;
}

interface LineaConsolidada {
  clave: string;
  fecha: string;
  registro: Date | null;
  /** 0 = caja, 1 = banco: desempate estable a igual fecha y hora. */
  origen: number;
  id: number;
  concepto: string;
  entregaA: string;
  facturaRecibo: string;
  nroComprobante: string;
  medio: string;
  destino: string;
  ingreso: number;
  egreso: number;
}

/**
 * Excel completo de la caja de flujo (hoja "CAJA DE FLUJO" del modelo "caja
 * de flujo y kardex.xlsx"): en una sola lista, ordenada por fecha y hora de
 * registro, todos los movimientos del mes de la caja en Bs., de la caja en
 * $us. y de cada cuenta bancaria. Cada una tiene su grupo de columnas
 * INGRESO / EGRESO / SALDO; el saldo de cada grupo se arrastra en todas las
 * filas, como en el libro físico. Solo movimientos vigentes (activo).
 */
@Injectable()
export class CajaFlujoConsolidadoExcelService {
  constructor(
    private readonly contabilidadExcel: ContabilidadExcelService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  async generar(filtro: FiltroCajaConsolidadoExcelDto, user: Usuario): Promise<Buffer> {
    const idCaja = filtro.idCaja ?? ID_CAJA_EMPRESA;
    const { gestion, mes } = filtro;
    const manager = this.dataSource.manager;

    const caja = await manager.findOne(Caja, { where: { id: idCaja } });
    if (!caja) {
      throw new NotFoundException('No se encontró la caja.');
    }

    // ------------------------------------------------------------ movimientos
    const movsCaja = await manager
      .createQueryBuilder(MovimientoCaja, 'm')
      .innerJoin('m.periodoCaja', 'p')
      .leftJoinAndSelect('m.formaPago', 'fp')
      .leftJoinAndSelect('m.destinoGasto', 'dg')
      .addSelect('m.fechaRegistro')
      .where('m.idCaja = :idCaja', { idCaja })
      .andWhere('m.activo = true')
      .andWhere('p.gestion = :gestion AND p.mes = :mes', { gestion, mes })
      .getMany();

    // Cuentas: las aperturadas y activas, más cualquiera con movimientos en el mes.
    const movsBanco = await manager
      .createQueryBuilder(LibretaBanco, 'l')
      .innerJoin('l.periodoBanco', 'p')
      .leftJoinAndSelect('l.destinoGasto', 'dg')
      .addSelect('l.fechaRegistro')
      .where('l.activo = true')
      .andWhere('p.gestion = :gestion AND p.mes = :mes', { gestion, mes })
      .getMany();

    const idsConMovimientos = [...new Set(movsBanco.map((l) => Number(l.idCuentaBancaria)))];
    const cuentasBancarias = await manager.find(CuentaBancaria, {
      where: [
        { activo: true, fechaSaldoInicial: Not(IsNull()) },
        ...(idsConMovimientos.length ? [{ id: In(idsConMovimientos) }] : []),
      ],
      relations: { entidadFinanciera: true },
      order: { id: 'ASC' },
    });

    // ------------------------------------------------------------ cuentas
    const cuentas: CuentaConsolidada[] = [
      {
        clave: 'CAJA-BS',
        titulo: `${caja.nombre?.toUpperCase() ?? 'CAJA'} - BOLIVIANOS`,
        simbolo: 'Bs.',
        saldoInicial: await this.saldoInicialCaja(caja, 'BS', gestion, mes),
      },
      {
        clave: 'CAJA-USD',
        titulo: `${caja.nombre?.toUpperCase() ?? 'CAJA'} - DÓLARES`,
        simbolo: '$us.',
        saldoInicial: await this.saldoInicialCaja(caja, 'USD', gestion, mes),
      },
    ];
    for (const cuenta of cuentasBancarias) {
      cuentas.push({
        clave: `BANCO-${cuenta.id}`,
        titulo: this.tituloCuenta(cuenta),
        simbolo: cuenta.moneda === 'USD' ? '$us.' : 'Bs.',
        saldoInicial: await this.saldoInicialBanco(cuenta, gestion, mes),
      });
    }

    // ------------------------------------------------------------ líneas
    const lineas: LineaConsolidada[] = [
      ...movsCaja.map((m) => ({
        clave: m.moneda === 'USD' ? 'CAJA-USD' : 'CAJA-BS',
        fecha: String(m.fecha).slice(0, 10),
        registro: m.fechaRegistro ?? null,
        origen: 0,
        id: Number(m.id),
        concepto: m.concepto ?? '',
        entregaA: m.entregaFondosA ?? '',
        facturaRecibo: m.facturaRecibo ?? '',
        nroComprobante: m.nroComprobante ?? '',
        medio: m.formaPago?.nombre ?? 'EFECTIVO',
        destino: m.destinoGasto?.nombre ?? '',
        ingreso: Number(m.ingreso),
        egreso: Number(m.egreso),
      })),
      // Libreta de bancos: HABER = entra (ingreso), DEBE = sale (egreso).
      ...movsBanco.map((l) => ({
        clave: `BANCO-${l.idCuentaBancaria}`,
        fecha: String(l.fecha).slice(0, 10),
        registro: l.fechaRegistro ?? null,
        origen: 1,
        id: Number(l.id),
        concepto: l.concepto ?? '',
        entregaA: l.nombresApellidos ?? '',
        facturaRecibo: l.facturaRecibo ?? '',
        nroComprobante: l.nroTransaccion ?? '',
        medio: l.tipoTransaccion ?? '',
        destino: l.destinoGasto?.nombre ?? '',
        ingreso: Number(l.haber),
        egreso: Number(l.debe),
      })),
    ].sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        (a.registro?.getTime() ?? 0) - (b.registro?.getTime() ?? 0) ||
        a.origen - b.origen ||
        a.id - b.id,
    );

    return this.construirLibro(caja, cuentas, lineas, gestion, mes, user);
  }

  // ------------------------------------------------------------ saldos iniciales
  /**
   * Saldo inicial del mes: el del período mensual si existe; si no (mes sin
   * movimientos), el cierre del último período anterior; si no hay ninguno,
   * el saldo de apertura de la caja.
   */
  private async saldoInicialCaja(
    caja: Caja,
    moneda: MonedaCaja,
    gestion: number,
    mes: number,
  ): Promise<number> {
    const periodos = await this.dataSource.manager.find(PeriodoCaja, {
      where: { idCaja: caja.id, moneda, tipo: 'MENSUAL' },
      order: { gestion: 'ASC', mes: 'ASC' },
    });
    const actual = periodos.find((p) => p.gestion === gestion && p.mes === mes);
    if (actual) return this.r2(actual.saldoInicial);

    const anterior = periodos.filter((p) => p.gestion * 12 + (p.mes ?? 0) < gestion * 12 + mes).pop();
    if (anterior) {
      return this.r2(
        anterior.saldoFinal ??
          Number(anterior.saldoInicial) + Number(anterior.totalIngreso) - Number(anterior.totalEgreso),
      );
    }
    return this.r2(moneda === 'BS' ? caja.saldoInicialBs : caja.saldoInicialUsd);
  }

  private async saldoInicialBanco(
    cuenta: CuentaBancaria,
    gestion: number,
    mes: number,
  ): Promise<number> {
    const periodos = await this.dataSource.manager.find(PeriodoBanco, {
      where: { idCuentaBancaria: cuenta.id, tipo: 'MENSUAL' },
      order: { gestion: 'ASC', mes: 'ASC' },
    });
    const actual = periodos.find((p) => p.gestion === gestion && p.mes === mes);
    if (actual) return this.r2(actual.saldoInicial);

    const anterior = periodos.filter((p) => p.gestion * 12 + (p.mes ?? 0) < gestion * 12 + mes).pop();
    if (anterior) {
      return this.r2(
        anterior.saldoFinal ??
          Number(anterior.saldoInicial) + Number(anterior.totalHaber) - Number(anterior.totalDebe),
      );
    }
    return this.r2(cuenta.saldoInicial);
  }

  // ------------------------------------------------------------ libro
  private async construirLibro(
    caja: Caja,
    cuentas: CuentaConsolidada[],
    lineas: LineaConsolidada[],
    gestion: number,
    mes: number,
    user: Usuario,
  ): Promise<Buffer> {
    const excel = this.contabilidadExcel;
    const paleta = PALETAS.cajaFlujo;

    const columnasTexto: ColumnaContable[] = [
      { titulo: 'FECHA', ancho: 11, fecha: true },
      { titulo: 'HORA', ancho: 7, alineacion: 'center' },
      { titulo: 'CONCEPTO', ancho: 38 },
      { titulo: 'ENTREGA DE FONDOS A:', ancho: 28 },
      { titulo: 'FACTURA Y/O RECIBO', ancho: 14, alineacion: 'center' },
      { titulo: 'Nº CPTE', ancho: 14, alineacion: 'center' },
      { titulo: 'MEDIO / N° DE CHEQUE', ancho: 14, alineacion: 'center' },
      { titulo: 'DESTINO DEL GASTO', ancho: 28 },
    ];
    const columnasImporte: ColumnaContable[] = cuentas.flatMap((c) => [
      { titulo: `INGRESO ${c.simbolo}`, ancho: 14, importe: true },
      { titulo: `EGRESO ${c.simbolo}`, ancho: 14, importe: true },
      { titulo: `SALDO ${c.simbolo}`, ancho: 15, importe: true },
    ]);
    const columnas = [...columnasTexto, ...columnasImporte];
    const totalColumnas = columnas.length;
    const nTexto = columnasTexto.length;
    const colCuenta = (i: number) => nTexto + i * 3 + 1; // columna INGRESO de la cuenta i

    const workbook = excel.crearLibro();
    const ws = excel.crearHoja(workbook, `CAJA DE FLUJO ${MESES[mes - 1].slice(0, 3)}-${gestion}`, columnas);

    excel.agregarTitulos(
      ws,
      totalColumnas,
      'KARDEX DE INGRESOS Y EGRESOS - CAJA DE FLUJO Y BANCOS',
      '(Caja en bolivianos y dólares, y todas las cuentas bancarias)',
    );
    const ultimoDia = new Date(Date.UTC(gestion, mes, 0)).getUTCDate();
    excel.agregarDatoCabecera(ws, 5, 1, 4, {
      etiqueta: 'RESPONSABLE',
      valor: this.nombreUsuario(user),
    });
    excel.agregarDatoCabecera(
      ws,
      5,
      5,
      8,
      { etiqueta: 'PERÍODO', valor: `1 DE ${MESES[mes - 1]} DE ${gestion} - ${ultimoDia} DE ${MESES[mes - 1]} DE ${gestion}` },
      'center',
    );
    excel.agregarDatoCabecera(ws, 5, 9, Math.min(11, totalColumnas), { etiqueta: 'GESTIÓN', valor: String(gestion) }, 'center');

    // --- Encabezado en dos filas: grupos (caja/bancos) y columnas ---
    const filaGrupo = 7;
    const filaColumnas = 8;
    columnasTexto.forEach((col, i) => {
      ws.mergeCells(filaGrupo, i + 1, filaColumnas, i + 1);
      this.celdaEncabezado(ws, filaGrupo, i + 1, col.titulo, paleta.encabezado);
    });
    cuentas.forEach((cuenta, i) => {
      const desde = colCuenta(i);
      const relleno = RELLENOS_GRUPO[i % RELLENOS_GRUPO.length];
      ws.mergeCells(filaGrupo, desde, filaGrupo, desde + 2);
      this.celdaEncabezado(ws, filaGrupo, desde, cuenta.titulo, relleno);
      for (let k = 0; k < 3; k++) {
        this.celdaEncabezado(ws, filaColumnas, desde + k, columnasImporte[i * 3 + k].titulo, relleno);
      }
    });
    ws.getRow(filaGrupo).height = 30;
    ws.getRow(filaColumnas).height = 30;
    ws.views = [{ state: 'frozen', ySplit: filaColumnas, xSplit: 3 }];
    ws.pageSetup.printTitlesRow = `${filaGrupo}:${filaColumnas}`;

    // --- Saldo de apertura ---
    const saldos = cuentas.map((c) => c.saldoInicial);
    const indice = new Map(cuentas.map((c, i) => [c.clave, i]));
    let fila = filaColumnas + 1;

    const valoresApertura: Array<string | number | Date | null> = [
      excel.fecha(`${gestion}-${String(mes).padStart(2, '0')}-01`),
      '',
      'SALDO DE APERTURA',
      '',
      '',
      '',
      '',
      'SALDO INICIAL',
      ...cuentas.flatMap((c) => [null, null, c.saldoInicial]),
    ];
    excel.agregarFila(ws, fila++, columnas, valoresApertura, { relleno: paleta.suave, negrita: true });

    // --- Detalle ---
    const totales = cuentas.map(() => ({ ingreso: 0, egreso: 0 }));
    for (const linea of lineas) {
      const i = indice.get(linea.clave);
      if (i === undefined) continue;
      saldos[i] = this.r2(saldos[i] + linea.ingreso - linea.egreso);
      totales[i].ingreso = this.r2(totales[i].ingreso + linea.ingreso);
      totales[i].egreso = this.r2(totales[i].egreso + linea.egreso);

      const importes = cuentas.flatMap((_, j) =>
        j === i
          ? [linea.ingreso > 0 ? linea.ingreso : null, linea.egreso > 0 ? linea.egreso : null, saldos[j]]
          : [null, null, saldos[j]],
      );
      excel.agregarFila(ws, fila, columnas, [
        excel.fecha(linea.fecha),
        this.hora(linea.registro),
        linea.concepto,
        linea.entregaA,
        linea.facturaRecibo,
        linea.nroComprobante,
        linea.medio,
        linea.destino,
        ...importes,
      ]);
      // Resalta la celda de la cuenta afectada para ubicarla a simple vista.
      for (let k = 0; k < 2; k++) {
        const celda = ws.getCell(fila, colCuenta(i) + k);
        if (celda.value != null) celda.font = { name: FUENTE, size: 11, bold: true };
      }
      fila++;
    }

    // --- Sumas totales ---
    const importesTotal: Record<number, number> = {};
    cuentas.forEach((_, i) => {
      importesTotal[colCuenta(i)] = totales[i].ingreso;
      importesTotal[colCuenta(i) + 1] = totales[i].egreso;
      importesTotal[colCuenta(i) + 2] = saldos[i];
    });
    excel.agregarTotal(ws, fila, totalColumnas, nTexto, 'SUMAS TOTALES', importesTotal, paleta);
    fila += 3;

    // --- Resumen por cuenta ---
    fila = this.agregarResumen(ws, fila, cuentas, totales, saldos, `${ultimoDia}-${mes}-${gestion}`, paleta.encabezado, paleta.suave);

    fila += 3;
    excel.agregarFirmas(ws, fila, Math.min(totalColumnas, 8), ['Registrado por:', 'Revisado por:']);

    return excel.generar(workbook);
  }

  /** Tabla CUENTA | SALDO INICIAL | INGRESOS | EGRESOS | SALDO AL <fin de mes>. */
  private agregarResumen(
    ws: Worksheet,
    filaInicio: number,
    cuentas: CuentaConsolidada[],
    totales: Array<{ ingreso: number; egreso: number }>,
    saldos: number[],
    finDeMes: string,
    rellenoEncabezado: string,
    rellenoSuave: string,
  ): number {
    // Columnas 3 (CONCEPTO, la más ancha) a 8.
    const encabezados = ['CUENTA', 'SALDO INICIAL', 'INGRESOS', 'EGRESOS', `SALDO AL ${finDeMes}`];
    let fila = filaInicio;

    ws.mergeCells(fila, 3, fila, 8);
    const titulo = ws.getCell(fila, 3);
    titulo.value = 'RESUMEN POR CUENTA';
    titulo.font = { name: FUENTE, bold: true, size: 12 };
    titulo.alignment = { horizontal: 'center' };
    fila++;

    const columnasResumen = [3, 5, 6, 7, 8];
    ws.mergeCells(fila, 3, fila, 4);
    encabezados.forEach((texto, k) => {
      this.celdaEncabezado(ws, fila, columnasResumen[k], texto, rellenoEncabezado);
    });
    ws.getCell(fila, 4).border = BORDE_FINO;
    fila++;

    cuentas.forEach((cuenta, i) => {
      ws.mergeCells(fila, 3, fila, 4);
      const valores = [
        cuenta.titulo,
        cuenta.saldoInicial,
        totales[i].ingreso,
        totales[i].egreso,
        saldos[i],
      ];
      valores.forEach((valor, k) => {
        const celda = ws.getCell(fila, columnasResumen[k]);
        celda.value = valor;
        celda.font = { name: FUENTE, size: 11, bold: k === 0 || k === 4 };
        celda.border = BORDE_FINO;
        celda.alignment = { vertical: 'middle', horizontal: k === 0 ? 'left' : 'right' };
        if (k > 0) celda.numFmt = FORMATO_CONTABLE;
        if (k === 4) {
          celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rellenoSuave } };
        }
      });
      ws.getCell(fila, 4).border = BORDE_FINO;
      fila++;
    });
    return fila;
  }

  // ------------------------------------------------------------ helpers
  private celdaEncabezado(ws: Worksheet, fila: number, col: number, texto: string, argb: string): void {
    const celda = ws.getCell(fila, col);
    celda.value = texto;
    celda.font = { name: FUENTE, bold: true, size: 10 };
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    celda.border = BORDE_FINO;
  }

  /** "BNB - CTA. 1234567 (Bs.)" o el alias de la cuenta si tiene. */
  private tituloCuenta(cuenta: CuentaBancaria): string {
    const banco = cuenta.entidadFinanciera?.sigla || cuenta.entidadFinanciera?.nombre || 'BANCO';
    const base = cuenta.alias?.trim() || `${banco} - CTA. ${cuenta.numeroCuenta}`;
    return `${base} (${cuenta.moneda === 'USD' ? '$us.' : 'Bs.'})`.toUpperCase();
  }

  /** Hora de registro en Bolivia (UTC-4), "HH:mm". */
  private hora(registro: Date | null): string {
    if (!registro) return '';
    return new Date(registro).toLocaleTimeString('es-BO', {
      timeZone: 'America/La_Paz',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private nombreUsuario(user: Usuario): string {
    const p = user?.persona;
    const nombre = [p?.nombres, p?.apellidoPaterno, p?.apellidoMaterno].filter(Boolean).join(' ').trim();
    return (nombre || user?.usuario || '').toUpperCase();
  }

  private r2(n: number | string | null | undefined): number {
    return Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;
  }
}
