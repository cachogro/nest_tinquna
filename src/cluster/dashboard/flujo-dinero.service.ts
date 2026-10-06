import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CategoriaDestinoGasto } from '../parametricas/entities/destino-gasto.entity';
import { FiltroDashboardDto } from './dto/filtro-dashboard.dto';

const LIMITE_DESTINOS = 8;

/** Categorías que entran en la ganancia estimada (el resto es solo flujo). */
const CATEGORIAS_GASTO: CategoriaDestinoGasto[] = ['GASTO_OPERATIVO', 'SUELDOS'];
const CATEGORIA_OTRO_INGRESO: CategoriaDestinoGasto = 'OTRO_INGRESO';

export interface IngresoEgreso {
  ingreso: number;
  egreso: number;
}

/**
 * Dinero que entró y salió, separado por dónde se movió. El efectivo es la
 * caja de flujo; "bancos" unifica todas las cuentas bancarias de esa moneda.
 */
export interface FlujoDinero {
  efectivoBs: IngresoEgreso;
  efectivoUsd: IngresoEgreso;
  bancosBs: IngresoEgreso;
  bancosUsd: IngresoEgreso;
  /** Todo llevado a Bs. (lo que está en $us, con el tipo de cambio de su movimiento). */
  ingresoBs: number;
  egresoBs: number;
  netoBs: number;
  /** $us sin tipo de cambio registrado: NO están sumados en los totales en Bs. */
  usdSinTipoCambio: IngresoEgreso;
  movimientos: number;
}

interface FilaFlujo {
  fecha: string;
  medio: 'EFECTIVO' | 'BANCO';
  moneda: 'BS' | 'USD';
  id_destino_gasto: number | null;
  nombre: string | null;
  categoria: CategoriaDestinoGasto | null;
  ingreso: string;
  egreso: string;
  ingreso_bs: string;
  egreso_bs: string;
  ingreso_usd_sin_tc: string;
  egreso_usd_sin_tc: string;
  movimientos: string;
}

/**
 * Flujo de dinero diario y ganancia estimada del período.
 *
 * Se calcula al consultar, sumando la caja de flujo y la libreta de bancos:
 * no hay tabla de reporte diario, así un recibo anulado o registrado con
 * fecha pasada se refleja solo. Los traspasos internos (caja <-> banco) se
 * excluyen: es la misma plata cambiando de custodia.
 *
 * Entrar menos salir es FLUJO, no ganancia (un anticipo de un cliente entra
 * pero se le deben lotes; la compra de mineral sale pero es inversión en un
 * lote). La ganancia estimada usa la utilidad de los lotes liquidados y solo
 * los destinos cuya categoría es gasto u otro ingreso.
 */
@Injectable()
export class FlujoDineroService {
  constructor(
    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  async resumen(filtro: FiltroDashboardDto) {
    const hoy = this.hoy();
    const desde = filtro.fechaDesde?.slice(0, 10) ?? `${hoy.slice(0, 7)}-01`;
    const hasta = filtro.fechaHasta?.slice(0, 10) ?? hoy;
    if (desde > hasta) {
      throw new BadRequestException('fechaDesde no puede ser posterior a fechaHasta.');
    }

    const hoyEnRango = hoy >= desde && hoy <= hasta;
    const [filas, filasHoy, traspasos, lotes] = await Promise.all([
      this.movimientos(desde, hasta),
      hoyEnRango ? Promise.resolve(null) : this.movimientos(hoy, hoy),
      this.traspasosExcluidos(desde, hasta),
      this.lotesLiquidados(desde, hasta),
    ]);

    const porDia = new Map<string, FilaFlujo[]>();
    for (const f of filas) {
      porDia.set(f.fecha, [...(porDia.get(f.fecha) ?? []), f]);
    }
    const dias = [...porDia.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fecha, grupo]) => ({ fecha, ...this.sumar(grupo) }));

    const categorias = this.agrupar(filas, (f) => f.categoria ?? 'SIN_DESTINO').map((g) => ({
      categoria: g.clave,
      ingresoBs: g.ingresoBs,
      egresoBs: g.egresoBs,
      movimientos: g.movimientos,
    }));
    const destinos = this.agrupar(filas, (f) => String(f.id_destino_gasto ?? 'SIN_DESTINO')).map(
      (g) => ({
        idDestinoGasto: g.fila.id_destino_gasto,
        nombre: g.fila.nombre ?? 'SIN DESTINO',
        categoria: g.fila.categoria ?? 'SIN_DESTINO',
        ingresoBs: g.ingresoBs,
        egresoBs: g.egresoBs,
        movimientos: g.movimientos,
      }),
    );
    const total = (categoria: string, campo: 'ingresoBs' | 'egresoBs') =>
      categorias.find((c) => c.categoria === categoria)?.[campo] ?? 0;

    const utilidadLotes = this.r2(lotes.venta - lotes.invertido);
    const otrosIngresos = total(CATEGORIA_OTRO_INGRESO, 'ingresoBs');
    const gastosOperativos = total('GASTO_OPERATIVO', 'egresoBs');
    const sueldos = total('SUELDOS', 'egresoBs');

    return {
      periodo: { desde, hasta },
      hoy,
      totales: this.sumar(filas),
      hoyFlujo: this.sumar(filasHoy ?? filas.filter((f) => f.fecha === hoy)),
      dias,
      categorias,
      mayoresEgresos: [...destinos]
        .filter((d) => d.egresoBs > 0)
        .sort((a, b) => b.egresoBs - a.egresoBs)
        .slice(0, LIMITE_DESTINOS),
      mayoresIngresos: [...destinos]
        .filter((d) => d.ingresoBs > 0)
        .sort((a, b) => b.ingresoBs - a.ingresoBs)
        .slice(0, LIMITE_DESTINOS),
      traspasosExcluidos: traspasos,
      ganancia: {
        lotesLiquidados: lotes.cantidad,
        ventaLotesBs: lotes.venta,
        invertidoLotesBs: lotes.invertido,
        utilidadLotesBs: utilidadLotes,
        otrosIngresosBs: otrosIngresos,
        gastosOperativosBs: gastosOperativos,
        sueldosBs: sueldos,
        gananciaEstimadaBs: this.r2(utilidadLotes + otrosIngresos - gastosOperativos - sueldos),
        /** Movimientos sin destino de gasto: no se pudieron clasificar. */
        sinDestino: {
          ingresoBs: total('SIN_DESTINO', 'ingresoBs'),
          egresoBs: total('SIN_DESTINO', 'egresoBs'),
        },
      },
    };
  }

  /**
   * Movimientos vigentes de caja y de libreta, agrupados por día, medio,
   * moneda y destino. En la libreta HABER es lo que entra y DEBE lo que
   * sale. El tipo de cambio de un movimiento en $us es el de la propia
   * libreta o, en su defecto, el del recibo que lo originó.
   */
  private async movimientos(desde: string, hasta: string): Promise<FilaFlujo[]> {
    return this.dataSource.query(
      `WITH mov AS (
         SELECT m.fecha, 'EFECTIVO' AS medio, m.moneda, m.ingreso, m.egreso, m.id_destino_gasto,
                CASE WHEN m.moneda = 'USD' THEN r.tipo_cambio END AS tc
           FROM contabilidad.movimiento_caja m
           LEFT JOIN contabilidad.recibo r ON r.id = m.id_recibo
          WHERE m.activo = true
            AND m.id_traspaso IS NULL
            AND m.fecha BETWEEN $1 AND $2
         UNION ALL
         SELECT l.fecha, 'BANCO' AS medio, cb.moneda, l.haber AS ingreso, l.debe AS egreso,
                l.id_destino_gasto,
                CASE WHEN cb.moneda = 'USD' THEN COALESCE(l.tipo_cambio, r.tipo_cambio) END AS tc
           FROM contabilidad.libreta_banco l
           JOIN parametrica.cuenta_bancaria cb ON cb.id = l.id_cuenta_bancaria
           LEFT JOIN contabilidad.recibo r ON r.id = l.id_recibo
          WHERE l.activo = true
            AND l.id_traspaso IS NULL
            AND l.fecha BETWEEN $1 AND $2
       )
       SELECT to_char(mov.fecha, 'YYYY-MM-DD') AS fecha, mov.medio, mov.moneda,
              mov.id_destino_gasto, dg.nombre, dg.categoria,
              SUM(mov.ingreso) AS ingreso,
              SUM(mov.egreso) AS egreso,
              SUM(CASE WHEN mov.moneda = 'BS' THEN mov.ingreso
                       WHEN mov.tc IS NOT NULL THEN ROUND(mov.ingreso * mov.tc, 2)
                       ELSE 0 END) AS ingreso_bs,
              SUM(CASE WHEN mov.moneda = 'BS' THEN mov.egreso
                       WHEN mov.tc IS NOT NULL THEN ROUND(mov.egreso * mov.tc, 2)
                       ELSE 0 END) AS egreso_bs,
              SUM(CASE WHEN mov.moneda = 'USD' AND mov.tc IS NULL THEN mov.ingreso ELSE 0 END) AS ingreso_usd_sin_tc,
              SUM(CASE WHEN mov.moneda = 'USD' AND mov.tc IS NULL THEN mov.egreso ELSE 0 END) AS egreso_usd_sin_tc,
              COUNT(*) AS movimientos
         FROM mov
         LEFT JOIN parametrica.destino_gasto dg ON dg.id = mov.id_destino_gasto
        GROUP BY mov.fecha, mov.medio, mov.moneda, mov.id_destino_gasto, dg.nombre, dg.categoria`,
      [desde, hasta],
    );
  }

  /** Traspasos internos del rango: se informan, pero no son ingreso ni egreso. */
  private async traspasosExcluidos(desde: string, hasta: string): Promise<number> {
    const [f] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad
         FROM contabilidad.traspaso t
        WHERE t.activo = true AND t.fecha BETWEEN $1 AND $2`,
      [desde, hasta],
    );
    return Number(f.cantidad);
  }

  /** Lotes vendidos cuya liquidación cayó en el rango: venta − efectivo invertido. */
  private async lotesLiquidados(desde: string, hasta: string) {
    const [f] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad,
              COALESCE(SUM(vl.monto_venta_bolivianos), 0) AS venta,
              COALESCE(SUM(vl.total_efectivo_invertido), 0) AS invertido
         FROM contabilidad.venta_lote vl
        WHERE vl.activo = true
          AND vl.estado = 'LIQUIDADA'
          AND vl.fecha_liquidacion BETWEEN $1 AND $2`,
      [desde, hasta],
    );
    return {
      cantidad: Number(f.cantidad),
      venta: this.r2(f.venta),
      invertido: this.r2(f.invertido),
    };
  }

  private sumar(filas: FilaFlujo[]): FlujoDinero {
    const flujo: FlujoDinero = {
      efectivoBs: { ingreso: 0, egreso: 0 },
      efectivoUsd: { ingreso: 0, egreso: 0 },
      bancosBs: { ingreso: 0, egreso: 0 },
      bancosUsd: { ingreso: 0, egreso: 0 },
      ingresoBs: 0,
      egresoBs: 0,
      netoBs: 0,
      usdSinTipoCambio: { ingreso: 0, egreso: 0 },
      movimientos: 0,
    };
    for (const f of filas) {
      const cubo =
        f.medio === 'EFECTIVO'
          ? f.moneda === 'USD'
            ? flujo.efectivoUsd
            : flujo.efectivoBs
          : f.moneda === 'USD'
            ? flujo.bancosUsd
            : flujo.bancosBs;
      cubo.ingreso = this.r2(cubo.ingreso + Number(f.ingreso));
      cubo.egreso = this.r2(cubo.egreso + Number(f.egreso));
      flujo.ingresoBs = this.r2(flujo.ingresoBs + Number(f.ingreso_bs));
      flujo.egresoBs = this.r2(flujo.egresoBs + Number(f.egreso_bs));
      flujo.usdSinTipoCambio.ingreso = this.r2(
        flujo.usdSinTipoCambio.ingreso + Number(f.ingreso_usd_sin_tc),
      );
      flujo.usdSinTipoCambio.egreso = this.r2(
        flujo.usdSinTipoCambio.egreso + Number(f.egreso_usd_sin_tc),
      );
      flujo.movimientos += Number(f.movimientos);
    }
    flujo.netoBs = this.r2(flujo.ingresoBs - flujo.egresoBs);
    return flujo;
  }

  /** Suma en Bs. por una clave (categoría o destino); `fila` es la primera del grupo. */
  private agrupar(filas: FilaFlujo[], clave: (f: FilaFlujo) => string) {
    const grupos = new Map<
      string,
      { clave: string; fila: FilaFlujo; ingresoBs: number; egresoBs: number; movimientos: number }
    >();
    for (const f of filas) {
      const k = clave(f);
      const g = grupos.get(k) ?? { clave: k, fila: f, ingresoBs: 0, egresoBs: 0, movimientos: 0 };
      g.ingresoBs = this.r2(g.ingresoBs + Number(f.ingreso_bs));
      g.egresoBs = this.r2(g.egresoBs + Number(f.egreso_bs));
      g.movimientos += Number(f.movimientos);
      grupos.set(k, g);
    }
    return [...grupos.values()];
  }

  /** Fecha de hoy en Bolivia (UTC-4), "YYYY-MM-DD", igual que DashboardService. */
  private hoy(): string {
    return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private r2(valor: unknown): number {
    return Math.round(Number(valor ?? 0) * 100) / 100;
  }
}
