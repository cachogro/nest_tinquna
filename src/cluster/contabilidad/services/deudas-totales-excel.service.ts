import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worksheet } from 'exceljs';

import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { Kardex } from '../entities/kardex.entity';
import { FiltroDeudasTotalesDto } from '../dto/kardex/filtro-deudas-totales.dto';
import { KardexActividadService } from './kardex-actividad.service';
import {
  ColumnaContable,
  ContabilidadExcelService,
  PALETAS,
} from './contabilidad-excel.service';

const COLUMNAS: ColumnaContable[] = [
  { titulo: 'N°', ancho: 6, alineacion: 'center' },
  { titulo: 'ÚLTIMA INTERACCIÓN', ancho: 13, fecha: true },
  { titulo: 'CUENTA', ancho: 30 },
  { titulo: 'NOMBRE Y APELLIDO DEL QUE ACUMULA LA DEUDA', ancho: 32 },
  { titulo: 'IMPORTE DE ANTICIPOS', ancho: 16, importe: true },
  { titulo: 'IMPORTE TOTAL', ancho: 16, importe: true },
  { titulo: 'CORPORACIÓN', ancho: 22, alineacion: 'center' },
  { titulo: 'DEUDOR ACTIVO / INACTIVO', ancho: 18, alineacion: 'center' },
];
const TOTAL_COLUMNAS = COLUMNAS.length;
const COL_IMPORTE_TOTAL = 6;
const COL_CORPORACION = 7;
const COL_ESTADO = 8;

// Actor productivo minero que representa a la propia empresa: sus personas
// son personal interno, no forman una corporación deudora.
const ID_ACTOR_EMPRESA = '1';

interface FilaDeuda {
  fecha: string;
  cuenta: string;
  nombre: string;
  importe: number;
  activo: boolean;
  /** Primer día en que el deudor pasó a INACTIVO (solo si está inactivo). */
  inactivoDesde: string | null;
}

interface GrupoDeuda {
  corporacion: string;
  filas: FilaDeuda[];
}

/**
 * Genera el Excel "RESUMEN DE DEUDAS" (modelo "DEUDAS TOTALES.xlsx"): una
 * fila por cada kardex abierto con saldo por cobrar, agrupando en una
 * corporación al kardex del actor productivo minero y a los de sus personas
 * asociadas (con el importe total del grupo), y marcando cada deudor como
 * ACTIVO o INACTIVO.
 *
 * Regla de actividad: la misma que bloquea las transacciones
 * (KardexActividadService): el kardex queda INACTIVO al cumplir
 * KARDEX_DIAS_INACTIVIDAD días (.env) desde su último movimiento, su
 * apertura o su última reactivación, y solo vuelve a ACTIVO si un
 * operador/admin lo reactiva. Los inactivos siguen en el resumen con su
 * saldo, para poder ubicarlos y cobrarles.
 */
@Injectable()
export class DeudasTotalesExcelService {
  constructor(
    private readonly contabilidadExcel: ContabilidadExcelService,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    private readonly kardexActividadService: KardexActividadService,
  ) {}

  async generar(filtro: FiltroDeudasTotalesDto): Promise<Buffer> {
    const hoy = this.hoy();
    const grupos = await this.cargarGrupos(filtro);

    const paleta = PALETAS.kardex;
    const excel = this.contabilidadExcel;
    const workbook = excel.crearLibro();
    const worksheet = excel.crearHoja(workbook, 'RESUMEN DE DEUDAS', COLUMNAS);

    excel.agregarTitulos(
      worksheet,
      TOTAL_COLUMNAS,
      'RESUMEN DE DEUDAS',
      `PRACTICADO AL ${excel.fechaTexto(hoy)}`,
    );
    excel.agregarDatoCabecera(worksheet, 5, 1, 4, {
      etiqueta: 'CUENTA',
      valor: filtro.tipo
        ? `Deudores - kardex ${filtro.tipo}`
        : 'Deudores - anticipos y cuentas por cobrar',
    });
    excel.agregarDatoCabecera(
      worksheet,
      5,
      5,
      TOTAL_COLUMNAS,
      {
        etiqueta: 'INACTIVO',
        valor: `${this.kardexActividadService.diasInactividad} días o más sin movimientos en su kardex (se reactiva manualmente)`,
      },
      'center',
    );

    const filaEncabezado = 7;
    excel.agregarEncabezado(worksheet, filaEncabezado, COLUMNAS, paleta);

    let fila = filaEncabezado + 1;
    let numero = 1;
    let corporacionesPintadas = 0;
    grupos.forEach((grupo) => {
      const desde = fila;
      const total = this.r2(grupo.filas.reduce((s, f) => s + f.importe, 0));
      const esCorporacion = grupo.filas.length > 1;
      // Las corporaciones se pintan alternadas para distinguir un grupo del
      // siguiente, como los bloques de color del modelo.
      const relleno = esCorporacion && corporacionesPintadas++ % 2 === 0 ? paleta.suave : undefined;

      grupo.filas.forEach((f, i) => {
        excel.agregarFila(
          worksheet,
          fila,
          COLUMNAS,
          [
            numero++,
            excel.fecha(f.fecha),
            f.cuenta,
            f.nombre,
            f.importe,
            i === 0 ? total : null,
            i === 0 ? grupo.corporacion : null,
            f.activo ? 'DEUDOR ACTIVO' : `INACTIVO DESDE ${excel.fechaTexto(f.inactivoDesde)}`,
          ],
          { relleno },
        );
        this.pintarEstado(worksheet, fila, f.activo);
        fila++;
      });

      if (esCorporacion) {
        [COL_IMPORTE_TOTAL, COL_CORPORACION].forEach((col) => {
          worksheet.mergeCells(desde, col, fila - 1, col);
          worksheet.getCell(desde, col).font = { name: 'Calibri', size: 11, bold: true };
        });
      }
    });

    if (grupos.length === 0) {
      excel.agregarFila(worksheet, fila++, COLUMNAS, [
        null, null, 'SIN DEUDAS POR COBRAR', '', null, null, '', '',
      ]);
    }

    const deudaTotal = this.r2(
      grupos.reduce((s, g) => s + g.filas.reduce((t, f) => t + f.importe, 0), 0),
    );
    excel.agregarTotal(
      worksheet,
      fila,
      TOTAL_COLUMNAS,
      4,
      'DEUDA TOTAL DE LOS DEUDORES',
      { 5: deudaTotal, [COL_IMPORTE_TOTAL]: deudaTotal },
      paleta,
    );

    return excel.generar(workbook);
  }

  /**
   * Kardex abiertos (el vigente de cada destinatario) con saldo por cobrar,
   * agrupados por corporación: primero las corporaciones con más de un
   * kardex, después los deudores sueltos (activos antes que inactivos),
   * todos por nombre.
   */
  private async cargarGrupos(filtro: FiltroDeudasTotalesDto): Promise<GrupoDeuda[]> {
    const query = this.kardexRepository
      .createQueryBuilder('kardex')
      .leftJoinAndSelect('kardex.actorProductivoMinero', 'actor')
      .leftJoinAndSelect('kardex.persona', 'persona')
      .leftJoinAndSelect('persona.actorProductivoMinero', 'personaActor')
      .leftJoinAndSelect('kardex.cliente', 'cliente')
      .where('kardex.estado = :estado', { estado: 'ABIERTO' })
      .andWhere('kardex.activo = true')
      .andWhere('kardex.saldoActual > 0');
    if (filtro.tipo) {
      query.andWhere('kardex.tipo = :tipo', { tipo: filtro.tipo });
    }
    const kardexs = await query.getMany();
    if (kardexs.length === 0) {
      return [];
    }

    // Misma regla que bloquea las transacciones (KardexActividadService):
    // último movimiento, apertura o reactivación + KARDEX_DIAS_INACTIVIDAD.
    const actividades = await this.kardexActividadService.actividades(kardexs);

    const grupos = new Map<string, GrupoDeuda>();
    kardexs.forEach((kardex) => {
      const actividad = actividades.get(String(kardex.id))!;
      const activo = actividad.estado === 'ACTIVO';
      const actor = this.actorDeCorporacion(kardex);
      const clave = actor ? `ACTOR-${actor.id}` : `KARDEX-${kardex.id}`;
      const grupo = grupos.get(clave) ?? { corporacion: actor?.nombre?.toUpperCase() ?? '', filas: [] };
      grupo.filas.push({
        fecha: actividad.ultimaActividad,
        cuenta: this.descripcionCuenta(kardex),
        nombre: this.nombreTitular(kardex),
        importe: this.r2(Number(kardex.saldoActual)),
        activo,
        inactivoDesde: activo ? null : actividad.inactivoDesde,
      });
      grupos.set(clave, grupo);
    });

    const porNombre = (a: string, b: string) => a.localeCompare(b, 'es');
    const lista = [...grupos.values()];
    lista.forEach((g) => g.filas.sort((a, b) => porNombre(a.nombre, b.nombre)));
    return lista.sort((a, b) => {
      const corpA = a.filas.length > 1;
      const corpB = b.filas.length > 1;
      if (corpA !== corpB) {
        return corpA ? -1 : 1;
      }
      if (corpA) {
        return porNombre(a.corporacion, b.corporacion);
      }
      if (a.filas[0].activo !== b.filas[0].activo) {
        return a.filas[0].activo ? -1 : 1;
      }
      return porNombre(a.filas[0].nombre, b.filas[0].nombre);
    });
  }

  /** Actor que agrupa al kardex: el propio (ACTOR) o el de la persona asociada. */
  private actorDeCorporacion(kardex: Kardex): { id: string; nombre?: string } | null {
    if (kardex.tipo === 'ACTOR' && kardex.actorProductivoMinero) {
      return kardex.actorProductivoMinero;
    }
    const actorPersona = kardex.persona?.actorProductivoMinero;
    if (
      kardex.tipo === 'ASOCIADO' &&
      actorPersona &&
      String(actorPersona.id) !== ID_ACTOR_EMPRESA
    ) {
      return actorPersona;
    }
    return null;
  }

  private pintarEstado(worksheet: Worksheet, fila: number, activo: boolean): void {
    const cell = worksheet.getCell(fila, COL_ESTADO);
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: activo ? 'FF375623' : 'FF808080' },
    };
  }

  private descripcionCuenta(kardex: Kardex): string {
    if (kardex.descripcion) {
      return kardex.descripcion;
    }
    switch (kardex.tipo) {
      case 'ACTOR':
        return 'Anticipos - Actor Productivo Minero';
      case 'CLIENTE':
        return 'Cuenta por Cobrar - Cliente';
      case 'ASOCIADO':
        return 'Anticipos - Persona Asociada';
      default:
        return 'Anticipos - Cuenta Personal';
    }
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
    if (!persona) {
      return '';
    }
    return [persona.nombres, persona.apellidoPaterno, persona.apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  /** Fecha de hoy en Bolivia (UTC-4), "YYYY-MM-DD", igual que KardexService. */
  private hoy(): string {
    return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
}
