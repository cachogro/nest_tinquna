import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Worksheet } from 'exceljs';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { FondoRendir } from '../entities/fondo-rendir.entity';
import { FondoRendirDetalle } from '../entities/fondo-rendir-detalle.entity';
import { FiltroFondoRendirExcelDto } from '../dto/fondo-rendir/filtro-fondo-rendir-excel.dto';
import {
  ColumnaContable,
  ContabilidadExcelService,
  MESES,
  PALETAS,
} from './contabilidad-excel.service';

const COLUMNAS: ColumnaContable[] = [
  { titulo: 'FECHA', ancho: 12, fecha: true },
  { titulo: 'CONCEPTO - DETALLE', ancho: 48 },
  { titulo: 'FACTURA Y/O DOCUMENTO RESPALDO', ancho: 22, alineacion: 'center' },
  { titulo: 'CARGO', ancho: 16, importe: true },
  { titulo: 'DESCARGO', ancho: 16, importe: true },
  { titulo: 'TOTAL', ancho: 17, importe: true },
];
const TOTAL_COLUMNAS = COLUMNAS.length;

/** Una fila ya normalizada del libro combinado (entregas + justificaciones), lista para imprimir. */
interface FilaRendicion {
  fecha: string;
  // Fecha y hora reales de registro (fechaHoraEntrega en un CARGO,
  // fechaRegistro en un DESCARGO): desempata el orden dentro de un mismo
  // día. `fecha` sola no alcanza — un fondo se puede entregar y justificar
  // el mismo día, en cualquier orden real.
  momento: Date;
  concepto: string;
  comprobante: string;
  cargo: number | null;
  descargo: number | null;
}

/**
 * Genera el Excel "RENDICIÓN DE CUENTAS" de un destinatario (persona o
 * actor): mezcla cronológicamente sus entregas de fondo (columna CARGO,
 * FondoRendir) y sus líneas de justificación (columna DESCARGO,
 * FondoRendirDetalle, de cualquiera de sus fondos, no solo los abiertos en
 * el período) en un solo libro con saldo corriente, igual formato que el
 * modelo físico de la empresa. Mensual (con `mes`) o anual (sin `mes`).
 *
 * Cuando justificó de más: si se le devolvió el excedente, esa devolución
 * es otro CARGO; si no, el saldo corriente simplemente queda negativo y lo
 * absorbe su siguiente entrega (por eso las líneas SALDO_FAVOR, que solo
 * mueven ese excedente de un fondo a otro, no se imprimen).
 */
@Injectable()
export class FondoRendirExcelService {
  constructor(
    private readonly contabilidadExcel: ContabilidadExcelService,

    @InjectRepository(FondoRendir, 'ci')
    private readonly fondoRepository: Repository<FondoRendir>,

    @InjectRepository(FondoRendirDetalle, 'ci')
    private readonly detalleRepository: Repository<FondoRendirDetalle>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(ActorProductivoMinero, 'ci')
    private readonly actorRepository: Repository<ActorProductivoMinero>,
  ) {}

  private r2(n: number | string): number {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  private rangoFechas(filtro: FiltroFondoRendirExcelDto): { desde: string; hasta: string } {
    const gestion = filtro.gestion;
    if (filtro.mes) {
      const mes = String(filtro.mes).padStart(2, '0');
      const ultimoDia = new Date(gestion, filtro.mes, 0).getDate();
      return { desde: `${gestion}-${mes}-01`, hasta: `${gestion}-${mes}-${ultimoDia}` };
    }
    return { desde: `${gestion}-01-01`, hasta: `${gestion}-12-31` };
  }

  private async resolverDestinatario(
    filtro: FiltroFondoRendirExcelDto,
  ): Promise<{ idPersona: string | null; idActorProductivoMinero: string | null; nombre: string }> {
    if (!filtro.idPersona && !filtro.idActorProductivoMinero) {
      throw new BadRequestException('Debe indicar idPersona o idActorProductivoMinero.');
    }
    if (filtro.idPersona && filtro.idActorProductivoMinero) {
      throw new BadRequestException('idPersona e idActorProductivoMinero son excluyentes.');
    }
    if (filtro.idPersona) {
      const persona = await this.personaRepository.findOne({
        where: { id: String(filtro.idPersona) },
      });
      if (!persona) {
        throw new NotFoundException('No se encontró la persona destinataria.');
      }
      const nombre = [persona.nombres, persona.apellidoPaterno, persona.apellidoMaterno]
        .filter(Boolean)
        .join(' ')
        .trim();
      return { idPersona: persona.id, idActorProductivoMinero: null, nombre };
    }
    const actor = await this.actorRepository.findOne({
      where: { id: String(filtro.idActorProductivoMinero) },
    });
    if (!actor) {
      throw new NotFoundException('No se encontró el actor productivo minero destinatario.');
    }
    return {
      idPersona: null,
      idActorProductivoMinero: actor.id,
      nombre: actor.nombre?.toUpperCase() ?? 'S/N',
    };
  }

  private whereDestinatario(destinatario: {
    idPersona: string | null;
    idActorProductivoMinero: string | null;
  }) {
    return destinatario.idPersona
      ? { idPersona: destinatario.idPersona }
      : { idActorProductivoMinero: destinatario.idActorProductivoMinero };
  }

  /** Suma de CARGO - DESCARGO de todo lo anterior a `antesDe` (arrastre del período). */
  private async saldoInicial(
    destinatario: { idPersona: string | null; idActorProductivoMinero: string | null },
    antesDe: string,
  ): Promise<number> {
    const { total: totalCargo } = await this.fondoRepository
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.montoEntregado), 0)', 'total')
      .where(
        destinatario.idPersona
          ? 'f.idPersona = :idDestinatario'
          : 'f.idActorProductivoMinero = :idDestinatario',
        { idDestinatario: destinatario.idPersona ?? destinatario.idActorProductivoMinero },
      )
      .andWhere('f.fecha < :antesDe', { antesDe })
      .getRawOne<{ total: string }>();

    // Las devoluciones del excedente también son plata entregada (CARGO).
    const { total: totalRepuesto } = await this.fondoRepository
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.montoRepuesto), 0)', 'total')
      .where(
        destinatario.idPersona
          ? 'f.idPersona = :idDestinatario'
          : 'f.idActorProductivoMinero = :idDestinatario',
        { idDestinatario: destinatario.idPersona ?? destinatario.idActorProductivoMinero },
      )
      .andWhere('f.fechaReposicion < :antesDe', { antesDe })
      .getRawOne<{ total: string }>();

    const { total: totalDescargo } = await this.detalleRepository
      .createQueryBuilder('d')
      .innerJoin('d.fondoRendir', 'f')
      .select('COALESCE(SUM(d.monto), 0)', 'total')
      .where('d.activo = true')
      .andWhere(`d.tipo <> 'SALDO_FAVOR'`)
      .andWhere('d.fecha < :antesDe', { antesDe })
      .andWhere(
        destinatario.idPersona
          ? 'f.idPersona = :idDestinatario'
          : 'f.idActorProductivoMinero = :idDestinatario',
        { idDestinatario: destinatario.idPersona ?? destinatario.idActorProductivoMinero },
      )
      .getRawOne<{ total: string }>();

    return this.r2(Number(totalCargo) + Number(totalRepuesto) - Number(totalDescargo));
  }

  /** "C-0007" — código del recibo, para la columna de documento respaldo. */
  private codigoRecibo(recibo?: { serie?: string; numero?: number } | null): string {
    return recibo?.serie && recibo.numero != null
      ? `${recibo.serie}-${String(recibo.numero).padStart(4, '0')}`
      : '';
  }

  private async filasDelPeriodo(
    destinatario: { idPersona: string | null; idActorProductivoMinero: string | null },
    desde: string,
    hasta: string,
  ): Promise<FilaRendicion[]> {
    const where = this.whereDestinatario(destinatario);

    const fondosEnRango = await this.fondoRepository.find({
      where: { ...where, fecha: Between(desde, hasta) },
      relations: { recibo: true },
      order: { fecha: 'ASC', id: 'ASC' },
    });

    const detallesQuery = this.detalleRepository
      .createQueryBuilder('d')
      .innerJoinAndSelect('d.fondoRendir', 'f')
      // `fechaRegistro` tiene `select: false` en Auditoria: hay que pedirla
      // explícito para poder desempatar el orden dentro de un mismo día.
      .addSelect('d.fechaRegistro')
      .where('d.activo = true')
      // El saldo a favor arrastrado de otro fondo NO es un descargo nuevo:
      // ese gasto ya figura como DESCARGO en su fondo de origen, y este
      // libro es un saldo corriente por destinatario (contarlo duplicaría).
      .andWhere(`d.tipo <> 'SALDO_FAVOR'`)
      .andWhere('d.fecha >= :desde', { desde })
      .andWhere('d.fecha <= :hasta', { hasta })
      .andWhere(
        destinatario.idPersona
          ? 'f.idPersona = :idDestinatario'
          : 'f.idActorProductivoMinero = :idDestinatario',
        { idDestinatario: destinatario.idPersona ?? destinatario.idActorProductivoMinero },
      )
      .orderBy('d.fecha', 'ASC')
      .addOrderBy('d.id', 'ASC');
    const detalles = await detallesQuery.getMany();

    // Devoluciones del excedente (fondo rendido en exceso repuesto con un
    // recibo de egreso): plata que se le entregó, va como CARGO.
    const reposiciones = await this.fondoRepository.find({
      where: { ...where, fechaReposicion: Between(desde, hasta) },
      relations: { reciboReposicion: true },
      order: { fechaReposicion: 'ASC', id: 'ASC' },
    });

    const filas: FilaRendicion[] = [
      ...fondosEnRango.map((f) => ({
        fecha: f.fecha,
        momento: f.fechaHoraEntrega,
        concepto: f.concepto,
        comprobante: f.recibo?.nroComprobante ?? '',
        cargo: this.r2(Number(f.montoEntregado)),
        descargo: null,
      })),
      ...reposiciones.map((f) => ({
        fecha: f.fechaReposicion!,
        momento: f.reciboReposicion?.fechaHoraGeneracion ?? new Date(`${f.fechaReposicion}T23:59:59`),
        concepto: `DEVOLUCIÓN POR EXCESO EN RENDICIÓN - ${f.concepto}`,
        comprobante:
          f.reciboReposicion?.nroComprobante || this.codigoRecibo(f.reciboReposicion),
        cargo: this.r2(Number(f.montoRepuesto)),
        descargo: null,
      })),
      ...detalles.map((d) => ({
        fecha: d.fecha,
        momento: d.fechaRegistro,
        concepto:
          d.tipo === 'SIN_COMPROBANTE'
            ? `${d.concepto} - ${d.fondoRendir?.concepto ?? ''}`.replace(/ - $/, '')
            : d.concepto,
        comprobante: d.nroComprobante || d.facturaRecibo || '',
        cargo: null,
        descargo: this.r2(Number(d.monto)),
      })),
    ];

    // Por fecha; dentro del mismo día, por el momento real de registro (no
    // alcanza con `fecha` sola: un fondo se puede entregar y justificar el
    // mismo día, en cualquier orden real — ver nota en `FilaRendicion`).
    filas.sort((a, b) => {
      if (a.fecha !== b.fecha) {
        return a.fecha < b.fecha ? -1 : 1;
      }
      return new Date(a.momento).getTime() - new Date(b.momento).getTime();
    });
    return filas;
  }

  async generar(filtro: FiltroFondoRendirExcelDto, user: Usuario): Promise<Buffer> {
    const destinatario = await this.resolverDestinatario(filtro);
    const { desde, hasta } = this.rangoFechas(filtro);

    const [saldoInicial, filas] = await Promise.all([
      this.saldoInicial(destinatario, desde),
      this.filasDelPeriodo(destinatario, desde, hasta),
    ]);

    const paleta = PALETAS.libreta;
    const excel = this.contabilidadExcel;
    const workbook = excel.crearLibro();
    const worksheet = excel.crearHoja(workbook, 'RENDICIÓN DE CUENTAS', COLUMNAS);

    excel.agregarTitulos(worksheet, TOTAL_COLUMNAS, 'RENDICIÓN DE CUENTAS', '(Expresado en Bolivianos)');
    excel.agregarDatoCabecera(worksheet, 5, 1, TOTAL_COLUMNAS, {
      etiqueta: 'RENDICIÓN DE CUENTAS QUE PRESENTA EL SR./SRA.',
      valor: destinatario.nombre,
    });
    excel.agregarDatoCabecera(worksheet, 6, 1, 3, {
      etiqueta: 'PERÍODO',
      valor: filtro.mes
        ? `${MESES[filtro.mes - 1]} DE ${filtro.gestion}`
        : `GESTIÓN ${filtro.gestion} (ANUAL)`,
    });
    excel.agregarDatoCabecera(
      worksheet,
      6,
      4,
      TOTAL_COLUMNAS,
      { etiqueta: 'GENERADO POR', valor: user.usuario?.toUpperCase() ?? '' },
      'center',
    );

    const filaEncabezado = 8;
    excel.agregarEncabezado(worksheet, filaEncabezado, COLUMNAS, paleta);

    let fila = filaEncabezado + 1;
    let saldo = saldoInicial;

    if (filas.length === 0 && saldoInicial === 0) {
      excel.agregarFila(worksheet, fila++, COLUMNAS, [
        excel.fecha(desde),
        'SIN MOVIMIENTOS EN EL PERÍODO',
        '',
        null,
        null,
        0,
      ]);
    } else {
      excel.agregarFila(
        worksheet,
        fila++,
        COLUMNAS,
        [excel.fecha(desde), 'SALDO ANTERIOR', '', null, null, saldo],
        { negrita: true },
      );

      filas.forEach((f) => {
        saldo = this.r2(saldo + (f.cargo ?? 0) - (f.descargo ?? 0));
        // Las filas CARGO (entregas de fondo) se sombrean para distinguirlas
        // de las DESCARGO (justificaciones), igual que el modelo físico.
        excel.agregarFila(
          worksheet,
          fila++,
          COLUMNAS,
          [excel.fecha(f.fecha), f.concepto, f.comprobante, f.cargo, f.descargo, saldo],
          { relleno: f.cargo !== null ? paleta.suave : undefined },
        );
      });
    }

    const totalCargo = this.r2(filas.reduce((s, f) => s + (f.cargo ?? 0), 0));
    const totalDescargo = this.r2(filas.reduce((s, f) => s + (f.descargo ?? 0), 0));
    excel.agregarTotal(
      worksheet,
      fila,
      TOTAL_COLUMNAS,
      3,
      'SUMAS TOTALES',
      { 4: totalCargo, 5: totalDescargo, 6: saldo },
      paleta,
    );

    this.agregarLeyenda(worksheet, fila + 2, saldo, destinatario.nombre);
    excel.agregarFirmas(worksheet, fila + 7, TOTAL_COLUMNAS, [
      'RECIBÍ CONFORME',
      'FIRMA DEL INTERESADO',
      'REVISADO DPTO. CONTABILIDAD',
    ]);

    return excel.generar(workbook);
  }

  /**
   * Igual que el modelo físico: si el saldo corriente queda negativo (se
   * justificó/gastó más de lo entregado), se marca a quién hay que
   * reponerle; si queda positivo, es lo que el destinatario aún debe
   * rendir/devolver.
   */
  private agregarLeyenda(
    worksheet: Worksheet,
    fila: number,
    saldoFinal: number,
    nombreDestinatario: string,
  ): void {
    worksheet.mergeCells(fila, 1, fila, TOTAL_COLUMNAS);
    const celda = worksheet.getCell(fila, 1);
    celda.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FFC00000' } };
    celda.alignment = { horizontal: 'left', vertical: 'middle' };
    const monto = (n: number) =>
      n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (saldoFinal < 0) {
      celda.value = `POR REPONER A: ${nombreDestinatario}  ...............................  Bs. ${monto(-saldoFinal)}`;
    } else if (saldoFinal > 0) {
      celda.value = `SALDO PENDIENTE POR RENDIR: ${nombreDestinatario}  ...............................  Bs. ${monto(saldoFinal)}`;
    } else {
      celda.value = 'CUENTA SALDADA: NADA POR REPONER NI POR RENDIR.';
    }
  }
}
