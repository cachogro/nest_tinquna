import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { MovimientoCaja } from '../entities/movimiento-caja.entity';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { FiltroReporteDestinoGastoDto } from '../dto/reporte/filtro-reporte-destino-gasto.dto';

interface FilaResumen {
  idDestinoGasto: string | null;
  nombre: string;
  esEgreso: boolean | null;
  totalIngreso: string;
  totalEgreso: string;
  cantidad: string;
}

/**
 * Reporte de "cuánto se gastó/ingresó" por destino del gasto, combinando la
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
export class ReporteDestinoGastoService {
  constructor(
    @InjectRepository(MovimientoCaja, 'ci')
    private readonly movimientoCajaRepository: Repository<MovimientoCaja>,

    @InjectRepository(LibretaBanco, 'ci')
    private readonly libretaBancoRepository: Repository<LibretaBanco>,

    @InjectRepository(DestinoGasto, 'ci')
    private readonly destinoGastoRepository: Repository<DestinoGasto>,
  ) {}

  private r2(n: number | string): number {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  /** `parametrica.cuenta_bancaria` usa 'BS'/'USD' para la misma moneda que acá es 'BS'/'USD'. */
  private monedaCuentaDeMoneda(moneda: 'BS' | 'USD'): 'BS' | 'USD' {
    return moneda === 'USD' ? 'USD' : 'BS';
  }

  private validarRangoFechas(filtro: FiltroReporteDestinoGastoDto): void {
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
    filtro: FiltroReporteDestinoGastoDto,
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
    filtro: FiltroReporteDestinoGastoDto,
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
   * Una fila por destino de gasto con lo ganado (ingreso), lo gastado
   * (egreso) y el neto (ingreso - egreso), sumando caja + bancos. Los
   * movimientos sin destino se agrupan como "SIN DESTINO".
   */
  async resumen(filtro: FiltroReporteDestinoGastoDto) {
    this.validarRangoFechas(filtro);

    const qbCaja = this.movimientoCajaRepository
      .createQueryBuilder('m')
      .leftJoin('m.destinoGasto', 'dg')
      .select('dg.id', 'idDestinoGasto')
      .addSelect(`COALESCE(dg.nombre, 'SIN DESTINO')`, 'nombre')
      .addSelect('dg.esEgreso', 'esEgreso')
      .addSelect('COALESCE(SUM(m.ingreso), 0)', 'totalIngreso')
      .addSelect('COALESCE(SUM(m.egreso), 0)', 'totalEgreso')
      .addSelect('COUNT(m.id)', 'cantidad')
      .groupBy('dg.id')
      .addGroupBy('dg.nombre')
      .addGroupBy('dg.esEgreso');
    this.aplicarFiltrosCaja(qbCaja, filtro);

    const qbBanco = this.libretaBancoRepository
      .createQueryBuilder('l')
      .innerJoin('l.cuentaBancaria', 'cb')
      .leftJoin('l.destinoGasto', 'dg')
      .select('dg.id', 'idDestinoGasto')
      .addSelect(`COALESCE(dg.nombre, 'SIN DESTINO')`, 'nombre')
      .addSelect('dg.esEgreso', 'esEgreso')
      .addSelect('COALESCE(SUM(l.haber), 0)', 'totalIngreso')
      .addSelect('COALESCE(SUM(l.debe), 0)', 'totalEgreso')
      .addSelect('COUNT(l.id)', 'cantidad')
      .groupBy('dg.id')
      .addGroupBy('dg.nombre')
      .addGroupBy('dg.esEgreso');
    this.aplicarFiltrosBanco(qbBanco, filtro);

    const [filasCaja, filasBanco] = await Promise.all([
      qbCaja.getRawMany<FilaResumen>(),
      qbBanco.getRawMany<FilaResumen>(),
    ]);

    // Combina ambos orígenes por destino: la misma categoría puede tener
    // movimientos en caja y en banco, así que se suman en un solo total.
    const combinados = new Map<
      string,
      {
        idDestinoGasto: number | null;
        nombre: string;
        esEgreso: boolean | null;
        cantidadMovimientos: number;
        totalIngreso: number;
        totalEgreso: number;
      }
    >();
    for (const f of [...filasCaja, ...filasBanco]) {
      const clave = f.idDestinoGasto === null ? 'SIN_DESTINO' : String(f.idDestinoGasto);
      const previo = combinados.get(clave) ?? {
        idDestinoGasto: f.idDestinoGasto === null ? null : Number(f.idDestinoGasto),
        nombre: f.nombre,
        esEgreso: f.esEgreso,
        cantidadMovimientos: 0,
        totalIngreso: 0,
        totalEgreso: 0,
      };
      previo.cantidadMovimientos += Number(f.cantidad);
      previo.totalIngreso = this.r2(previo.totalIngreso + this.r2(f.totalIngreso));
      previo.totalEgreso = this.r2(previo.totalEgreso + this.r2(f.totalEgreso));
      combinados.set(clave, previo);
    }

    const destinos = [...combinados.values()]
      .map((d) => ({ ...d, neto: this.r2(d.totalIngreso - d.totalEgreso) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const totalIngreso = this.r2(
      destinos.reduce((s, d) => s + d.totalIngreso, 0),
    );
    const totalEgreso = this.r2(destinos.reduce((s, d) => s + d.totalEgreso, 0));

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
      destinos,
    };
  }

  /**
   * Movimientos (de caja y de banco) de un destino de gasto puntual con sus
   * totales, en orden cronológico.
   */
  async detalle(idDestinoGasto: number, filtro: FiltroReporteDestinoGastoDto) {
    this.validarRangoFechas(filtro);

    const destino = await this.destinoGastoRepository.findOne({
      where: { id: idDestinoGasto },
    });
    if (!destino) {
      throw new NotFoundException('No se encontró el destino de gasto.');
    }

    const qbCaja = this.movimientoCajaRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.formaPago', 'fp')
      .leftJoinAndSelect('m.caja', 'c');
    this.aplicarFiltrosCaja(qbCaja, filtro);
    qbCaja.andWhere('m.idDestinoGasto = :idDestinoGasto', { idDestinoGasto });

    const qbBanco = this.libretaBancoRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.cuentaBancaria', 'cb');
    this.aplicarFiltrosBanco(qbBanco, filtro);
    qbBanco.andWhere('l.idDestinoGasto = :idDestinoGasto', { idDestinoGasto });

    const [movimientosCaja, movimientosBanco] = await Promise.all([
      qbCaja.getMany(),
      qbBanco.getMany(),
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
        ingreso: Number(m.ingreso),
        egreso: Number(m.egreso),
      })),
      ...movimientosBanco.map((l) => ({
        id: l.id,
        origen: 'BANCO' as const,
        fecha: l.fecha,
        cuenta: l.cuentaBancaria?.alias || l.cuentaBancaria?.numeroCuenta || null,
        concepto: l.concepto,
        contraparte: l.nombresApellidos ?? null,
        facturaRecibo: l.facturaRecibo ?? null,
        nroComprobante: l.nroTransaccion ?? null,
        formaPago: l.tipoTransaccion,
        ingreso: Number(l.haber),
        egreso: Number(l.debe),
      })),
    ].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

    const totalIngreso = this.r2(
      movimientos.reduce((s, m) => s + m.ingreso, 0),
    );
    const totalEgreso = this.r2(movimientos.reduce((s, m) => s + m.egreso, 0));

    return {
      destino: {
        id: destino.id,
        nombre: destino.nombre,
        esEgreso: destino.esEgreso,
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
    };
  }
}
