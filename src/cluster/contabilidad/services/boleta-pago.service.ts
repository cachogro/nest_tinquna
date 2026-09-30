import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { Kardex } from '../entities/kardex.entity';
import { BoletaPago } from '../entities/boleta-pago.entity';
import { PrestamoPersonal } from '../entities/prestamo-personal.entity';
import { CreateBoletaPagoDto } from '../dto/boleta-pago/create-boleta-pago.dto';
import { FiltroBoletaPagoDto } from '../dto/boleta-pago/filtro-boleta-pago.dto';
import { resolverPersonaAutorizo } from '../persona-autorizo.util';
import { ReciboService } from './recibo.service';
import { PrestamoPersonalService } from './prestamo-personal.service';

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

const RELACIONES = {
  persona: true,
  recibo: true,
  descuentosPrestamo: { prestamo: true },
} as const;

interface DescuentoResuelto {
  prestamo: PrestamoPersonal;
  monto: number;
}

/**
 * Boletas de pago del personal (ver `BoletaPago`). Se emiten y pagan en un
 * solo paso: el recibo de EGRESO sale solo por el neto (líquido pagable
 * menos lo descontado para préstamos); cada descuento baja el kardex
 * PERSONAL sin mover caja/banco y el sub-libro de su préstamo. Una boleta
 * pagada no se anula (igual que un recibo PROCESADO).
 */
@Injectable()
export class BoletaPagoService {
  constructor(
    @InjectRepository(BoletaPago, 'ci')
    private readonly boletaRepository: Repository<BoletaPago>,

    @InjectRepository(PrestamoPersonal, 'ci')
    private readonly prestamoRepository: Repository<PrestamoPersonal>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    private readonly reciboService: ReciboService,
    private readonly prestamoPersonalService: PrestamoPersonalService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private r2(n: number | string | null | undefined): number {
    return Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;
  }

  /** "28 Febrero a 28 Marzo 2026" (el año del inicio solo si es distinto). */
  private periodoTexto(desde: string, hasta: string): string {
    const [y1, m1, d1] = desde.slice(0, 10).split('-').map(Number);
    const [y2, m2, d2] = hasta.slice(0, 10).split('-').map(Number);
    const inicio = `${d1} ${MESES[m1 - 1]}${y1 !== y2 ? ` ${y1}` : ''}`;
    return `${inicio} a ${d2} ${MESES[m2 - 1]} ${y2}`;
  }

  private descuentoSugerido(prestamo: PrestamoPersonal): number {
    return Math.min(this.r2(prestamo.cuotaMensual), this.r2(prestamo.saldo));
  }

  /**
   * Sin `descuentos` en el body: la cuota pactada de cada préstamo vigente.
   * Con `descuentos`: se valida y aplica tal cual (puede ser más, menos o 0).
   */
  private async resolverDescuentos(
    idPersona: string,
    dto: CreateBoletaPagoDto,
  ): Promise<DescuentoResuelto[]> {
    if (!dto.descuentos) {
      const vigentes =
        await this.prestamoPersonalService.listarVigentesDePersona(idPersona);
      return vigentes
        .map((prestamo) => ({ prestamo, monto: this.descuentoSugerido(prestamo) }))
        .filter((d) => d.monto > 0);
    }

    const ids = dto.descuentos.map((d) => String(d.idPrestamo));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Un préstamo figura más de una vez en los descuentos.');
    }
    const prestamos = ids.length
      ? await this.prestamoRepository.find({ where: { id: In(ids) } })
      : [];
    const porId = new Map(prestamos.map((p) => [String(p.id), p]));

    const resueltos: DescuentoResuelto[] = [];
    for (const d of dto.descuentos) {
      const prestamo = porId.get(String(d.idPrestamo));
      if (!prestamo || !prestamo.activo) {
        throw new NotFoundException(`No se encontró el préstamo ${d.idPrestamo}.`);
      }
      if (String(prestamo.idPersona) !== String(idPersona)) {
        throw new BadRequestException(
          `El préstamo N° ${prestamo.numero} no pertenece a esta persona.`,
        );
      }
      const monto = this.r2(d.monto);
      if (monto === 0) continue;
      if (prestamo.estado !== 'VIGENTE') {
        throw new BadRequestException(`El préstamo N° ${prestamo.numero} ya está CANCELADO.`);
      }
      if (monto > this.r2(prestamo.saldo)) {
        throw new BadRequestException(
          `El descuento (${monto}) supera el saldo del préstamo N° ${prestamo.numero} (${this.r2(prestamo.saldo)}).`,
        );
      }
      resueltos.push({ prestamo, monto });
    }
    return resueltos;
  }

  /**
   * Rechaza otra boleta PAGADA de la misma persona cuyo periodo se superponga.
   * Compartir el día de corte (28 feb–28 mar y 28 mar–28 abr) sí se permite.
   */
  private async validarPeriodoLibre(
    idPersona: string,
    desde: string,
    hasta: string,
  ): Promise<void> {
    const existente = await this.boletaRepository
      .createQueryBuilder('b')
      .where('b.idPersona = :idPersona', { idPersona })
      .andWhere("b.estado = 'PAGADA'")
      .andWhere('b.fechaDesde < :hasta AND b.fechaHasta > :desde', { desde, hasta })
      .getOne();
    if (existente) {
      throw new ConflictException(
        `Ya existe la boleta N° ${existente.numero} (${this.periodoTexto(existente.fechaDesde, existente.fechaHasta)}) para un periodo que se superpone.`,
      );
    }
  }

  private async siguienteNumero(manager: EntityManager): Promise<number> {
    const row = await manager
      .createQueryBuilder(BoletaPago, 'b')
      .select('COALESCE(MAX(b.numero), 0)', 'max')
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  // ------------------------------------------------------------------ CRUD
  /**
   * Datos para armar la boleta en el front antes de emitirla: salario
   * registrado, préstamos vigentes con el descuento sugerido (cuota pactada o
   * saldo, si es menor) y el kardex PERSONAL.
   */
  async preparar(idPersona: string) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(idPersona);
    const kardex = await this.kardexRepository.findOne({
      where: { tipo: 'PERSONAL', idPersona: persona.id, estado: 'ABIERTO' },
    });
    const vigentes =
      await this.prestamoPersonalService.listarVigentesDePersona(persona.id);

    const prestamos = vigentes.map((p) => ({
      id: p.id,
      numero: p.numero,
      fecha: p.fecha,
      descripcion: p.descripcion,
      monto: this.r2(p.monto),
      saldo: this.r2(p.saldo),
      cuotaMensual: this.r2(p.cuotaMensual),
      descuentoSugerido: this.descuentoSugerido(p),
    }));

    return {
      persona: {
        id: persona.id,
        nombres: persona.nombres,
        apellidoPaterno: persona.apellidoPaterno ?? null,
        apellidoMaterno: persona.apellidoMaterno ?? null,
        numeroDocumento: persona.numeroDocumento ?? null,
        fechaInicioLaboral: persona.fechaInicioLaboral ?? null,
        salarioMensual: persona.salarioMensual != null ? this.r2(persona.salarioMensual) : null,
      },
      kardex: kardex
        ? { id: kardex.id, numero: kardex.numero, saldoActual: this.r2(kardex.saldoActual) }
        : null,
      prestamos,
      totalDescuentoSugerido: this.r2(
        prestamos.reduce((s, p) => s + p.descuentoSugerido, 0),
      ),
    };
  }

  async emitir(dto: CreateBoletaPagoDto, user: Usuario): Promise<BoletaPago> {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);

    const fechaDesde = dto.fechaDesde.slice(0, 10);
    const fechaHasta = dto.fechaHasta.slice(0, 10);
    if (fechaDesde > fechaHasta) {
      throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta.');
    }
    await this.validarPeriodoLibre(persona.id, fechaDesde, fechaHasta);

    const salarioBase = this.r2(dto.salarioBase ?? persona.salarioMensual);
    if (!(salarioBase > 0)) {
      throw new BadRequestException(
        'La persona no tiene salario mensual registrado: regístralo en su ficha o envía salarioBase.',
      );
    }
    const bonoAntiguedad = this.r2(dto.bonoAntiguedad);
    const otrosIngresos = this.r2(dto.otrosIngresos);
    const aporteLaboral = this.r2(dto.aporteLaboral);
    const rcIva = this.r2(dto.rcIva);
    const otrosDescuentosLey = this.r2(dto.otrosDescuentosLey);

    const totalGanado = this.r2(salarioBase + bonoAntiguedad + otrosIngresos);
    const totalDescuentosLey = this.r2(aporteLaboral + rcIva + otrosDescuentosLey);
    const liquidoPagable = this.r2(totalGanado - totalDescuentosLey);
    if (liquidoPagable < 0) {
      throw new BadRequestException(
        `Los descuentos de ley (${totalDescuentosLey}) superan el total ganado (${totalGanado}).`,
      );
    }

    const descuentos = await this.resolverDescuentos(persona.id, dto);
    const totalDescuentoPrestamos = this.r2(
      descuentos.reduce((s, d) => s + d.monto, 0),
    );
    if (totalDescuentoPrestamos > liquidoPagable) {
      throw new BadRequestException(
        `Los descuentos de préstamos (${totalDescuentoPrestamos}) superan el líquido pagable (${liquidoPagable}).`,
      );
    }
    const montoPagado = this.r2(liquidoPagable - totalDescuentoPrestamos);

    const kardex = descuentos.length
      ? await this.prestamoPersonalService.obtenerKardexPersonal(persona.id)
      : null;
    const personaAutorizo = await resolverPersonaAutorizo(
      this.personaRepository,
      dto.idPersonaAutorizo,
      'la boleta de pago',
    );
    const concepto =
      dto.concepto?.trim() ||
      `Pago de sueldos y salarios - ${this.periodoTexto(fechaDesde, fechaHasta)}`;

    const id = await this.dataSource.transaction(async (manager) => {
      const numero = await this.siguienteNumero(manager);

      // Solo el neto sale de caja/banco. Línea EFECTIVO SIN idPersona a
      // propósito: con idPersona el recibo lo cargaría como anticipo (DEBE)
      // en su kardex.
      const recibo =
        montoPagado > 0
          ? await this.reciboService.generarEnTransaccion(
              manager,
              {
                tipo: 'EGRESO',
                fecha: dto.fechaPago,
                montoTotal: montoPagado,
                concepto,
                idFormaPago: dto.idFormaPago,
                idCuentaBancaria: dto.idCuentaBancaria,
                nroComprobante: dto.nroComprobante,
                idPersona: persona.id,
                idPersonaAutorizo: dto.idPersonaAutorizo,
                detalles: [
                  {
                    destino: 'EFECTIVO',
                    monto: montoPagado,
                    idDestinoGasto: dto.idDestinoGasto,
                  },
                ],
              },
              user,
            )
          : null;

      const boleta = await manager.save(
        manager.create(BoletaPago, {
          numero,
          idPersona: persona.id,
          fechaDesde,
          fechaHasta,
          fechaPago: dto.fechaPago,
          diasTrabajados: dto.diasTrabajados ?? null,
          concepto,
          salarioBase,
          bonoAntiguedad,
          otrosIngresos,
          totalGanado,
          aporteLaboral,
          rcIva,
          otrosDescuentosLey,
          totalDescuentosLey,
          liquidoPagable,
          totalDescuentoPrestamos,
          montoPagado,
          idRecibo: recibo?.id ?? null,
          estado: 'PAGADA',
          personaAutorizo,
          observaciones: dto.observaciones?.trim() || null,
          usuarioRegistro: user.usuario,
        }),
      );

      for (const { prestamo, monto } of descuentos) {
        await this.prestamoPersonalService.registrarDescuentoSueldoEnTransaccion(
          manager,
          {
            prestamo,
            kardex,
            fecha: dto.fechaPago,
            detalle: `${concepto} - DESC. PRÉSTAMO N° ${prestamo.numero}: ${prestamo.descripcion}`,
            monto,
            idBoletaPago: boleta.id,
            usuarioRegistro: user.usuario,
          },
        );
      }

      return boleta.id;
    });

    return this.buscarPorId(id);
  }

  /**
   * Resumen del mes para la bandeja: cuánto del personal interno ya cobró su
   * sueldo y quiénes faltan. "Pagado" = tiene una boleta PAGADA con fecha de
   * pago dentro del mes. Cuenta solo el personal que trabajaba ese mes:
   * activo, de la empresa, con ingreso hasta fin de mes y sin fin de labores
   * antes del inicio del mes.
   */
  async resumenMensual(gestionQ?: number, mesQ?: number) {
    // Mes actual en hora de Bolivia (UTC-4 fijo) si no se indica.
    const hoy = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const gestion = gestionQ ?? hoy.getUTCFullYear();
    const mes = mesQ ?? hoy.getUTCMonth() + 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    const ultimoDia = new Date(Date.UTC(gestion, mes, 0)).getUTCDate();
    const desde = `${gestion}-${pad(mes)}-01`;
    const hasta = `${gestion}-${pad(mes)}-${pad(ultimoDia)}`;

    const personal = await this.personaRepository
      .createQueryBuilder('p')
      .select(['p.id', 'p.nombres', 'p.apellidoPaterno', 'p.apellidoMaterno'])
      .where('p.activo = true')
      // Actor 1 = la propia empresa: sus personas son el personal interno.
      .andWhere('p.idActorProductivoMinero = :idEmpresa', { idEmpresa: '1' })
      .andWhere('(p.fechaInicioLaboral IS NULL OR p.fechaInicioLaboral <= :hasta)', { hasta })
      .andWhere('(p.fechaFinLabores IS NULL OR p.fechaFinLabores >= :desde)', { desde })
      .orderBy('p.nombres', 'ASC')
      .getMany();

    const ids = personal.map((p) => p.id);
    const filas = ids.length
      ? await this.boletaRepository
          .createQueryBuilder('b')
          .select('b.idPersona', 'idPersona')
          .addSelect('COALESCE(SUM(b.montoPagado), 0)', 'neto')
          .where("b.estado = 'PAGADA'")
          .andWhere('b.fechaPago BETWEEN :desde AND :hasta', { desde, hasta })
          .andWhere('b.idPersona IN (:...ids)', { ids })
          .groupBy('b.idPersona')
          .getRawMany<{ idPersona: string; neto: string }>()
      : [];
    const pagados = new Set(filas.map((f) => String(f.idPersona)));

    const nombre = (p: PersonaCi) =>
      [p.nombres, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ');

    return {
      gestion,
      mes,
      totalPersonal: personal.length,
      pagados: pagados.size,
      pendientes: personal.length - pagados.size,
      totalNetoPagado: this.r2(filas.reduce((s, f) => s + Number(f.neto), 0)),
      pendientesDetalle: personal
        .filter((p) => !pagados.has(String(p.id)))
        .map((p) => ({ id: p.id, nombre: nombre(p) })),
    };
  }

  async buscarPorId(id: string): Promise<BoletaPago> {
    const boleta = await this.boletaRepository.findOne({
      where: { id },
      relations: RELACIONES,
    });
    if (!boleta) {
      throw new NotFoundException('No se encontró la boleta de pago.');
    }
    return boleta;
  }

  async listar(filtro: FiltroBoletaPagoDto) {
    const page = filtro.page ?? 1;
    const limit = filtro.limit ?? 10;

    const qb = this.boletaRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.persona', 'persona')
      .leftJoinAndSelect('b.recibo', 'recibo')
      .where('b.activo = true');

    if (filtro.idPersona) {
      qb.andWhere('b.idPersona = :idPersona', { idPersona: filtro.idPersona });
    }
    if (filtro.fechaDesde) {
      qb.andWhere('b.fechaPago >= :desde', { desde: filtro.fechaDesde });
    }
    if (filtro.fechaHasta) {
      qb.andWhere('b.fechaPago <= :hasta', { hasta: filtro.fechaHasta });
    }

    qb.orderBy('b.fechaPago', 'DESC').addOrderBy('b.id', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
