import { proveedorDeRecepcion } from 'src/cluster/comercio-interno/recepcion-proveedor.util';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Borders, Cell, Fill, Worksheet } from 'exceljs';
import { Repository } from 'typeorm';

import { ExcelService } from 'src/common/excel/excel.service';
import { VentaLote } from 'src/cluster/contabilidad/entities/venta-lote.entity';
import { PromedioMineral } from '../entities/promedio/promedio-mineral.entity';
import {
  EstadoVentaReportePromedio,
  FiltroReportePromedioDto,
  PeriodoReportePromedio,
} from '../dto/promedio/promedio-mineral.dto';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const FMT_PESO = '#,##0.00';
const FMT_LEY = '0.000';
const FMT_HUMEDAD = '0.00';
const FMT_MONTO = '#,##0.00';

const BORDE: Partial<Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
  bottom: { style: 'thin' },
};

// Colores tomados de PROMEDIOS.xlsx (encabezado naranja, totales celeste).
const relleno = (argb: string): Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
});
const FILL_ENCABEZADO = relleno('FFF4B183');
const FILL_VALOR = relleno('FFFBE5D6');
const FILL_TOTAL = relleno('FFDDEBF7');
const FILL_LOTE = relleno('FF1F4E78');

const ETIQUETA_ESTADO: Record<EstadoVentaReportePromedio, string> = {
  todos: 'Todos (vendidos y sin vender)',
  sin_vender: 'Sin vender (faltantes por vender)',
  vendidos: 'Vendidos (abiertos y liquidados)',
  venta_abierta: 'Vendidos pendientes de liquidar',
  liquidados: 'Vendidos liquidados',
  anulados: 'Promedios anulados',
};

// Promedio con su venta vigente (no ANULADA) mapeada por el query.
type PromedioReporte = PromedioMineral & { ventaVigente?: VentaLote | null };

interface MineralColumna {
  idMineral: string;
  etiqueta: string;
}

interface Rango {
  desde: string;
  hasta: string;
  etiqueta: string;
}

@Injectable()
export class PromedioMineralReporteExcelService {
  constructor(
    private readonly excelService: ExcelService,

    @InjectRepository(PromedioMineral, 'ci')
    private readonly promedioRepository: Repository<PromedioMineral>,
  ) {}

  async generar(
    filtros: FiltroReportePromedioDto,
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const periodo = filtros.periodo ?? 'diario';
    const rango = this.resolverRango(periodo, filtros.fecha ?? this.hoy());

    const promedios = await this.buscarPromedios(rango, filtros);
    const minerales = this.mineralesDe(promedios);

    const workbook = this.excelService.createWorkbook();
    this.hojaResumen(
      workbook.addWorksheet('Resumen'),
      promedios,
      minerales,
      rango,
      filtros,
    );
    this.hojaDetalle(
      workbook.addWorksheet('Detalle'),
      promedios,
      minerales,
      rango,
    );

    return {
      buffer: await this.excelService.generate(workbook),
      nombreArchivo: `reporte-promedios-${periodo}-${filtros.estado && filtros.estado !== 'todos' ? filtros.estado + '-' : ''}${rango.desde}_${rango.hasta}.xlsx`,
    };
  }

  // ============================
  // Datos
  // ============================

  private buscarPromedios(
    rango: Rango,
    filtros: FiltroReportePromedioDto,
  ): Promise<PromedioReporte[]> {
    const estado = filtros.estado ?? 'todos';
    const query = this.promedioRepository
      .createQueryBuilder('promedio')
      .leftJoinAndSelect('promedio.codificacionLote', 'codificacionLote')
      .leftJoinAndSelect(
        'promedio.detalles',
        'detalle',
        'detalle.activo = true',
      )
      .leftJoinAndSelect('detalle.valorizacion', 'valorizacion')
      .leftJoinAndSelect('valorizacion.recepcionMineral', 'recepcion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect(
        'valorizacion.detalles',
        'detalleMineral',
        'detalleMineral.activo = true',
      )
      .leftJoinAndSelect('detalleMineral.mineral', 'mineral')
      .leftJoinAndMapOne(
        'promedio.ventaVigente',
        VentaLote,
        'venta',
        "venta.idPromedioMineral = promedio.id AND venta.estado <> 'ANULADA' AND venta.activo = true",
      )
      .leftJoinAndSelect('venta.cliente', 'cliente')
      .where('promedio.activo = :activo', { activo: estado !== 'anulados' })
      .andWhere('promedio.fecha BETWEEN :desde AND :hasta', {
        desde: rango.desde,
        hasta: rango.hasta,
      });

    if (estado === 'sin_vender') query.andWhere('venta.id IS NULL');
    if (estado === 'vendidos') query.andWhere('venta.id IS NOT NULL');
    if (estado === 'venta_abierta') query.andWhere("venta.estado = 'ABIERTA'");
    if (estado === 'liquidados') query.andWhere("venta.estado = 'LIQUIDADA'");

    if (filtros.idCodificacionLote) {
      query.andWhere('promedio.idCodificacionLote = :idCodificacionLote', {
        idCodificacionLote: filtros.idCodificacionLote,
      });
    }
    if (filtros.codificacionLote) {
      query.andWhere(
        'UPPER(codificacionLote.codigo) = UPPER(:codificacionLote)',
        {
          codificacionLote: filtros.codificacionLote.trim(),
        },
      );
    }

    // Codificación de las valorizaciones (la efectiva: la de la valorización o,
    // si no tiene, la de la recepción). Se trae el lote completo si al menos
    // una de sus valorizaciones es de esa codificación.
    if (filtros.idCodificacion || filtros.codificacion) {
      query.andWhere(
        `EXISTS (
          SELECT 1
            FROM comercio_interno.promedio_mineral_detalle pd
            JOIN comercio_interno.valorizacion_mineral vm ON vm.id = pd.id_valorizacion
            JOIN comercio_interno.recepcion_mineral rm ON rm.id = vm.id_recepcion_mineral
            JOIN parametrica.codificacion cod
              ON cod.id = COALESCE(vm.id_codificacion_valorizacion, rm.id_codificacion)
           WHERE pd.id_promedio_mineral = promedio.id
             AND pd.activo = true
             AND (CAST(:idCodificacion AS bigint) IS NULL OR cod.id = :idCodificacion)
             AND (CAST(:codificacion AS varchar) IS NULL OR UPPER(cod.codigo) = UPPER(:codificacion))
        )`,
        {
          idCodificacion: filtros.idCodificacion ?? null,
          codificacion: filtros.codificacion?.trim() || null,
        },
      );
    }

    return query
      .orderBy('promedio.fecha', 'ASC')
      .addOrderBy('promedio.id', 'ASC')
      .addOrderBy('recepcion.codigoOperacion', 'ASC')
      .getMany();
  }

  /** Minerales presentes en el período, en el orden en que aparecen. */
  private mineralesDe(promedios: PromedioReporte[]): MineralColumna[] {
    const vistos = new Map<string, MineralColumna>();
    for (const p of promedios) {
      for (const ley of p.leyes ?? []) {
        if (vistos.has(ley.idMineral)) continue;
        const unidad = ley.leyUnidad ? ` (${ley.leyUnidad})` : '';
        vistos.set(ley.idMineral, {
          idMineral: ley.idMineral,
          etiqueta: `${ley.mineral ?? 'Mineral'}${unidad}`,
        });
      }
    }
    return [...vistos.values()];
  }

  // ============================
  // Hoja Resumen: una fila por lote
  // ============================

  private hojaResumen(
    ws: Worksheet,
    promedios: PromedioReporte[],
    minerales: MineralColumna[],
    rango: Rango,
    filtros: FiltroReportePromedioDto,
  ): void {
    const encabezados = [
      'N°',
      'Fecha',
      'Lote',
      'Código promedio',
      'Descripción',
      '# Valorizaciones',
      '# Sacos',
      'Peso Kg',
      ...minerales.map((m) => `Ley ${m.etiqueta}`),
      'H2O %',
      'Efectivo invertido (Bs)',
      'Estado',
      'Cliente',
      'Fecha venta',
    ];
    const col = {
      sacos: 7,
      peso: 8,
      ley0: 9,
      humedad: 9 + minerales.length,
      monto: 10 + minerales.length,
    };

    this.excelService.addTitle(ws, 'REPORTE DE PROMEDIOS', encabezados.length);
    const codificacion = promedios[0]?.codificacionLote?.codigo;
    const filaEncabezado = this.excelService.addInformation(ws, {
      Período: rango.etiqueta,
      Desde: this.fechaBo(rango.desde),
      Hasta: this.fechaBo(rango.hasta),
      Estado: ETIQUETA_ESTADO[filtros.estado ?? 'todos'],
      'Codificación de lote':
        filtros.codificacionLote?.toUpperCase() ??
        (filtros.idCodificacionLote
          ? (codificacion ?? `ID ${filtros.idCodificacionLote}`)
          : 'Todas'),
      'Codificación de valorizaciones':
        filtros.codificacion?.toUpperCase() ??
        (filtros.idCodificacion ? `ID ${filtros.idCodificacion}` : 'Todas'),
      'Cantidad de lotes': promedios.length,
      'Fecha de generación': new Date().toLocaleString('es-BO'),
    });

    this.excelService.addHeader(ws, encabezados, filaEncabezado);
    const primera = filaEncabezado + 1;

    promedios.forEach((p, i) => {
      const leyes = new Map(
        (p.leyes ?? []).map((l) => [l.idMineral, l.leyPromedio]),
      );
      this.excelService.addRow(
        ws,
        [
          i + 1,
          this.fechaBo(p.fecha),
          p.codigoLote ?? '',
          p.codigo,
          p.descripcion ?? '',
          p.cantidadValorizaciones,
          p.numeroSacosTotal,
          Number(p.pesoTotalKilogramos),
          ...minerales.map((m) =>
            leyes.has(m.idMineral) ? Number(leyes.get(m.idMineral)) : null,
          ),
          p.humedadPromedioPorcentaje ?? null,
          Number(p.totalEfectivoInvertido),
          this.estadoDe(p),
          p.ventaVigente?.cliente?.nombre ?? '',
          p.ventaVigente ? this.fechaBo(p.ventaVigente.fechaVenta) : '',
        ],
        ['center', 'center', 'center', 'center', 'left'],
      );
    });

    const ultima = primera + promedios.length - 1;
    const fila = ws.getRow(ultima + 1);
    ws.mergeCells(ultima + 1, 1, ultima + 1, col.sacos - 1);
    fila.getCell(1).value = 'TOTAL DEL PERÍODO';

    if (promedios.length) {
      const peso = this.rangoCol(col.peso, primera, ultima);
      fila.getCell(col.sacos).value = this.suma(ws, col.sacos, primera, ultima);
      fila.getCell(col.peso).value = this.suma(ws, col.peso, primera, ultima);
      for (let c = col.ley0; c <= col.humedad; c++) {
        fila.getCell(c).value = this.ponderado(ws, c, peso, primera, ultima);
      }
      fila.getCell(col.monto).value = this.suma(ws, col.monto, primera, ultima);
    } else {
      fila.getCell(1).value = 'No hay promedios registrados en el período.';
    }
    this.estiloFila(fila, 1, encabezados.length, FILL_TOTAL, true);

    this.formatos(ws, primera, ultima + 1, {
      [col.sacos]: '#,##0',
      [col.peso]: FMT_PESO,
      [col.humedad]: FMT_HUMEDAD,
      [col.monto]: FMT_MONTO,
      ...this.formatosLey(col.ley0, minerales.length),
    });

    this.anchos(ws, [
      5,
      12,
      13,
      15,
      30,
      15,
      10,
      14,
      ...minerales.map(() => 14),
      10,
      22,
      32,
      28,
      12,
    ]);
  }

  // ============================
  // Hoja Detalle: un bloque por lote, como PROMEDIOS.xlsx
  // ============================

  private hojaDetalle(
    ws: Worksheet,
    promedios: PromedioReporte[],
    minerales: MineralColumna[],
    rango: Rango,
  ): void {
    const encabezados = [
      'N°',
      'Lote',
      'REFERENCIA',
      '# Sacos',
      'Peso Kg',
      ...minerales.map((m) => `Ley ${m.etiqueta}`),
      'H2O %',
      'MONT PAG (Bs)',
      'Entregado',
      'OBSERVACIONES',
    ];
    const total = encabezados.length;
    const col = {
      sacos: 4,
      peso: 5,
      ley0: 6,
      humedad: 6 + minerales.length,
      monto: 7 + minerales.length,
    };

    this.excelService.addTitle(
      ws,
      `PROMEDIOS - ${rango.etiqueta.toUpperCase()}`,
      total,
    );
    let r = 3;

    if (!promedios.length) {
      ws.getCell(r, 1).value = 'No hay promedios registrados en el período.';
    }

    for (const p of promedios) {
      // Título del lote
      ws.mergeCells(r, 1, r, total);
      const titulo = ws.getCell(r, 1);
      titulo.value = [
        `LOTE ${p.codigoLote ?? '-'}`,
        p.codigo,
        this.fechaBo(p.fecha),
        p.descripcion,
        this.estadoDe(p),
        p.ventaVigente?.cliente?.nombre,
      ]
        .filter(Boolean)
        .join('  ·  ');
      titulo.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      titulo.fill = FILL_LOTE;
      titulo.alignment = { horizontal: 'left', vertical: 'middle' };
      r++;

      const detalles = p.detalles ?? [];
      const filaEtiquetas = ws.getRow(r);
      const filaValores = ws.getRow(r + 1);
      const filaEncabezado = ws.getRow(r + 2);
      const primera = r + 3;
      const ultima = primera + detalles.length - 1;
      const peso = this.rangoCol(col.peso, primera, ultima);

      filaEncabezado.values = encabezados;
      this.estiloFila(filaEncabezado, 1, total, FILL_ENCABEZADO, true);

      detalles.forEach((d, i) => {
        const v = d.valorizacion;
        const leyes = new Map(
          (v?.detalles ?? []).map((dm) => [dm.idMineral, Number(dm.ley)]),
        );
        const fila = ws.getRow(primera + i);
        fila.values = [
          i + 1,
          v?.recepcionMineral?.codigoOperacion ?? '',
          this.nombreCompleto(proveedorDeRecepcion(v?.recepcionMineral)),
          d.numeroSacos ?? null,
          Number(d.pesoKilogramos),
          ...minerales.map((m) => leyes.get(m.idMineral) ?? null),
          d.humedadPorcentaje ?? null,
          Number(d.valorNetoVentaBolivianos),
          v?.entregado ? 'SÍ' : 'NO',
          v?.observaciones ?? '',
        ];
        this.estiloFila(fila, 1, total, null, false);
        fila.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        fila.getCell(total).alignment = {
          horizontal: 'left',
          vertical: 'middle',
          wrapText: true,
        };
      });

      // TOTAL Kg / PROMEDIO sobre las columnas de peso, leyes y humedad
      // (después de las filas, para que el resultado precalculado las vea).
      filaEtiquetas.getCell(col.peso).value = 'TOTAL Kg';
      filaValores.getCell(col.peso).value = this.suma(
        ws,
        col.peso,
        primera,
        ultima,
      );
      minerales.forEach((m, i) => {
        filaEtiquetas.getCell(col.ley0 + i).value = `PROMEDIO ${m.etiqueta}`;
        filaValores.getCell(col.ley0 + i).value = this.ponderado(
          ws,
          col.ley0 + i,
          peso,
          primera,
          ultima,
        );
      });
      filaEtiquetas.getCell(col.humedad).value = 'H2O PROM.';
      filaValores.getCell(col.humedad).value = this.ponderado(
        ws,
        col.humedad,
        peso,
        primera,
        ultima,
      );
      for (let c = col.peso; c <= col.humedad; c++) {
        this.estiloCelda(filaEtiquetas.getCell(c), FILL_ENCABEZADO, true);
        this.estiloCelda(filaValores.getCell(c), FILL_VALOR, false);
      }

      // TOTAL DE EFECTIVO INVERTIDO
      const filaTotal = ws.getRow(ultima + 1);
      ws.mergeCells(ultima + 1, 1, ultima + 1, col.monto - 1);
      filaTotal.getCell(1).value = 'TOTAL DE EFECTIVO INVERTIDO';
      filaTotal.getCell(col.monto).value = this.suma(
        ws,
        col.monto,
        primera,
        ultima,
      );
      this.estiloFila(filaTotal, 1, total, FILL_TOTAL, true);

      this.formatos(ws, r + 1, ultima + 1, {
        [col.sacos]: '#,##0',
        [col.peso]: FMT_PESO,
        [col.humedad]: FMT_HUMEDAD,
        [col.monto]: FMT_MONTO,
        ...this.formatosLey(col.ley0, minerales.length),
      });

      r = ultima + 4;
    }

    this.anchos(ws, [
      5,
      14,
      36,
      10,
      14,
      ...minerales.map(() => 16),
      12,
      18,
      12,
      32,
    ]);
    ws.views = [{ state: 'normal', zoomScale: 90 }];
  }

  // ============================
  // Fórmulas (con resultado precalculado para visores que no recalculan)
  // ============================

  private suma(ws: Worksheet, c: number, primera: number, ultima: number) {
    if (ultima < primera) return 0;
    return {
      formula: `SUM(${this.rangoCol(c, primera, ultima)})`,
      result: this.valores(ws, c, primera, ultima).reduce(
        (a, x) => a + (x ?? 0),
        0,
      ),
    };
  }

  /**
   * Promedio ponderado por peso sobre las filas que tienen valor, igual que
   * PromedioMineralService: SUMPRODUCT(valor, peso) / SUMIF(valor, "<>", peso).
   */
  private ponderado(
    ws: Worksheet,
    c: number,
    peso: string,
    primera: number,
    ultima: number,
  ) {
    if (ultima < primera) return null;
    const rango = this.rangoCol(c, primera, ultima);
    const valores = this.valores(ws, c, primera, ultima);
    const pesos = this.valores(ws, this.columnaDe(peso), primera, ultima);
    let suma = 0;
    let base = 0;
    valores.forEach((x, i) => {
      if (x === null) return;
      suma += x * (pesos[i] ?? 0);
      base += pesos[i] ?? 0;
    });
    return {
      formula: `IFERROR(SUMPRODUCT(${rango},${peso})/SUMIF(${rango},"<>",${peso}),"")`,
      result: base > 0 ? suma / base : '',
    };
  }

  private valores(
    ws: Worksheet,
    c: number,
    primera: number,
    ultima: number,
  ): (number | null)[] {
    const out: (number | null)[] = [];
    for (let r = primera; r <= ultima; r++) {
      const v = ws.getCell(r, c).value;
      out.push(typeof v === 'number' ? v : null);
    }
    return out;
  }

  private rangoCol(c: number, primera: number, ultima: number): string {
    const letra = this.letra(c);
    return `${letra}${primera}:${letra}${ultima}`;
  }

  private columnaDe(rango: string): number {
    const letras = rango.match(/^[A-Z]+/)[0];
    return [...letras].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  }

  private letra(c: number): string {
    let s = '';
    for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) {
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    }
    return s;
  }

  // ============================
  // Estilos
  // ============================

  private estiloCelda(cell: Cell, fill: Fill | null, negrita: boolean): void {
    cell.border = BORDE;
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    if (fill) cell.fill = fill;
    if (negrita) cell.font = { bold: true };
  }

  private estiloFila(
    fila: ReturnType<Worksheet['getRow']>,
    desde: number,
    hasta: number,
    fill: Fill | null,
    negrita: boolean,
  ): void {
    for (let c = desde; c <= hasta; c++) {
      this.estiloCelda(fila.getCell(c), fill, negrita);
    }
  }

  private formatos(
    ws: Worksheet,
    desde: number,
    hasta: number,
    porColumna: Record<number, string>,
  ): void {
    for (let r = desde; r <= hasta; r++) {
      for (const [c, fmt] of Object.entries(porColumna)) {
        ws.getCell(r, Number(c)).numFmt = fmt;
      }
    }
  }

  private formatosLey(desde: number, cantidad: number): Record<number, string> {
    const out: Record<number, string> = {};
    for (let i = 0; i < cantidad; i++) out[desde + i] = FMT_LEY;
    return out;
  }

  private anchos(ws: Worksheet, anchos: number[]): void {
    anchos.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }

  // ============================
  // Fechas
  // ============================

  /**
   * Convierte el período + fecha de referencia en un rango YYYY-MM-DD. Se
   * trabaja en UTC solo para la aritmética de días: `promedio.fecha` es DATE,
   * sin hora ni zona.
   */
  private resolverRango(periodo: PeriodoReportePromedio, fecha: string): Rango {
    const [a, m, d] = fecha.split('-').map(Number);
    const ref = new Date(Date.UTC(a, m - 1, d));
    const iso = (x: Date) => x.toISOString().slice(0, 10);

    if (periodo === 'mensual') {
      return {
        desde: iso(new Date(Date.UTC(a, m - 1, 1))),
        hasta: iso(new Date(Date.UTC(a, m, 0))),
        etiqueta: `Mensual - ${MESES[m - 1]} ${a}`,
      };
    }

    if (periodo === 'semanal') {
      const lunes = new Date(ref);
      lunes.setUTCDate(ref.getUTCDate() - ((ref.getUTCDay() + 6) % 7));
      const domingo = new Date(lunes);
      domingo.setUTCDate(lunes.getUTCDate() + 6);
      return {
        desde: iso(lunes),
        hasta: iso(domingo),
        etiqueta: `Semanal - Semana ${this.semanaIso(lunes)} (${this.fechaBo(iso(lunes))} al ${this.fechaBo(iso(domingo))})`,
      };
    }

    return {
      desde: fecha,
      hasta: fecha,
      etiqueta: `Diario - ${this.fechaBo(fecha)}`,
    };
  }

  private estadoDe(p: PromedioReporte): string {
    if (!p.activo) return 'ANULADO';
    const venta = p.ventaVigente;
    if (!venta) return 'SIN VENDER';
    return venta.estado === 'LIQUIDADA'
      ? 'VENDIDO LIQUIDADO'
      : 'VENDIDO PENDIENTE DE LIQUIDAR';
  }

  private semanaIso(lunes: Date): number {
    const jueves = new Date(lunes);
    jueves.setUTCDate(lunes.getUTCDate() + 3);
    const inicioAnio = Date.UTC(jueves.getUTCFullYear(), 0, 1);
    return Math.floor((jueves.getTime() - inicioAnio) / 86_400_000 / 7) + 1;
  }

  private fechaBo(fecha: string): string {
    const [a, m, d] = fecha.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }

  private hoy(): string {
    const ahora = new Date();
    const dos = (n: number) => n.toString().padStart(2, '0');
    return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
  }

  private nombreCompleto(persona?: {
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  }): string {
    return [
      persona?.nombres,
      persona?.apellidoPaterno,
      persona?.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
