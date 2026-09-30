import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Borders, Worksheet } from 'exceljs';

import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { FiltroLibretaBancoDto } from '../dto/libreta-banco/filtro-libreta-banco.dto';
import {
  ColumnaContable,
  ContabilidadExcelService,
  MESES,
  PALETAS,
} from './contabilidad-excel.service';
import { LibretaBancoService } from './libreta-banco.service';

// Columnas de "LIBRETA DE BANCOS TINKURIQUNA S.R.L..xlsx" más TIPO (QR,
// TRANSFERENCIA, DEPOSITO, RETIRO...) y FACTURA Y/O RECIBO.
// DEBE = sale plata de la cuenta, HABER = entra; SALDOS = anterior - DEBE + HABER.
const COLUMNAS: ColumnaContable[] = [
  { titulo: 'FECHA', ancho: 13, fecha: true },
  { titulo: 'N° DE TRANSACCIÓN', ancho: 19, alineacion: 'center' },
  { titulo: 'TIPO', ancho: 16, alineacion: 'center' },
  { titulo: 'FACTURA Y/O RECIBO', ancho: 16, alineacion: 'center' },
  { titulo: 'NOMBRES Y APELLIDOS', ancho: 40 },
  { titulo: 'CONCEPTO', ancho: 42 },
  { titulo: 'DEBE', ancho: 18, importe: true },
  { titulo: 'HABER', ancho: 18, importe: true },
  { titulo: 'SALDOS', ancho: 18, importe: true },
];
const TOTAL_COLUMNAS = COLUMNAS.length;
const COL_DEBE = 7;
const COL_HABER = 8;
const COL_SALDO = 9;

const BORDE_FINO: Partial<Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

/**
 * Excel de la libreta de bancos de UNA cuenta, con el formato del libro
 * físico: encabezado de dos filas (FECHA | N° DE TRANSACCIÓN | NOMBRES Y
 * APELLIDOS | CONCEPTO | SALDOS: DEBE / HABER / SALDOS), primera fila con el
 * saldo inicial (o el saldo anterior si se filtra por gestión/mes) cargado en
 * HABER, y al pie "TOTAL DE SALDO" = SUMA(HABER) - SUMA(DEBE), igual que el
 * modelo (la suma del HABER incluye el saldo inicial). Sin gestión/mes
 * imprime toda la historia de la cuenta, como la hoja física.
 */
@Injectable()
export class LibretaBancoExcelService {
  constructor(
    private readonly contabilidadExcel: ContabilidadExcelService,
    private readonly libretaBancoService: LibretaBancoService,

    @InjectRepository(CuentaBancaria, 'ci')
    private readonly cuentaRepository: Repository<CuentaBancaria>,

    @InjectRepository(LibretaBanco, 'ci')
    private readonly libretaRepository: Repository<LibretaBanco>,
  ) {}

  async generar(filtro: FiltroLibretaBancoDto): Promise<Buffer> {
    if (filtro.mes && !filtro.gestion) {
      throw new BadRequestException('Para filtrar por mes debe indicar la gestión.');
    }

    const { periodos, movimientos: todos } = await this.libretaBancoService.listar(filtro);
    const cuenta = await this.cuentaRepository.findOne({
      where: { id: filtro.idCuentaBancaria },
      relations: { entidadFinanciera: true },
    });
    if (!cuenta) {
      throw new NotFoundException('No se encontró la cuenta bancaria.');
    }
    // El listado incluye los movimientos dados de baja (historial); el libro
    // impreso solo refleja los vigentes, igual que el saldo que calcula el servicio.
    const movimientos = todos.filter((m) => m.activo !== false);
    const saldoInicial = await this.saldoInicial(filtro, cuenta, periodos);

    const excel = this.contabilidadExcel;
    const paleta = PALETAS.libreta;
    const banco = cuenta.entidadFinanciera?.nombre?.toUpperCase() ?? '';
    const esUsd = cuenta.moneda === 'USD';

    const workbook = excel.crearLibro();
    const worksheet = excel.crearHoja(
      workbook,
      this.nombreHoja(banco || cuenta.numeroCuenta),
      COLUMNAS,
    );

    excel.agregarTitulos(
      worksheet,
      TOTAL_COLUMNAS,
      'LIBRETA DE BANCOS',
      esUsd ? '(Expresado en Dólares)' : '(Expresado en Bolivianos)',
    );
    excel.agregarDatoCabecera(worksheet, 5, 1, 4, {
      etiqueta: 'Nº DE CUENTA',
      valor: `${cuenta.numeroCuenta}${banco ? ` - ${banco}` : ''}`,
    });
    excel.agregarDatoCabecera(
      worksheet,
      5,
      5,
      6,
      { etiqueta: 'PERÍODO', valor: this.textoPeriodo(filtro) },
      'center',
    );
    excel.agregarDatoCabecera(
      worksheet,
      5,
      COL_DEBE,
      TOTAL_COLUMNAS,
      { etiqueta: 'MONEDA', valor: esUsd ? 'MONEDA EXTRANJERA' : 'MONEDA NACIONAL' },
      'center',
    );

    const filaEncabezado = 7;
    this.agregarEncabezadoDoble(worksheet, filaEncabezado, paleta.encabezado);

    let fila = filaEncabezado + 2;
    excel.agregarFila(
      worksheet,
      fila++,
      COLUMNAS,
      [
        excel.fecha(this.fechaSaldoInicial(filtro, cuenta)),
        '',
        '',
        '',
        '',
        filtro.gestion ? 'SALDO ANTERIOR' : 'SALDO INICIAL DE LA CUENTA',
        null,
        saldoInicial,
        saldoInicial,
      ],
      { relleno: paleta.suave, negrita: true },
    );

    for (const mov of movimientos) {
      excel.agregarFila(worksheet, fila++, COLUMNAS, [
        excel.fecha(mov.fecha),
        mov.nroTransaccion || '',
        mov.tipoTransaccion || '',
        mov.facturaRecibo || '',
        mov.nombresApellidos || this.nombrePersona(mov),
        mov.concepto,
        Number(mov.debe) > 0 ? Number(mov.debe) : null,
        Number(mov.haber) > 0 ? Number(mov.haber) : null,
        Number(mov.saldo),
      ]);
    }

    const totalDebe = this.r2(movimientos.reduce((acc, m) => acc + Number(m.debe), 0));
    const totalHaber = this.r2(
      saldoInicial + movimientos.reduce((acc, m) => acc + Number(m.haber), 0),
    );
    excel.agregarTotal(
      worksheet,
      fila,
      TOTAL_COLUMNAS,
      COL_DEBE - 1,
      'TOTAL DE SALDO',
      {
        [COL_DEBE]: totalDebe,
        [COL_HABER]: totalHaber,
        [COL_SALDO]: this.r2(totalHaber - totalDebe),
      },
      paleta,
    );

    return excel.generar(workbook);
  }

  nombreArchivo(filtro: FiltroLibretaBancoDto): string {
    const partes = ['libreta-banco', String(filtro.idCuentaBancaria)];
    if (filtro.gestion) partes.push(String(filtro.gestion));
    if (filtro.mes) partes.push(String(filtro.mes).padStart(2, '0'));
    return `${partes.join('-')}.xlsx`;
  }

  /**
   * Sin filtro: el saldo de apertura de la cuenta. Con gestión/mes: el saldo
   * inicial del primer período mensual del rango; si el rango todavía no
   * tiene períodos, el saldo del último movimiento vigente anterior a él.
   */
  private async saldoInicial(
    filtro: FiltroLibretaBancoDto,
    cuenta: CuentaBancaria,
    periodos: { tipo: string; gestion: number; mes?: number | null; saldoInicial: number }[],
  ): Promise<number> {
    if (!filtro.gestion) {
      return this.r2(Number(cuenta.saldoInicial));
    }
    const primero = periodos
      .filter((p) => p.tipo === 'MENSUAL')
      .sort((a, b) => a.gestion - b.gestion || Number(a.mes) - Number(b.mes))[0];
    if (primero) {
      return this.r2(Number(primero.saldoInicial));
    }

    const clave = filtro.gestion * 100 + (filtro.mes ?? 1);
    const anterior = await this.libretaRepository
      .createQueryBuilder('l')
      .innerJoin('l.periodoBanco', 'p')
      .where('l.idCuentaBancaria = :c', { c: cuenta.id })
      .andWhere('l.activo = true')
      .andWhere('(p.gestion * 100 + p.mes) < :clave', { clave })
      .orderBy('p.gestion', 'DESC')
      .addOrderBy('p.mes', 'DESC')
      .addOrderBy('l.folio', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .getOne();
    return this.r2(Number(anterior?.saldo ?? cuenta.saldoInicial));
  }

  private fechaSaldoInicial(filtro: FiltroLibretaBancoDto, cuenta: CuentaBancaria): string {
    if (!filtro.gestion) {
      return cuenta.fechaSaldoInicial ?? '';
    }
    return `${filtro.gestion}-${String(filtro.mes ?? 1).padStart(2, '0')}-01`;
  }

  private textoPeriodo(filtro: FiltroLibretaBancoDto): string {
    if (filtro.gestion && filtro.mes) {
      return `${MESES[filtro.mes - 1]} DE ${filtro.gestion}`;
    }
    if (filtro.gestion) {
      return `GESTIÓN ${filtro.gestion}`;
    }
    return 'TODOS LOS MOVIMIENTOS';
  }

  /**
   * Encabezado de dos filas del modelo: FECHA, N° DE TRANSACCIÓN, NOMBRES Y
   * APELLIDOS y CONCEPTO combinados en vertical; "SALDOS" combinado sobre
   * DEBE / HABER / SALDOS.
   */
  private agregarEncabezadoDoble(worksheet: Worksheet, fila: number, relleno: string): void {
    const segunda = fila + 1;
    for (let col = 1; col < COL_DEBE; col++) {
      worksheet.mergeCells(fila, col, segunda, col);
      worksheet.getCell(fila, col).value = COLUMNAS[col - 1].titulo;
    }
    worksheet.mergeCells(fila, COL_DEBE, fila, COL_SALDO);
    worksheet.getCell(fila, COL_DEBE).value = 'SALDOS';
    for (let col = COL_DEBE; col <= COL_SALDO; col++) {
      worksheet.getCell(segunda, col).value = COLUMNAS[col - 1].titulo;
    }

    for (const f of [fila, segunda]) {
      worksheet.getRow(f).height = 20;
      for (let col = 1; col <= TOTAL_COLUMNAS; col++) {
        const cell = worksheet.getCell(f, col);
        cell.font = { name: 'Calibri', bold: true, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: relleno } };
        cell.border = BORDE_FINO;
      }
    }

    worksheet.views = [{ state: 'frozen', ySplit: segunda }];
    worksheet.pageSetup.printTitlesRow = `${fila}:${segunda}`;
  }

  private nombrePersona(mov: LibretaBanco): string {
    const p = mov.persona;
    if (!p) return '';
    return [p.nombres, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ');
  }

  /** Excel no admite \ / ? * [ ] : en el nombre de hoja (máx. 31 caracteres). */
  private nombreHoja(nombre: string): string {
    return nombre.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'LIBRETA';
  }

  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
}
