import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { PersonaCi } from '../comercio-interno/entities/persona-ci.entity';
import { Kardex } from '../contabilidad/entities/kardex.entity';
import { KardexActividadService } from '../contabilidad/services/kardex-actividad.service';
import { FiltroDashboardDto } from './dto/filtro-dashboard.dto';

// Fecha de recepción: se guarda como texto ISO; se lleva a día calendario de
// Bolivia para compararla con el rango (YYYY-MM-DD) del filtro.
const FECHA_RECEPCION = `((r.fecha_de_entrega)::timestamptz AT TIME ZONE 'America/La_Paz')::date`;
// Kg recibidos = Balanza L, igual que la valorización (pesoBrutoHumedoKilogramos).
// Balanza T no es una tara: restarla daba 20 - 18 = 2 kg en vez de 20.
const PESO_NETO = 'r.balanza_l';

// Estados de recepción que no cuentan como mineral recibido.
const ESTADOS_RECEPCION_EXCLUIDOS = [3, 4]; // RECHAZADO, CANCELADO
const ESTADO_VALORIZACION_BORRADOR = 1;
const ESTADO_VALORIZACION_PRE_VALORIZADO = 2;
const ESTADO_VALORIZACION_VALORIZADO = 3;

// Pendientes con más de estos días se muestran como alerta.
const DIAS_ALERTA_PENDIENTE = 7;
const LIMITE_RANKING = 5;
const LIMITE_DEUDORES = 10;

/** Monto de un recibo llevado a Bs (USD × tipo de cambio). */
const sqlBs = (alias: string) =>
  `ROUND(CASE WHEN ${alias}.moneda = 'USD' THEN ${alias}.monto_total * ${alias}.tipo_cambio ELSE ${alias}.monto_total END, 2)`;

export interface Rango {
  desde: string;
  hasta: string;
}

export type NivelAlerta = 'alta' | 'media' | 'info';

export interface Alerta {
  nivel: NivelAlerta;
  modulo: 'comercio' | 'contabilidad' | 'configuracion';
  titulo: string;
  detalle: string;
  cantidad: number;
  ruta: string;
}

/**
 * Pantalla de inicio: agrega en una sola respuesta los indicadores del
 * negocio. Todo sale de consultas de agregación (nada de traer listados para
 * sumarlos en el front).
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectDataSource('ci')
    private readonly dataSource: DataSource,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    private readonly kardexActividadService: KardexActividadService,
  ) {}

  async resumen(filtro: FiltroDashboardDto) {
    const hoy = this.hoy();
    const periodo = this.resolverRango(filtro, hoy);
    const anterior = this.rangoAnterior(periodo);

    const [
      recibido,
      recibidoAnterior,
      valorizado,
      valorizadoAnterior,
      pagado,
      pagadoAnterior,
      cobradoVentas,
      liquidez,
      kardex,
      enProceso,
      topProveedores,
      topClientes,
      ingresoMensual,
      deudores,
      cobranzas,
      cotizaciones,
      alertas,
    ] = await Promise.all([
      this.mineralRecibido(periodo),
      this.mineralRecibido(anterior),
      this.valorizado(periodo),
      this.valorizado(anterior),
      this.pagadoValorizaciones(periodo),
      this.pagadoValorizaciones(anterior),
      this.cobradoVentas(periodo),
      this.liquidez(),
      this.totalesKardex(),
      this.lotesEnProceso(periodo),
      this.topProveedores(periodo),
      this.topClientes(periodo),
      this.ingresoMensual(periodo.hasta),
      this.deudores(),
      this.cobranzas(hoy),
      this.cotizacionesVigentes(),
      this.alertas(hoy),
    ]);

    return {
      periodo,
      periodoAnterior: anterior,
      indicadores: {
        mineralRecibido: { ...recibido, anterior: recibidoAnterior },
        valorizado: { ...valorizado, anterior: valorizadoAnterior },
        pagadoValorizaciones: { ...pagado, anterior: pagadoAnterior },
        cobradoVentas,
        liquidez,
        kardex,
      },
      enProceso,
      topProveedores,
      topClientes,
      ingresoMensual,
      deudores,
      cobranzas,
      cotizaciones,
      alertas,
    };
  }

  //---------------------------------------------------------------------
  // Indicadores
  //---------------------------------------------------------------------

  private async mineralRecibido({ desde, hasta }: Rango) {
    const [f] = await this.dataSource.query(
      `SELECT COUNT(*) AS lotes,
              COALESCE(SUM(r.numero_sacos), 0) AS sacos,
              COALESCE(SUM(${PESO_NETO}), 0) AS kg_neto,
              COALESCE(SUM(r.anticipo), 0) AS anticipos,
              COUNT(DISTINCT COALESCE(
                'P' || r.id_persona,
                'A' || r.id_actor_productivo_minero,
                'X' || UPPER(BTRIM(r.nombres_apellidos)))) AS proveedores
         FROM comercio_interno.recepcion_mineral r
        WHERE r.activo = true
          AND r.id_estado <> ALL($3::int[])
          AND ${FECHA_RECEPCION} BETWEEN $1 AND $2`,
      [desde, hasta, ESTADOS_RECEPCION_EXCLUIDOS],
    );
    return {
      lotes: Number(f.lotes),
      sacos: Number(f.sacos),
      kgNeto: this.r2(f.kg_neto),
      anticiposBs: this.r2(f.anticipos),
      proveedores: Number(f.proveedores),
    };
  }

  /** Valorizaciones cerradas (VALORIZADO) con fecha de valorización en el rango. */
  private async valorizado({ desde, hasta }: Rango) {
    const [f] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad,
              COALESCE(SUM(v.total_valor_neto_venta_bolivianos), 0) AS liquidacion,
              COALESCE(SUM(v.total_valor_liquido_venta_bolivianos), 0) AS liquido_pagable,
              COALESCE(SUM(v.peso_neto_seco_kilogramos), 0) AS kg_neto_seco
         FROM comercio_interno.valorizacion_mineral v
        WHERE v.activo = true
          AND v.id_estado_valorizacion = $3
          AND v.fecha_valorizacion BETWEEN $1 AND $2`,
      [desde, hasta, ESTADO_VALORIZACION_VALORIZADO],
    );
    return {
      cantidad: Number(f.cantidad),
      totalLiquidacionBs: this.r2(f.liquidacion),
      liquidoPagableBs: this.r2(f.liquido_pagable),
      kgNetoSeco: this.r2(f.kg_neto_seco),
    };
  }

  /** Pagos a proveedores: recibos EGRESO procesados de una valorización. */
  private async pagadoValorizaciones({ desde, hasta }: Rango) {
    const [f] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(${sqlBs('r')}), 0) AS monto
         FROM contabilidad.recibo r
        WHERE r.activo = true
          AND r.estado = 'PROCESADO'
          AND r.tipo = 'EGRESO'
          AND r.id_valorizacion_mineral IS NOT NULL
          AND r.fecha BETWEEN $1 AND $2`,
      [desde, hasta],
    );
    return { cantidad: Number(f.cantidad), montoBs: this.r2(f.monto) };
  }

  /** Cobros a compradores: recibos INGRESO procesados de una venta de lote. */
  private async cobradoVentas({ desde, hasta }: Rango) {
    const [f] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(${sqlBs('r')}), 0) AS monto
         FROM contabilidad.recibo r
        WHERE r.activo = true
          AND r.estado = 'PROCESADO'
          AND r.tipo = 'INGRESO'
          AND r.id_venta_lote IS NOT NULL
          AND r.fecha BETWEEN $1 AND $2`,
      [desde, hasta],
    );
    return { cantidad: Number(f.cantidad), montoBs: this.r2(f.monto) };
  }

  /**
   * Saldo actual de cada caja (por moneda) y cuenta bancaria: el del último
   * período mensual (saldo final si está cerrado; si está abierto, inicial ±
   * movimientos, que el recálculo mantiene al día). Sin períodos: saldo inicial.
   */
  private async liquidez() {
    const cajas: Array<{ id: string; nombre: string; moneda: string; saldo: string; con_movimientos: boolean }> =
      await this.dataSource.query(
        `WITH ultimo AS (
           SELECT DISTINCT ON (p.id_caja, p.moneda) p.*
             FROM contabilidad.periodo_caja p
            WHERE p.activo = true AND p.tipo = 'MENSUAL'
            ORDER BY p.id_caja, p.moneda, p.gestion DESC, p.mes DESC
         )
         SELECT c.id, c.nombre, m.moneda, (u.id IS NOT NULL) AS con_movimientos,
                COALESCE(
                  CASE WHEN u.estado = 'CERRADO' THEN u.saldo_final
                       ELSE u.saldo_inicial + u.total_ingreso - u.total_egreso END,
                  CASE m.moneda WHEN 'BS' THEN c.saldo_inicial_bs ELSE c.saldo_inicial_usd END,
                  0) AS saldo
           FROM parametrica.caja c
          CROSS JOIN (VALUES ('BS'), ('USD')) AS m(moneda)
           LEFT JOIN ultimo u ON u.id_caja = c.id AND u.moneda = m.moneda
          WHERE c.activo = true
          ORDER BY c.nombre, m.moneda`,
      );

    const bancos: Array<{ id: string; nombre: string; numero_cuenta: string; moneda: string; saldo: string }> =
      await this.dataSource.query(
        `WITH ultimo AS (
           SELECT DISTINCT ON (p.id_cuenta_bancaria) p.*
             FROM contabilidad.periodo_banco p
            WHERE p.activo = true AND p.tipo = 'MENSUAL'
            ORDER BY p.id_cuenta_bancaria, p.gestion DESC, p.mes DESC
         )
         SELECT cb.id, COALESCE(NULLIF(cb.alias, ''), ef.sigla, ef.nombre) AS nombre,
                cb.numero_cuenta, cb.moneda,
                COALESCE(
                  CASE WHEN u.estado = 'CERRADO' THEN u.saldo_final
                       ELSE u.saldo_inicial - u.total_debe + u.total_haber END,
                  cb.saldo_inicial,
                  0) AS saldo
           FROM parametrica.cuenta_bancaria cb
           JOIN parametrica.entidad_financiera ef ON ef.id = cb.id_entidad_financiera
           LEFT JOIN ultimo u ON u.id_cuenta_bancaria = cb.id
          WHERE cb.activo = true
          ORDER BY nombre`,
      );

    // Una caja en USD sin movimientos ni saldo inicial no aporta nada: se omite.
    const detalleCajas = cajas
      .filter((c) => c.moneda === 'BS' || c.con_movimientos || Number(c.saldo) !== 0)
      .map((c) => ({ id: c.id, nombre: c.nombre, moneda: c.moneda, saldo: this.r2(c.saldo) }));
    const detalleBancos = bancos.map((b) => ({
      id: b.id,
      nombre: b.nombre,
      numeroCuenta: b.numero_cuenta,
      moneda: b.moneda,
      saldo: this.r2(b.saldo),
    }));
    const suma = (filas: Array<{ moneda: string; saldo: number }>, moneda: string) =>
      this.r2(filas.filter((f) => f.moneda === moneda).reduce((s, f) => s + f.saldo, 0));

    return {
      cajaBs: suma(detalleCajas, 'BS'),
      cajaUsd: suma(detalleCajas, 'USD'),
      bancosBs: suma(detalleBancos, 'BS'),
      bancosUsd: suma(detalleBancos, 'USD'),
      cajas: detalleCajas,
      bancos: detalleBancos,
    };
  }

  /** Saldos de kardex abiertos: positivo = nos deben; negativo = debemos. */
  private async totalesKardex() {
    const [f] = await this.dataSource.query(
      `SELECT COALESCE(SUM(k.saldo_actual) FILTER (WHERE k.saldo_actual > 0), 0) AS por_cobrar,
              COUNT(*) FILTER (WHERE k.saldo_actual > 0) AS deudores,
              COALESCE(-SUM(k.saldo_actual) FILTER (WHERE k.saldo_actual < 0), 0) AS por_pagar,
              COUNT(*) FILTER (WHERE k.saldo_actual < 0) AS acreedores
         FROM contabilidad.kardex k
        WHERE k.activo = true AND k.estado = 'ABIERTO'`,
    );
    return {
      porCobrarBs: this.r2(f.por_cobrar),
      deudores: Number(f.deudores),
      porPagarBs: this.r2(f.por_pagar),
      acreedores: Number(f.acreedores),
    };
  }

  //---------------------------------------------------------------------
  // Comercio interno
  //---------------------------------------------------------------------

  /** Dónde está el trabajo: lotes sin valorizar, borradores, pre-valorizados y ciclo. */
  private async lotesEnProceso({ desde, hasta }: Rango) {
    const [sinValorizar] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad,
              COALESCE(SUM(${PESO_NETO}), 0) AS kg,
              MAX(CURRENT_DATE - ${FECHA_RECEPCION}) AS dias_max
         FROM comercio_interno.recepcion_mineral r
        WHERE r.activo = true
          AND r.id_estado <> ALL($1::int[])
          AND NOT EXISTS (
            SELECT 1 FROM comercio_interno.valorizacion_mineral v
             WHERE v.id_recepcion_mineral = r.id AND v.activo = true)`,
      [ESTADOS_RECEPCION_EXCLUIDOS],
    );

    const porEstado: Array<{ id_estado: number; cantidad: string; dias_max: string | null }> =
      await this.dataSource.query(
        `SELECT v.id_estado_valorizacion AS id_estado, COUNT(*) AS cantidad,
                MAX(CURRENT_DATE - (v.fecha_ultima_modificacion AT TIME ZONE 'America/La_Paz')::date) AS dias_max
           FROM comercio_interno.valorizacion_mineral v
          WHERE v.activo = true AND v.id_estado_valorizacion = ANY($1::int[])
          GROUP BY v.id_estado_valorizacion`,
        [[ESTADO_VALORIZACION_BORRADOR, ESTADO_VALORIZACION_PRE_VALORIZADO]],
      );
    const estado = (id: number) => porEstado.find((e) => Number(e.id_estado) === id);

    const [ciclo] = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (v.fecha_registro - (r.fecha_de_entrega)::timestamptz)) / 86400) AS promedio
         FROM comercio_interno.valorizacion_mineral v
         JOIN comercio_interno.recepcion_mineral r ON r.id = v.id_recepcion_mineral
        WHERE v.activo = true
          AND (v.fecha_registro AT TIME ZONE 'America/La_Paz')::date BETWEEN $1 AND $2`,
      [desde, hasta],
    );

    const resumenEstado = (id: number) => ({
      cantidad: Number(estado(id)?.cantidad ?? 0),
      diasMax: estado(id)?.dias_max != null ? Number(estado(id)!.dias_max) : null,
    });

    return {
      sinValorizar: {
        cantidad: Number(sinValorizar.cantidad),
        kg: this.r2(sinValorizar.kg),
        diasMax: sinValorizar.dias_max != null ? Number(sinValorizar.dias_max) : null,
      },
      borradores: resumenEstado(ESTADO_VALORIZACION_BORRADOR),
      preValorizados: resumenEstado(ESTADO_VALORIZACION_PRE_VALORIZADO),
      cicloPromedioDias: ciclo?.promedio != null ? Math.round(Number(ciclo.promedio) * 10) / 10 : null,
    };
  }

  /** Proveedores con más kg entregados en el período, y lo valorizado de esos lotes. */
  private async topProveedores({ desde, hasta }: Rango) {
    const filas: Array<Record<string, string>> = await this.dataSource.query(
      `SELECT r.id_persona,
              COALESCE(
                NULLIF(regexp_replace(TRIM(CONCAT_WS(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), '\\s+', ' ', 'g'), ''),
                MAX(r.nombres_apellidos)) AS nombre,
              COUNT(*) AS lotes,
              COALESCE(SUM(${PESO_NETO}), 0) AS kg,
              COALESCE(SUM(r.anticipo), 0) AS anticipos,
              COALESCE(SUM((
                SELECT v.total_valor_neto_venta_bolivianos
                  FROM comercio_interno.valorizacion_mineral v
                 WHERE v.id_recepcion_mineral = r.id AND v.activo = true
                   AND v.id_estado_valorizacion = $3
                 ORDER BY v.id DESC LIMIT 1)), 0) AS valorizado
         FROM comercio_interno.recepcion_mineral r
         LEFT JOIN parametrica.persona_ci p ON p.id = r.id_persona
        WHERE r.activo = true
          AND r.id_estado <> ALL($4::int[])
          AND ${FECHA_RECEPCION} BETWEEN $1 AND $2
        GROUP BY r.id_persona, p.nombres, p.apellido_paterno, p.apellido_materno,
                 CASE WHEN r.id_persona IS NULL THEN r.nombres_apellidos END
        ORDER BY SUM(${PESO_NETO}) DESC
        LIMIT ${LIMITE_RANKING}`,
      [desde, hasta, ESTADO_VALORIZACION_VALORIZADO, ESTADOS_RECEPCION_EXCLUIDOS],
    );
    return filas.map((f) => ({
      idPersona: f.id_persona,
      nombre: f.nombre,
      lotes: Number(f.lotes),
      kg: this.r2(f.kg),
      anticiposBs: this.r2(f.anticipos),
      valorizadoBs: this.r2(f.valorizado),
    }));
  }

  /** Compradores con más ventas de lote en el período. */
  private async topClientes({ desde, hasta }: Rango) {
    const filas: Array<Record<string, string>> = await this.dataSource.query(
      `SELECT c.id, c.nombre,
              COUNT(*) AS lotes,
              COALESCE(SUM(vl.monto_venta_bolivianos), 0) AS monto_venta,
              COALESCE(SUM(vl.total_efectivo_invertido), 0) AS invertido,
              COUNT(*) FILTER (WHERE vl.estado = 'ABIERTA') AS abiertas
         FROM contabilidad.venta_lote vl
         JOIN parametrica.cliente c ON c.id = vl.id_cliente
        WHERE vl.activo = true
          AND vl.estado <> 'ANULADA'
          AND vl.fecha_venta BETWEEN $1 AND $2
        GROUP BY c.id, c.nombre
        ORDER BY SUM(COALESCE(vl.monto_venta_bolivianos, vl.total_efectivo_invertido)) DESC
        LIMIT ${LIMITE_RANKING}`,
      [desde, hasta],
    );
    return filas.map((f) => ({
      idCliente: f.id,
      nombre: f.nombre,
      lotes: Number(f.lotes),
      montoVentaBs: this.r2(f.monto_venta),
      invertidoBs: this.r2(f.invertido),
      ventasAbiertas: Number(f.abiertas),
    }));
  }

  /** Kg netos recibidos por mes y codificación, 12 meses hasta el mes de `hasta`. */
  private async ingresoMensual(hasta: string) {
    const filas: Array<{ mes: string; codigo: string; kg: string }> = await this.dataSource.query(
      `SELECT to_char(date_trunc('month', ${FECHA_RECEPCION}), 'YYYY-MM') AS mes,
              cod.codigo, COALESCE(SUM(${PESO_NETO}), 0) AS kg
         FROM comercio_interno.recepcion_mineral r
         JOIN parametrica.codificacion cod ON cod.id = r.id_codificacion
        WHERE r.activo = true
          AND r.id_estado <> ALL($2::int[])
          AND ${FECHA_RECEPCION} >= (date_trunc('month', $1::date) - INTERVAL '11 months')::date
          AND ${FECHA_RECEPCION} <= $1::date
        GROUP BY 1, 2
        ORDER BY 1, 2`,
      [hasta, ESTADOS_RECEPCION_EXCLUIDOS],
    );

    const [anio, mes] = hasta.split('-').map(Number);
    const meses = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(anio, mes - 12 + i, 1));
      return d.toISOString().slice(0, 7);
    });
    const codigos = [...new Set(filas.map((f) => f.codigo))];
    return {
      meses,
      series: codigos.map((codigo) => ({
        codigo,
        kg: meses.map((m) => this.r2(filas.find((f) => f.mes === m && f.codigo === codigo)?.kg ?? 0)),
      })),
    };
  }

  //---------------------------------------------------------------------
  // Contabilidad
  //---------------------------------------------------------------------

  /**
   * Deudores: kardex abiertos con saldo por cobrar (mismo criterio que el
   * Excel "RESUMEN DE DEUDAS"), mayores primero, con su actividad.
   */
  private async deudores() {
    const kardexs = await this.kardexRepository
      .createQueryBuilder('kardex')
      .leftJoinAndSelect('kardex.actorProductivoMinero', 'actor')
      .leftJoinAndSelect('kardex.persona', 'persona')
      .leftJoinAndSelect('kardex.cliente', 'cliente')
      .where('kardex.estado = :estado', { estado: 'ABIERTO' })
      .andWhere('kardex.activo = true')
      .andWhere('kardex.saldoActual > 0')
      .orderBy('kardex.saldoActual', 'DESC')
      .getMany();

    const actividades = await this.kardexActividadService.actividades(kardexs);
    const filas = kardexs.map((k) => {
      const actividad = actividades.get(String(k.id));
      return {
        idKardex: k.id,
        codigoKardex: k.codigo,
        tipo: k.tipo,
        nombre: this.nombreTitular(k),
        idPersona: k.idPersona ?? null,
        idActorProductivoMinero: k.idActorProductivoMinero ?? null,
        idCliente: k.idCliente ?? null,
        saldoBs: this.r2(k.saldoActual),
        ultimaActividad: actividad?.ultimaActividad ?? null,
        diasSinActividad: actividad?.diasSinActividad ?? null,
        activo: actividad ? actividad.estado === 'ACTIVO' : true,
      };
    });

    return {
      total: filas.length,
      inactivos: filas.filter((f) => !f.activo).length,
      totalBs: this.r2(filas.reduce((s, f) => s + f.saldoBs, 0)),
      lista: filas.slice(0, LIMITE_DEUDORES),
    };
  }

  /** Plata que está afuera: ventas por cobrar, anticipos sin respaldo, préstamos, bienes, fondos. */
  private async cobranzas(hoy: string) {
    const ventas: Array<Record<string, string>> = await this.dataSource.query(
      `SELECT vl.id, vl.codigo_lote, c.nombre AS cliente, vl.fecha_liquidacion,
              vl.monto_venta_bolivianos AS monto,
              COALESCE(cob.cobrado, 0) AS cobrado
         FROM contabilidad.venta_lote vl
         JOIN parametrica.cliente c ON c.id = vl.id_cliente
         LEFT JOIN LATERAL (
           SELECT SUM(${sqlBs('r')}) AS cobrado
             FROM contabilidad.recibo r
            WHERE r.id_venta_lote = vl.id AND r.activo = true AND r.estado = 'PROCESADO'
         ) cob ON true
        WHERE vl.activo = true
          AND vl.estado = 'LIQUIDADA'
          AND COALESCE(vl.monto_venta_bolivianos, 0) - COALESCE(cob.cobrado, 0) > 0.005
        ORDER BY COALESCE(vl.monto_venta_bolivianos, 0) - COALESCE(cob.cobrado, 0) DESC`,
    );

    const [abiertas] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(vl.total_efectivo_invertido), 0) AS invertido
         FROM contabilidad.venta_lote vl
        WHERE vl.activo = true AND vl.estado = 'ABIERTA'`,
    );

    // Anticipos entregados en recepción cuyo lote todavía no está valorizado.
    const [anticipos] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(r.anticipo), 0) AS monto
         FROM comercio_interno.recepcion_mineral r
        WHERE r.activo = true
          AND COALESCE(r.anticipo, 0) > 0
          AND r.id_estado <> ALL($2::int[])
          AND NOT EXISTS (
            SELECT 1 FROM comercio_interno.valorizacion_mineral v
             WHERE v.id_recepcion_mineral = r.id AND v.activo = true
               AND v.id_estado_valorizacion = $1)`,
      [ESTADO_VALORIZACION_VALORIZADO, ESTADOS_RECEPCION_EXCLUIDOS],
    );

    const [prestamos] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(p.saldo), 0) AS saldo
         FROM contabilidad.prestamo_personal p
        WHERE p.activo = true AND p.estado = 'VIGENTE'`,
    );

    const [bienes] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(b.valor_referencial), 0) AS valor
         FROM contabilidad.bien_dacion_pago b
        WHERE b.activo = true AND b.estado IN ('EN_POSESION', 'TOMADO_EN_PAGO')`,
    );

    const [fondos] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad,
              COUNT(*) FILTER (WHERE f.fecha_limite < $1) AS vencidos,
              COALESCE(SUM(GREATEST(f.monto_entregado - COALESCE(d.rendido, 0), 0)), 0) AS por_rendir
         FROM contabilidad.fondo_rendir f
         LEFT JOIN LATERAL (
           SELECT SUM(fd.monto) AS rendido
             FROM contabilidad.fondo_rendir_detalle fd
            WHERE fd.id_fondo_rendir = f.id AND fd.activo = true
         ) d ON true
        WHERE f.activo = true AND f.estado IN ('PENDIENTE', 'RENDIDO_PARCIAL')`,
      [hoy],
    );

    return {
      ventasPorCobrar: {
        cantidad: ventas.length,
        totalBs: this.r2(ventas.reduce((s, v) => s + Number(v.monto) - Number(v.cobrado), 0)),
        lista: ventas.slice(0, LIMITE_RANKING).map((v) => ({
          idVentaLote: v.id,
          codigoLote: v.codigo_lote,
          cliente: v.cliente,
          fechaLiquidacion: v.fecha_liquidacion,
          porCobrarBs: this.r2(Number(v.monto) - Number(v.cobrado)),
        })),
      },
      ventasAbiertas: { cantidad: Number(abiertas.cantidad), invertidoBs: this.r2(abiertas.invertido) },
      anticiposSinValorizar: { cantidad: Number(anticipos.cantidad), montoBs: this.r2(anticipos.monto) },
      prestamosPersonal: { cantidad: Number(prestamos.cantidad), saldoBs: this.r2(prestamos.saldo) },
      bienesDacion: { cantidad: Number(bienes.cantidad), valorBs: this.r2(bienes.valor) },
      fondosRendir: {
        cantidad: Number(fondos.cantidad),
        vencidos: Number(fondos.vencidos),
        porRendirBs: this.r2(fondos.por_rendir),
      },
    };
  }

  /** Cotización vigente hoy de cada mineral que alguna vez tuvo cotización. */
  private async cotizacionesVigentes() {
    const filas: Array<Record<string, string | null>> = await this.dataSource.query(
      `SELECT m.id, m.descripcion, m.simbolo, m.unidad_cotizacion,
              vig.cotizacion_mineral_dolares AS cotizacion,
              vig.fecha_vigencia_final AS vigente_hasta
         FROM parametrica.mineral m
         LEFT JOIN LATERAL (
           SELECT c.cotizacion_mineral_dolares, c.fecha_vigencia_final
             FROM parametrica.cotizacion_mineral c
            WHERE c.id_mineral = m.id AND c.activo = true
              AND c.fecha_vigencia_inicial <= now()
              AND (c.fecha_vigencia_final IS NULL OR c.fecha_vigencia_final >= now())
            ORDER BY c.fecha_vigencia_inicial DESC
            LIMIT 1
         ) vig ON true
        WHERE m.activo = true
          AND EXISTS (SELECT 1 FROM parametrica.cotizacion_mineral c
                       WHERE c.id_mineral = m.id AND c.activo = true)
        ORDER BY m.descripcion`,
    );
    return filas.map((f) => ({
      idMineral: f.id,
      mineral: f.descripcion,
      simbolo: f.simbolo,
      unidad: f.unidad_cotizacion,
      cotizacionUsd: f.cotizacion != null ? Number(f.cotizacion) : null,
      vigenteHasta: f.vigente_hasta,
    }));
  }

  //---------------------------------------------------------------------
  // Alertas
  //---------------------------------------------------------------------

  private async alertas(hoy: string): Promise<Alerta[]> {
    const [anio, mes] = hoy.split('-').map(Number);
    const [f] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM parametrica.mineral m
           WHERE m.activo = true
             AND EXISTS (SELECT 1 FROM parametrica.cotizacion_mineral c
                          WHERE c.id_mineral = m.id AND c.activo = true)
             AND NOT EXISTS (SELECT 1 FROM parametrica.cotizacion_mineral c
                              WHERE c.id_mineral = m.id AND c.activo = true
                                AND c.fecha_vigencia_inicial <= now()
                                AND (c.fecha_vigencia_final IS NULL OR c.fecha_vigencia_final >= now()))
         ) AS minerales_sin_cotizacion,
         (SELECT COUNT(*) FROM contabilidad.recibo r
           WHERE r.activo = true AND r.estado = 'BORRADOR') AS recibos_borrador,
         (SELECT MIN(r.fecha) FROM contabilidad.recibo r
           WHERE r.activo = true AND r.estado = 'BORRADOR') AS recibo_borrador_mas_antiguo,
         (SELECT COUNT(*) FROM contabilidad.periodo_caja p
           WHERE p.activo = true AND p.tipo = 'MENSUAL' AND p.estado = 'ABIERTO'
             AND (p.gestion * 12 + p.mes) < ($1 * 12 + $2)) AS periodos_caja_abiertos,
         (SELECT COUNT(*) FROM contabilidad.periodo_banco p
           WHERE p.activo = true AND p.tipo = 'MENSUAL' AND p.estado = 'ABIERTO'
             AND (p.gestion * 12 + p.mes) < ($1 * 12 + $2)) AS periodos_banco_abiertos,
         (SELECT COUNT(*) FROM comercio_interno.valorizacion_mineral v
           WHERE v.activo = true AND v.id_estado_valorizacion = $3
             AND (v.fecha_ultima_modificacion AT TIME ZONE 'America/La_Paz')::date <= $5::date - $4::int
         ) AS pre_valorizados_antiguos,
         (SELECT COUNT(*) FROM comercio_interno.recepcion_mineral r
           WHERE r.activo = true AND r.id_estado <> ALL($6::int[])
             AND ${FECHA_RECEPCION} <= $5::date - $4::int
             AND NOT EXISTS (SELECT 1 FROM comercio_interno.valorizacion_mineral v
                              WHERE v.id_recepcion_mineral = r.id AND v.activo = true)
         ) AS recepciones_sin_valorizar,
         (SELECT COUNT(*) FROM contabilidad.fondo_rendir fr
           WHERE fr.activo = true AND fr.estado IN ('PENDIENTE', 'RENDIDO_PARCIAL')
             AND fr.fecha_limite < $5::date) AS fondos_vencidos`,
      [
        anio,
        mes,
        ESTADO_VALORIZACION_PRE_VALORIZADO,
        DIAS_ALERTA_PENDIENTE,
        hoy,
        ESTADOS_RECEPCION_EXCLUIDOS,
      ],
    );

    const alertas: Alerta[] = [];
    const agregar = (cantidad: number, alerta: Omit<Alerta, 'cantidad'>) => {
      if (cantidad > 0) alertas.push({ ...alerta, cantidad });
    };

    agregar(Number(f.minerales_sin_cotizacion), {
      nivel: 'alta',
      modulo: 'configuracion',
      titulo: 'Cotización sin vigencia',
      detalle: 'Hay minerales sin cotización vigente hoy: las valorizaciones no podrán calcularse.',
      ruta: '/configuraciones/parametricas',
    });
    agregar(Number(f.periodos_caja_abiertos) + Number(f.periodos_banco_abiertos), {
      nivel: 'alta',
      modulo: 'contabilidad',
      titulo: 'Meses anteriores sin cerrar',
      detalle: `Caja: ${f.periodos_caja_abiertos} · Bancos: ${f.periodos_banco_abiertos} períodos mensuales siguen abiertos.`,
      ruta: Number(f.periodos_caja_abiertos) > 0 ? '/contabilidad/caja-flujo' : '/contabilidad/libreta-bancaria',
    });
    agregar(Number(f.fondos_vencidos), {
      nivel: 'alta',
      modulo: 'contabilidad',
      titulo: 'Fondos a rendir vencidos',
      detalle: 'Pasaron su fecha límite sin rendirse por completo.',
      ruta: '/contabilidad/fondo-rendir',
    });
    agregar(Number(f.recibos_borrador), {
      nivel: 'media',
      modulo: 'contabilidad',
      titulo: 'Recibos en borrador',
      detalle: f.recibo_borrador_mas_antiguo
        ? `El más antiguo es del ${this.fechaTexto(f.recibo_borrador_mas_antiguo)}; aún no mueven caja ni kardex.`
        : 'Aún no mueven caja ni kardex.',
      ruta: '/contabilidad/recibos',
    });
    agregar(Number(f.pre_valorizados_antiguos), {
      nivel: 'media',
      modulo: 'comercio',
      titulo: 'Pre-valorizados sin cerrar',
      detalle: `Llevan ${DIAS_ALERTA_PENDIENTE} días o más sin pasar a VALORIZADO.`,
      ruta: '/ui-components/valorizacion',
    });
    agregar(Number(f.recepciones_sin_valorizar), {
      nivel: 'media',
      modulo: 'comercio',
      titulo: 'Recepciones sin valorizar',
      detalle: `Lotes recibidos hace ${DIAS_ALERTA_PENDIENTE} días o más que no tienen valorización.`,
      ruta: '/ui-components/recepcion-minerales',
    });

    return alertas;
  }

  //---------------------------------------------------------------------
  // Utilidades
  //---------------------------------------------------------------------

  private resolverRango(filtro: FiltroDashboardDto, hoy: string): Rango {
    const desde = filtro.fechaDesde?.slice(0, 10) ?? `${hoy.slice(0, 7)}-01`;
    const hasta = filtro.fechaHasta?.slice(0, 10) ?? hoy;
    if (desde > hasta) {
      throw new BadRequestException('fechaDesde no puede ser posterior a fechaHasta.');
    }
    return { desde, hasta };
  }

  /** Período de la misma duración inmediatamente anterior. */
  private rangoAnterior({ desde, hasta }: Rango): Rango {
    const dia = 24 * 60 * 60 * 1000;
    const inicio = Date.parse(`${desde}T00:00:00Z`);
    const fin = Date.parse(`${hasta}T00:00:00Z`);
    const dias = Math.round((fin - inicio) / dia) + 1;
    const finAnterior = inicio - dia;
    const inicioAnterior = finAnterior - (dias - 1) * dia;
    const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
    return { desde: iso(inicioAnterior), hasta: iso(finAnterior) };
  }

  private nombreTitular(kardex: Kardex): string {
    if (kardex.tipo === 'ACTOR' && kardex.actorProductivoMinero) {
      return kardex.actorProductivoMinero.nombre?.toUpperCase() ?? 'S/N';
    }
    if (kardex.tipo === 'CLIENTE' && kardex.cliente) {
      return kardex.cliente.nombre?.toUpperCase() ?? 'S/N';
    }
    return this.nombreCompleto(kardex.persona) || 'S/N';
  }

  private nombreCompleto(persona?: PersonaCi | null): string {
    if (!persona) return '';
    return [persona.nombres, persona.apellidoPaterno, persona.apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private fechaTexto(fecha: string | Date): string {
    const iso = typeof fecha === 'string' ? fecha.slice(0, 10) : fecha.toISOString().slice(0, 10);
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  /** Fecha de hoy en Bolivia (UTC-4), "YYYY-MM-DD", igual que KardexService. */
  private hoy(): string {
    return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private r2(valor: unknown): number {
    return Math.round(Number(valor ?? 0) * 100) / 100;
  }
}
