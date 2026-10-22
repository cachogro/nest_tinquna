import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { MovimientoCaja } from '../entities/movimiento-caja.entity';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { PlanCuentas } from 'src/cluster/parametricas/entities/plan-cuentas.entity';
import { FiltroReportePlanCuentasDto } from '../dto/reporte/filtro-reporte-plan-cuentas.dto';

interface FilaResumen {
  idPlanCuentas: string | null;
  totalIngreso: string;
  totalEgreso: string;
  cantidad: string;
}

/**
 * Reporte de "cuánto se gastó/ingresó" por plan de cuentas, combinando la
 * caja de flujo (efectivo) y la libreta de bancos (todas las cuentas): un
 * recibo o un movimiento de kardex pagado por banco no genera fila en
 * `movimiento_caja` (ver ReciboService / MovimientoKardexService), así que
 * mirar solo la caja dejaría ciego a todo lo pagado por transferencia,
 * depósito, QR o cheque.
 *
 * En ambos lados se excluyen los movimientos que nacen de un traspaso
 * interno (caja <-> banco, ver `Traspaso`): no son un gasto ni un ingreso
 * real del negocio, es la misma plata cambiando de custodia.
 */
@Injectable()
export class ReportePlanCuentasService {
  constructor(
    @InjectRepository(MovimientoCaja, 'ci')
    private readonly movimientoCajaRepository: Repository<MovimientoCaja>,

    @InjectRepository(LibretaBanco, 'ci')
    private readonly libretaBancoRepository: Repository<LibretaBanco>,

    @InjectRepository(PlanCuentas, 'ci')
    private readonly planCuentasRepository: Repository<PlanCuentas>,
  ) {}

  private r2(n: number | string): number {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  /** `parametrica.cuenta_bancaria` usa 'BS'/'USD' para la misma moneda que acá es 'BS'/'USD'. */
  private monedaCuentaDeMoneda(moneda: 'BS' | 'USD'): 'BS' | 'USD' {
    return moneda === 'USD' ? 'USD' : 'BS';
  }

  private validarRangoFechas(filtro: FiltroReportePlanCuentasDto): void {
    if (
      filtro.fechaDesde &&
      filtro.fechaHasta &&
      filtro.fechaDesde > filtro.fechaHasta
    ) {
      throw new BadRequestException(
        'La fecha inicial no puede ser mayor a la fecha final.',
      );
    }
  }

  /** Filtros comunes del lado caja: moneda, caja, rango de fechas, vigentes y sin traspasos. */
  private aplicarFiltrosCaja(
    qb: SelectQueryBuilder<MovimientoCaja>,
    filtro: FiltroReportePlanCuentasDto,
  ): void {
    qb.where('m.moneda = :moneda', { moneda: filtro.moneda })
      .andWhere('m.activo = true')
      .andWhere('m.idTraspaso IS NULL');
    if (filtro.idCaja) {
      qb.andWhere('m.idCaja = :idCaja', { idCaja: filtro.idCaja });
    }
    if (filtro.fechaDesde) {
      qb.andWhere('m.fecha >= :desde', { desde: filtro.fechaDesde });
    }
    if (filtro.fechaHasta) {
      qb.andWhere('m.fecha <= :hasta', { hasta: filtro.fechaHasta });
    }
  }

  /** Filtros comunes del lado banco: moneda (de la cuenta), cuenta, rango de fechas, vigentes y sin traspasos. */
  private aplicarFiltrosBanco(
    qb: SelectQueryBuilder<LibretaBanco>,
    filtro: FiltroReportePlanCuentasDto,
  ): void {
    qb.where('cb.moneda = :monedaCuenta', {
      monedaCuenta: this.monedaCuentaDeMoneda(filtro.moneda),
    })
      .andWhere('l.activo = true')
      .andWhere('l.idTraspaso IS NULL');
    if (filtro.idCuentaBancaria) {
      qb.andWhere('l.idCuentaBancaria = :idCuentaBancaria', {
        idCuentaBancaria: filtro.idCuentaBancaria,
      });
    }
    if (filtro.fechaDesde) {
      qb.andWhere('l.fecha >= :desde', { desde: filtro.fechaDesde });
    }
    if (filtro.fechaHasta) {
      qb.andWhere('l.fecha <= :hasta', { hasta: filtro.fechaHasta });
    }
  }

  /**
   * Una fila por cuenta imputable con lo ingresado, lo egresado y el neto
   * (ingreso - egreso), sumando caja + bancos, ordenada por código. Los
   * movimientos sin plan de cuentas van al final como "SIN PLAN DE CUENTAS".
   * `grupos` trae los subtotales de las cuentas de resumen (niveles 1-4) que
   * tienen movimientos, para armar el árbol: juntando `grupos` y
   * `planCuentas` por código queda el plan con sus totales en cada nivel.
   */
  async resumen(filtro: FiltroReportePlanCuentasDto) {
    this.validarRangoFechas(filtro);

    const qbCaja = this.movimientoCajaRepository
      .createQueryBuilder('m')
      .select('m.idPlanCuentas', 'idPlanCuentas')
      .addSelect('COALESCE(SUM(m.ingreso), 0)', 'totalIngreso')
      .addSelect('COALESCE(SUM(m.egreso), 0)', 'totalEgreso')
      .addSelect('COUNT(m.id)', 'cantidad')
      .groupBy('m.idPlanCuentas');
    this.aplicarFiltrosCaja(qbCaja, filtro);

    const qbBanco = this.libretaBancoRepository
      .createQueryBuilder('l')
      .innerJoin('l.cuentaBancaria', 'cb')
      .select('l.idPlanCuentas', 'idPlanCuentas')
      .addSelect('COALESCE(SUM(l.haber), 0)', 'totalIngreso')
      .addSelect('COALESCE(SUM(l.debe), 0)', 'totalEgreso')
      .addSelect('COUNT(l.id)', 'cantidad')
      .groupBy('l.idPlanCuentas');
    this.aplicarFiltrosBanco(qbBanco, filtro);

    const [filasCaja, filasBanco, plan] = await Promise.all([
      qbCaja.getRawMany<FilaResumen>(),
      qbBanco.getRawMany<FilaResumen>(),
      this.planCuentasRepository.find(),
    ]);
    const porId = new Map(plan.map((c) => [c.id, c]));

    type Totales = {
      cantidadMovimientos: number;
      totalIngreso: number;
      totalEgreso: number;
    };
    const sumar = (destino: Totales, f: Totales) => {
      destino.cantidadMovimientos += f.cantidadMovimientos;
      destino.totalIngreso = this.r2(destino.totalIngreso + f.totalIngreso);
      destino.totalEgreso = this.r2(destino.totalEgreso + f.totalEgreso);
    };
    const vacio = (): Totales => ({
      cantidadMovimientos: 0,
      totalIngreso: 0,
      totalEgreso: 0,
    });

    // Combina ambos orígenes por cuenta: la misma cuenta puede tener
    // movimientos en caja y en banco, así que se suman en un solo total.
    const porCuenta = new Map<number | null, Totales>();
    for (const f of [...filasCaja, ...filasBanco]) {
      const id = f.idPlanCuentas === null ? null : Number(f.idPlanCuentas);
      const previo = porCuenta.get(id) ?? vacio();
      sumar(previo, {
        cantidadMovimientos: Number(f.cantidad),
        totalIngreso: this.r2(f.totalIngreso),
        totalEgreso: this.r2(f.totalEgreso),
      });
      porCuenta.set(id, previo);
    }

    // Subtotales de cada cuenta de resumen por la que sube el movimiento.
    const porGrupo = new Map<number, Totales>();
    for (const [id, totales] of porCuenta) {
      for (
        let p = id ? porId.get(id)?.idPadre : null;
        p;
        p = porId.get(p)?.idPadre ?? null
      ) {
        const previo = porGrupo.get(p) ?? vacio();
        sumar(previo, totales);
        porGrupo.set(p, previo);
      }
    }

    const conNeto = <T extends Totales>(t: T) => ({
      ...t,
      neto: this.r2(t.totalIngreso - t.totalEgreso),
    });

    const planCuentas = [...porCuenta.entries()]
      .map(([id, totales]) => {
        const cuenta = id ? porId.get(id) : undefined;
        return conNeto({
          idPlanCuentas: id,
          codigo: cuenta?.codigo ?? null,
          nombre: cuenta?.nombre ?? 'SIN PLAN DE CUENTAS',
          nivel: cuenta?.nivel ?? null,
          naturaleza: cuenta?.naturaleza ?? null,
          categoria: cuenta?.categoria ?? null,
          idPadre: cuenta?.idPadre ?? null,
          ...totales,
        });
      })
      // Por código; lo que no tiene plan de cuentas, al final.
      .sort((a, b) => (a.codigo ?? '~').localeCompare(b.codigo ?? '~'));

    const grupos = [...porGrupo.entries()]
      .map(([id, totales]) => {
        const cuenta = porId.get(id);
        return conNeto({
          idPlanCuentas: id,
          codigo: cuenta.codigo,
          nombre: cuenta.nombre,
          nivel: cuenta.nivel,
          naturaleza: cuenta.naturaleza,
          idPadre: cuenta.idPadre,
          ...totales,
        });
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    const totalIngreso = this.r2(
      planCuentas.reduce((s, d) => s + d.totalIngreso, 0),
    );
    const totalEgreso = this.r2(
      planCuentas.reduce((s, d) => s + d.totalEgreso, 0),
    );

    return {
      filtro: {
        moneda: filtro.moneda,
        idCaja: filtro.idCaja ?? null,
        idCuentaBancaria: filtro.idCuentaBancaria ?? null,
        fechaDesde: filtro.fechaDesde ?? null,
        fechaHasta: filtro.fechaHasta ?? null,
      },
      totales: {
        totalIngreso,
        totalEgreso,
        neto: this.r2(totalIngreso - totalEgreso),
      },
      planCuentas,
      grupos,
    };
  }

  /**
   * Movimientos (de caja y de banco) de un plan de cuentas puntual con sus
   * totales, en orden cronológico.
   */
  /** La propia cuenta si es imputable; si es de resumen, todas sus subcuentas imputables. */
  private async idsImputablesDe(cuenta: PlanCuentas): Promise<number[]> {
    if (cuenta.tipo === 'D') return [cuenta.id];
    const filas: { id: number }[] = await this.planCuentasRepository.query(
      `WITH RECURSIVE rama AS (
         SELECT id, tipo FROM parametrica.plan_cuentas WHERE id = $1
         UNION ALL
         SELECT h.id, h.tipo FROM parametrica.plan_cuentas h JOIN rama r ON h.id_padre = r.id
       )
       SELECT id FROM rama WHERE tipo = 'D'`,
      [cuenta.id],
    );
    // Sin subcuentas igual se consulta (con un id que no matchea nada).
    return filas.length ? filas.map((f) => Number(f.id)) : [0];
  }

  async detalle(idPlanCuentas: number, filtro: FiltroReportePlanCuentasDto) {
    this.validarRangoFechas(filtro);

    const cuenta = await this.planCuentasRepository.findOne({
      where: { id: idPlanCuentas },
    });
    if (!cuenta) {
      throw new NotFoundException('No se encontró el plan de cuentas.');
    }
    // Una cuenta de resumen muestra los movimientos de todas sus subcuentas.
    const ids = await this.idsImputablesDe(cuenta);

    const qbCaja = this.movimientoCajaRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.formaPago', 'fp')
      .leftJoinAndSelect('m.caja', 'c')
      .leftJoinAndSelect('m.planCuentas', 'dg');
    this.aplicarFiltrosCaja(qbCaja, filtro);
    qbCaja.andWhere('m.idPlanCuentas IN (:...ids)', { ids });

    const qbBanco = this.libretaBancoRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.cuentaBancaria', 'cb')
      .leftJoinAndSelect('l.planCuentas', 'dg');
    this.aplicarFiltrosBanco(qbBanco, filtro);
    qbBanco.andWhere('l.idPlanCuentas IN (:...ids)', { ids });

    const [movimientosCaja, movimientosBanco, kardex] = await Promise.all([
      qbCaja.getMany(),
      qbBanco.getMany(),
      this.kardexDeCuentas(ids, filtro),
    ]);

    const movimientos = [
      ...movimientosCaja.map((m) => ({
        id: m.id,
        origen: 'CAJA' as const,
        fecha: m.fecha,
        cuenta: m.caja?.nombre ?? null,
        concepto: m.concepto,
        contraparte: m.entregaFondosA ?? null,
        facturaRecibo: m.facturaRecibo ?? null,
        nroComprobante: m.nroComprobante ?? null,
        formaPago: m.formaPago?.nombre ?? null,
        planCuentas: m.planCuentas
          ? {
              id: m.planCuentas.id,
              codigo: m.planCuentas.codigo,
              nombre: m.planCuentas.nombre,
            }
          : null,
        ingreso: Number(m.ingreso),
        egreso: Number(m.egreso),
      })),
      ...movimientosBanco.map((l) => ({
        id: l.id,
        origen: 'BANCO' as const,
        fecha: l.fecha,
        cuenta:
          l.cuentaBancaria?.alias || l.cuentaBancaria?.numeroCuenta || null,
        concepto: l.concepto,
        contraparte: l.nombresApellidos ?? null,
        facturaRecibo: l.facturaRecibo ?? null,
        nroComprobante: l.nroTransaccion ?? null,
        formaPago: l.tipoTransaccion,
        planCuentas: l.planCuentas
          ? {
              id: l.planCuentas.id,
              codigo: l.planCuentas.codigo,
              nombre: l.planCuentas.nombre,
            }
          : null,
        ingreso: Number(l.haber),
        egreso: Number(l.debe),
      })),
    ].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

    const totalIngreso = this.r2(
      movimientos.reduce((s, m) => s + m.ingreso, 0),
    );
    const totalEgreso = this.r2(movimientos.reduce((s, m) => s + m.egreso, 0));

    return {
      planCuentas: {
        id: cuenta.id,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        naturaleza: cuenta.naturaleza,
        categoria: cuenta.categoria,
      },
      filtro: {
        moneda: filtro.moneda,
        idCaja: filtro.idCaja ?? null,
        idCuentaBancaria: filtro.idCuentaBancaria ?? null,
        fechaDesde: filtro.fechaDesde ?? null,
        fechaHasta: filtro.fechaHasta ?? null,
      },
      totales: {
        cantidadMovimientos: movimientos.length,
        totalIngreso,
        totalEgreso,
        neto: this.r2(totalIngreso - totalEgreso),
      },
      movimientos,
      kardex,
    };
  }

  /**
   * Kardex con líneas imputadas a las cuentas (p. ej. todos los kardex donde
   * se dieron anticipos con 110205), con sus cargos (DEBE), abonos (HABER) y
   * el saldo actual del kardex. Incluye las líneas que no movieron caja ni
   * banco (descuentos, entregas de mineral). En Bs: el kardex lleva su saldo
   * siempre en Bs. Respeta el rango de fechas, no la caja ni la cuenta.
   */
  private async kardexDeCuentas(
    ids: number[],
    filtro: FiltroReportePlanCuentasDto,
  ) {
    const params: unknown[] = [ids];
    let fechas = '';
    if (filtro.fechaDesde) {
      params.push(filtro.fechaDesde);
      fechas += ` AND mk.fecha >= $${params.length}`;
    }
    if (filtro.fechaHasta) {
      params.push(filtro.fechaHasta);
      fechas += ` AND mk.fecha <= $${params.length}`;
    }
    const filas: {
      id: string;
      codigo: string | null;
      numero: number;
      tipo: string;
      estado: string;
      titular: string | null;
      saldo_actual: string;
      debe: string;
      haber: string;
      lineas: string;
      ultima_fecha: string;
    }[] = await this.planCuentasRepository.query(
      `SELECT k.id, k.codigo, k.numero, k.tipo, k.estado, k.saldo_actual,
              COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
                a.nombre, c.nombre
              ) AS titular,
              SUM(mk.debe) AS debe, SUM(mk.haber) AS haber, COUNT(*) AS lineas,
              to_char(MAX(mk.fecha), 'YYYY-MM-DD') AS ultima_fecha
         FROM contabilidad.movimiento_kardex mk
         JOIN contabilidad.kardex k ON k.id = mk.id_kardex
         LEFT JOIN parametrica.persona_ci p ON p.id = k.id_persona
         LEFT JOIN parametrica.actor_productivo_minero a ON a.id = k.id_actor_productivo_minero
         LEFT JOIN parametrica.cliente c ON c.id = k.id_cliente
        WHERE mk.activo = true
          AND mk.id_plan_cuentas = ANY($1)${fechas}
        GROUP BY k.id, k.codigo, k.numero, k.tipo, k.estado, k.saldo_actual,
                 p.nombres, p.apellido_paterno, p.apellido_materno, a.nombre, c.nombre
        ORDER BY titular`,
      params,
    );
    return filas.map((f) => ({
      idKardex: f.id,
      codigo: f.codigo,
      numero: Number(f.numero),
      tipo: f.tipo,
      estado: f.estado,
      titular: f.titular ?? '',
      cargos: this.r2(f.debe),
      abonos: this.r2(f.haber),
      neto: this.r2(Number(f.debe) - Number(f.haber)),
      saldoActual: this.r2(f.saldo_actual),
      lineas: Number(f.lineas),
      ultimaFecha: f.ultima_fecha,
    }));
  }
}
