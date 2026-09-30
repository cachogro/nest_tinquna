import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ActividadKardex, Kardex } from '../entities/kardex.entity';

const DIAS_INACTIVIDAD_POR_DEFECTO = 60;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Baja lógica de kardex por inactividad. Un kardex ABIERTO queda INACTIVO
 * cuando pasan `KARDEX_DIAS_INACTIVIDAD` días (.env) desde su referencia de
 * actividad: lo más reciente entre
 *   - su último movimiento activo (la fecha del movimiento o el día en que
 *     se registró, la que sea posterior: un movimiento cargado hoy con fecha
 *     pasada también cuenta como actividad de hoy),
 *   - su apertura,
 *   - su última reactivación manual.
 *
 * El estado se calcula al vuelo (no se guarda, no hay proceso programado):
 * un cambio en el .env se aplica al instante. Un kardex INACTIVO sigue en los
 * listados y en el resumen de deudores, pero `validarActivo` rechaza las
 * transacciones nuevas hasta que un operador/admin lo reactive
 * (KardexService.reactivar), que reinicia el conteo.
 */
@Injectable()
export class KardexActividadService {
  constructor(
    private readonly configService: ConfigService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  get diasInactividad(): number {
    const dias = Number(this.configService.get('KARDEX_DIAS_INACTIVIDAD'));
    return Number.isFinite(dias) && dias > 0 ? Math.floor(dias) : DIAS_INACTIVIDAD_POR_DEFECTO;
  }

  /** Estado de actividad de cada kardex, por id. Null para cerrados o anulados. */
  async actividades(kardexs: Kardex[]): Promise<Map<string, ActividadKardex | null>> {
    const resultado = new Map<string, ActividadKardex | null>();
    const abiertos = kardexs.filter((k) => k.estado === 'ABIERTO' && k.activo !== false);
    const ultimos = await this.ultimosMovimientos(abiertos.map((k) => String(k.id)));
    kardexs.forEach((k) => {
      resultado.set(
        String(k.id),
        abiertos.includes(k) ? this.calcular(k, ultimos.get(String(k.id)) ?? null) : null,
      );
    });
    return resultado;
  }

  /** Completa `kardex.actividad` en cada elemento (para listados y detalle). */
  async completar<T extends Kardex>(kardexs: T[]): Promise<T[]> {
    const actividades = await this.actividades(kardexs);
    kardexs.forEach((k) => (k.actividad = actividades.get(String(k.id)) ?? null));
    return kardexs;
  }

  /**
   * Rechaza una transacción nueva sobre un kardex INACTIVO. Llamar después de
   * obtener el kardex abierto en cualquier flujo que postee una línea.
   */
  async validarActivo(kardex: Kardex): Promise<void> {
    const actividad = (await this.actividades([kardex])).get(String(kardex.id));
    if (actividad?.estado === 'INACTIVO') {
      throw new BadRequestException(
        `El kardex N° ${kardex.numero} (${kardex.tipo}) está INACTIVO desde el ${this.texto(actividad.inactivoDesde)}: ` +
          `${actividad.diasSinActividad} días sin movimientos (límite ${actividad.diasInactividad}). ` +
          'Un operador o administrador debe reactivarlo antes de registrar nuevas transacciones.',
      );
    }
  }

  calcular(kardex: Kardex, ultimoMovimiento: string | null): ActividadKardex {
    const dias = this.diasInactividad;
    const reactivacion = kardex.fechaReactivacion ? this.fechaBolivia(new Date(kardex.fechaReactivacion)) : null;
    const ultimaActividad = [ultimoMovimiento, this.iso(kardex.fechaApertura), reactivacion]
      .filter((f): f is string => !!f)
      .sort()
      .pop()!;
    const hoy = this.fechaBolivia(new Date());
    const inactivoDesde = this.sumarDias(ultimaActividad, dias);
    return {
      estado: hoy >= inactivoDesde ? 'INACTIVO' : 'ACTIVO',
      ultimaActividad,
      inactivoDesde,
      diasSinActividad: Math.max(0, this.diferenciaDias(ultimaActividad, hoy)),
      diasInactividad: dias,
    };
  }

  /** Último movimiento activo de cada kardex (YYYY-MM-DD, hora de Bolivia). */
  private async ultimosMovimientos(ids: string[]): Promise<Map<string, string>> {
    const mapa = new Map<string, string>();
    if (ids.length === 0) {
      return mapa;
    }
    const filas: { id_kardex: string; fecha: string | Date }[] = await this.dataSource.query(
      `SELECT m.id_kardex,
              MAX(GREATEST(m.fecha, (m.fecha_registro AT TIME ZONE 'America/La_Paz')::date)) AS fecha
         FROM contabilidad.movimiento_kardex m
        WHERE m.activo = true
          AND m.id_kardex = ANY($1::bigint[])
        GROUP BY m.id_kardex`,
      [ids],
    );
    filas.forEach((f) => mapa.set(String(f.id_kardex), this.iso(f.fecha)));
    return mapa;
  }

  /** Fecha de hoy/instante en Bolivia (UTC-4 fijo), "YYYY-MM-DD", igual que KardexService. */
  private fechaBolivia(instante: Date): string {
    return new Date(instante.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  /** Las columnas `date` pueden llegar como string o Date según el driver. */
  private iso(fecha: string | Date): string {
    return fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10);
  }

  private sumarDias(fecha: string, dias: number): string {
    return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
  }

  private diferenciaDias(desde: string, hasta: string): number {
    return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS);
  }

  private texto(fecha: string): string {
    const [anio, mes, dia] = fecha.split('-');
    return `${dia}/${mes}/${anio}`;
  }
}
