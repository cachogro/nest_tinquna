import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ConceptoPlanilla } from 'src/cluster/parametricas/entities/concepto-planilla.entity';
import { Kardex } from '../entities/kardex.entity';
import { BoletaPago, TipoBoletaPago } from '../entities/boleta-pago.entity';
import { BoletaPagoDetalle } from '../entities/boleta-pago-detalle.entity';
import { PersonalPlanilla } from '../entities/personal-planilla.entity';
import { Vacacion } from '../entities/vacacion.entity';
import { PrestamoPersonal } from '../entities/prestamo-personal.entity';
import {
  CalcularBoletaPagoDto,
  CreateBoletaPagoDto,
  DescuentoPrestamoDto,
} from '../dto/boleta-pago/create-boleta-pago.dto';
import {
  CalcularAguinaldoDto,
  CalcularFiniquitoDto,
  CalcularRetroactivoDto,
  EmitirAguinaldoDto,
  EmitirFiniquitoDto,
  EmitirRetroactivoDto,
  PagoBoletaDto,
} from '../dto/boleta-pago/boletas-especiales.dto';
import { FiltroBoletaPagoDto } from '../dto/boleta-pago/filtro-boleta-pago.dto';
import { resolverPersonaAutorizo } from '../persona-autorizo.util';
import { ReciboService } from './recibo.service';
import { PrestamoPersonalService } from './prestamo-personal.service';
import { CalculoBoleta, PlanillaCalculoService } from './planilla-calculo.service';

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
  detalles: true,
} as const;

interface DescuentoResuelto {
  prestamo: PrestamoPersonal;
  monto: number;
}

/** Datos de pago de cualquier boleta (sueldo o especial). */
type DatosPagoBoleta = PagoBoletaDto & { idPersona: string };

/**
 * Boletas de pago del personal (ver `BoletaPago`). Se emiten y pagan en un
 * solo paso: el recibo de EGRESO sale solo por el neto (líquido pagable
 * menos lo descontado para préstamos); cada descuento baja el kardex
 * PERSONAL sin mover caja/banco y el sub-libro de su préstamo. Una boleta
 * pagada no se anula (igual que un recibo PROCESADO).
 *
 * Los importes se calculan con PlanillaCalculoService según la
 * configuración de sueldos; todo lo que se envía a mano manda.
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

    @InjectRepository(PersonalPlanilla, 'ci')
    private readonly personalPlanillaRepository: Repository<PersonalPlanilla>,

    private readonly reciboService: ReciboService,
    private readonly prestamoPersonalService: PrestamoPersonalService,
    private readonly planillaCalculoService: PlanillaCalculoService,

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

  private nombre(p: PersonaCi): string {
    return [p.nombres, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ');
  }

  private descuentoSugerido(prestamo: PrestamoPersonal): number {
    return Math.min(this.r2(prestamo.cuotaMensual), this.r2(prestamo.saldo));
  }

  /**
   * Sin `descuentos`: la cuota pactada de cada préstamo vigente si
   * `cuotaPorDefecto` (sueldo); si no, ninguno. Con `descuentos`: se valida y
   * aplica tal cual (puede ser más, menos o 0).
   */
  private async resolverDescuentos(
    idPersona: string,
    descuentos: DescuentoPrestamoDto[] | undefined,
    cuotaPorDefecto: boolean,
  ): Promise<DescuentoResuelto[]> {
    if (!descuentos) {
      if (!cuotaPorDefecto) return [];
      const vigentes =
        await this.prestamoPersonalService.listarVigentesDePersona(idPersona);
      return vigentes
        .map((prestamo) => ({ prestamo, monto: this.descuentoSugerido(prestamo) }))
        .filter((d) => d.monto > 0);
    }

    const ids = descuentos.map((d) => String(d.idPrestamo));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Un préstamo figura más de una vez en los descuentos.');
    }
    const prestamos = ids.length
      ? await this.prestamoRepository.find({ where: { id: In(ids) } })
      : [];
    const porId = new Map(prestamos.map((p) => [String(p.id), p]));

    const resueltos: DescuentoResuelto[] = [];
    for (const d of descuentos) {
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
   * Rechaza otra boleta de SUELDO PAGADA de la misma persona cuyo periodo se
   * superponga. Compartir el día de corte (28 feb–28 mar y 28 mar–28 abr) sí
   * se permite.
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
      .andWhere("b.tipo = 'SUELDO'")
      .andWhere('b.fechaDesde < :hasta AND b.fechaHasta > :desde', { desde, hasta })
      .getOne();
    if (existente) {
      throw new ConflictException(
        `Ya existe la boleta N° ${existente.numero} (${this.periodoTexto(existente.fechaDesde, existente.fechaHasta)}) para un periodo que se superpone.`,
      );
    }
  }

  /** Una sola boleta PAGADA del tipo para la persona (en la gestión, si se indica). */
  private async validarUnica(idPersona: string, tipo: TipoBoletaPago, gestion?: number) {
    const qb = this.boletaRepository
      .createQueryBuilder('b')
      .where('b.idPersona = :idPersona', { idPersona })
      .andWhere("b.estado = 'PAGADA'")
      .andWhere('b.tipo = :tipo', { tipo });
    if (gestion) {
      qb.andWhere('EXTRACT(YEAR FROM b.fechaDesde) = :gestion', { gestion });
    }
    const existente = await qb.getOne();
    if (existente) {
      throw new ConflictException(
        `Ya existe la boleta de ${tipo} N° ${existente.numero}${gestion ? ` de la gestión ${gestion}` : ''}.`,
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

  private async prestamosSugeridos(idPersona: string) {
    const vigentes = await this.prestamoPersonalService.listarVigentesDePersona(idPersona);
    return vigentes.map((p) => ({
      id: p.id,
      numero: p.numero,
      fecha: p.fecha,
      descripcion: p.descripcion,
      monto: this.r2(p.monto),
      saldo: this.r2(p.saldo),
      cuotaMensual: this.r2(p.cuotaMensual),
      descuentoSugerido: this.descuentoSugerido(p),
    }));
  }

  // ------------------------------------------------------------------ CRUD
  /**
   * Datos para armar la boleta en el front antes de emitirla: salario
   * registrado, configuración de sueldo, préstamos vigentes con el descuento
   * sugerido (cuota pactada o saldo, si es menor) y el kardex PERSONAL.
   */
  async preparar(idPersona: string) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(idPersona);
    const kardex = await this.kardexRepository.findOne({
      where: { tipo: 'PERSONAL', idPersona: persona.id, estado: 'ABIERTO' },
    });
    const prestamos = await this.prestamosSugeridos(persona.id);
    const cfg = await this.planillaCalculoService.configPersona(persona.id);

    return {
      persona: {
        id: persona.id,
        nombres: persona.nombres,
        apellidoPaterno: persona.apellidoPaterno ?? null,
        apellidoMaterno: persona.apellidoMaterno ?? null,
        numeroDocumento: persona.numeroDocumento ?? null,
        fechaInicioLaboral: persona.fechaInicioLaboral ?? null,
        fechaFinLabores: persona.fechaFinLabores ?? null,
        motivoRetiro: persona.motivoRetiro ?? null,
        salarioMensual: persona.salarioMensual != null ? this.r2(persona.salarioMensual) : null,
      },
      configuracionSueldo: cfg
        ? {
            tipoContrato: cfg.tipoContrato?.descripcion ?? null,
            cargo: cfg.cargo ?? null,
            aplicaBonoAntiguedad: cfg.aplicaBonoAntiguedad,
            aplicaHorasExtra: cfg.aplicaHorasExtra,
            aplicaAguinaldo: cfg.aplicaAguinaldo,
            aplicaVacaciones: cfg.aplicaVacaciones,
            aplicaIndemnizacion: cfg.aplicaIndemnizacion,
            aplicaDesahucio: cfg.aplicaDesahucio,
            controlaAsistencia: cfg.controlaAsistencia,
            aplicaRcIva: cfg.aplicaRcIva,
            aplicaOtrosDescuentosLey: cfg.aplicaOtrosDescuentosLey,
            // Solo los descuentos al trabajador: si no hay, la boleta no muestra el aporte laboral.
            descuentosLaborales: (cfg.conceptos ?? [])
              .filter((c) => c.activo && c.tipo === 'DESCUENTO_LABORAL')
              .map((c) => c.codigo),
            idHorarioTrabajo: cfg.idHorarioTrabajo ?? null,
            conceptos: (cfg.conceptos ?? []).filter((c) => c.activo).map((c) => c.codigo),
          }
        : null,
      kardex: kardex
        ? {
            id: kardex.id,
            codigo: kardex.codigo,
            numero: kardex.numero,
            saldoActual: this.r2(kardex.saldoActual),
          }
        : null,
      prestamos,
      totalDescuentoSugerido: this.r2(
        prestamos.reduce((s, p) => s + p.descuentoSugerido, 0),
      ),
    };
  }

  /** Vista previa de la boleta de sueldo con todo calculado. No guarda nada. */
  async calcular(dto: CalcularBoletaPagoDto) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    const calculo = await this.planillaCalculoService.calcularSueldo(persona, dto);
    const prestamos = await this.prestamosSugeridos(persona.id);
    return { ...calculo, prestamos };
  }

  async emitir(dto: CreateBoletaPagoDto, user: Usuario): Promise<BoletaPago> {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    const calculo = await this.planillaCalculoService.calcularSueldo(persona, dto);
    // Horas extra o dominicales con la cantidad sin el valor (o al revés).
    const pendientes = (calculo.explicacion.pendientes as string[] | undefined) ?? [];
    if (pendientes.length) {
      throw new BadRequestException(pendientes.join(' '));
    }
    await this.validarPeriodoLibre(persona.id, calculo.fechaDesde, calculo.fechaHasta);
    return this.registrar(persona, calculo, dto, user, {
      cuotaPorDefecto: true,
      concepto: `Pago de sueldos y salarios - ${this.periodoTexto(calculo.fechaDesde, calculo.fechaHasta)}`,
    });
  }

  // ------------------------------------------------------- boletas especiales
  async calcularAguinaldo(dto: CalcularAguinaldoDto) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    return this.planillaCalculoService.calcularAguinaldo(persona, dto);
  }

  async emitirAguinaldo(dto: EmitirAguinaldoDto, user: Usuario): Promise<BoletaPago> {
    if (dto.descuentos?.some((d) => Number(d.monto) > 0)) {
      throw new BadRequestException('El aguinaldo no admite descuentos de préstamos.');
    }
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    await this.validarUnica(persona.id, 'AGUINALDO', dto.gestion);
    const calculo = await this.planillaCalculoService.calcularAguinaldo(persona, dto);
    return this.registrar(persona, calculo, { ...dto, descuentos: [] }, user, {
      cuotaPorDefecto: false,
      concepto: `Pago de aguinaldo de Navidad - Gestión ${dto.gestion}`,
    });
  }

  async calcularFiniquito(dto: CalcularFiniquitoDto) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    const calculo = await this.planillaCalculoService.calcularFiniquito(persona, dto);
    const prestamos = await this.prestamosSugeridos(persona.id);
    return { ...calculo, prestamos };
  }

  /**
   * Además de la boleta: registra los días de vacación pagados (PAGADA) y,
   * salvo `registrarRetiro: false`, la fecha de retiro como fin de labores.
   */
  async emitirFiniquito(dto: EmitirFiniquitoDto, user: Usuario): Promise<BoletaPago> {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    await this.validarUnica(persona.id, 'FINIQUITO');
    const calculo = await this.planillaCalculoService.calcularFiniquito(persona, dto);
    const diasVacacion = Number(calculo.explicacion.diasVacacionPagados ?? 0);
    const motivo = dto.motivoRetiro?.trim().toUpperCase();

    return this.registrar(
      persona,
      calculo,
      {
        ...dto,
        observaciones:
          [motivo ? `MOTIVO DE RETIRO: ${motivo}` : '', dto.observaciones?.trim() ?? '']
            .filter(Boolean)
            .join(' - ') || undefined,
      },
      user,
      {
        cuotaPorDefecto: false,
        concepto: `Pago de beneficios sociales (finiquito) - ${this.periodoTexto(calculo.fechaDesde, calculo.fechaHasta)}`,
        despues: async (manager, boleta) => {
          if (diasVacacion > 0) {
            await manager.save(
              manager.create(Vacacion, {
                idPersona: persona.id,
                tipo: 'PAGADA',
                fechaDesde: calculo.fechaHasta,
                dias: diasVacacion,
                idBoletaPago: boleta.id,
                observaciones: `Pagadas en el finiquito, boleta N° ${boleta.numero}`,
                usuarioRegistro: user.usuario,
              }),
            );
          }
          if (dto.registrarRetiro !== false) {
            await manager.update(PersonaCi, { id: persona.id }, {
              fechaFinLabores: calculo.fechaHasta,
              // Sin motivo en el finiquito se conserva el ya registrado.
              ...(motivo ? { motivoRetiro: motivo } : {}),
              usuarioUltimaModificacion: user.usuario,
            });
          }
        },
      },
    );
  }

  async calcularRetroactivo(dto: CalcularRetroactivoDto) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    return this.planillaCalculoService.calcularRetroactivo(persona, dto);
  }

  async emitirRetroactivo(dto: EmitirRetroactivoDto, user: Usuario): Promise<BoletaPago> {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    const calculo = await this.planillaCalculoService.calcularRetroactivo(persona, dto);
    // No pagar dos veces la diferencia de los mismos meses.
    const previo = await this.boletaRepository
      .createQueryBuilder('b')
      .where('b.idPersona = :idPersona', { idPersona: persona.id })
      .andWhere("b.estado = 'PAGADA'")
      .andWhere("b.tipo = 'RETROACTIVO'")
      .andWhere('b.fechaDesde < :hasta AND b.fechaHasta > :desde', {
        desde: calculo.fechaDesde,
        hasta: calculo.fechaHasta,
      })
      .getOne();
    if (previo) {
      throw new ConflictException(
        `Ya se pagó el retroactivo N° ${previo.numero} (${this.periodoTexto(previo.fechaDesde, previo.fechaHasta)}) para periodos de este rango.`,
      );
    }
    return this.registrar(persona, calculo, dto, user, {
      cuotaPorDefecto: false,
      concepto: `Pago de retroactivo - ${this.periodoTexto(calculo.fechaDesde, calculo.fechaHasta)}`,
      despues: async (manager) => {
        if (dto.nuevoSalario != null && dto.actualizarSalario !== false) {
          await manager.update(PersonaCi, { id: persona.id }, {
            salarioMensual: dto.nuevoSalario,
            usuarioUltimaModificacion: user.usuario,
          });
        }
      },
    });
  }

  // ---------------------------------------------------------------- registro
  /**
   * Guarda la boleta ya calculada, sus líneas de detalle, el recibo de
   * EGRESO del neto y los descuentos de préstamos, todo en una transacción.
   */
  private async registrar(
    persona: PersonaCi,
    calculo: CalculoBoleta,
    pago: DatosPagoBoleta,
    user: Usuario,
    opciones: {
      cuotaPorDefecto: boolean;
      concepto: string;
      despues?: (manager: EntityManager, boleta: BoletaPago) => Promise<void>;
    },
  ): Promise<BoletaPago> {
    const descuentos = await this.resolverDescuentos(
      persona.id,
      pago.descuentos,
      opciones.cuotaPorDefecto,
    );
    const totalDescuentoPrestamos = this.r2(
      descuentos.reduce((s, d) => s + d.monto, 0),
    );
    if (totalDescuentoPrestamos > calculo.liquidoPagable) {
      throw new BadRequestException(
        `Los descuentos de préstamos (${totalDescuentoPrestamos}) superan el líquido pagable (${calculo.liquidoPagable}).`,
      );
    }
    const montoPagado = this.r2(calculo.liquidoPagable - totalDescuentoPrestamos);

    const kardex = descuentos.length
      ? await this.prestamoPersonalService.obtenerKardexPersonal(persona.id)
      : null;
    const personaAutorizo = await resolverPersonaAutorizo(
      this.personaRepository,
      pago.idPersonaAutorizo,
      'la boleta de pago',
    );
    const concepto = pago.concepto?.trim() || opciones.concepto;

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
                fecha: pago.fechaPago,
                montoTotal: montoPagado,
                concepto,
                idFormaPago: pago.idFormaPago,
                idCuentaBancaria: pago.idCuentaBancaria,
                nroComprobante: pago.nroComprobante,
                pagos: pago.pagos,
                idPersona: persona.id,
                idPersonaAutorizo: pago.idPersonaAutorizo,
                detalles: [
                  {
                    destino: 'EFECTIVO',
                    monto: montoPagado,
                    idPlanCuentas: pago.idPlanCuentas,
                  },
                ],
              },
              user,
            )
          : null;

      const boleta = await manager.save(
        manager.create(BoletaPago, {
          numero,
          tipo: calculo.tipo,
          idPersona: persona.id,
          fechaDesde: calculo.fechaDesde,
          fechaHasta: calculo.fechaHasta,
          fechaPago: pago.fechaPago,
          fechaHoraGeneracion: new Date(),
          diasTrabajados: calculo.diasTrabajados,
          concepto,
          salarioBase: calculo.salarioBase,
          bonoAntiguedad: calculo.bonoAntiguedad,
          horasExtra: calculo.horasExtra,
          montoHorasExtra: calculo.montoHorasExtra,
          diasDominicales: calculo.diasDominicales,
          montoDominicales: calculo.montoDominicales,
          otrosIngresos: calculo.otrosIngresos,
          montoBeneficios: calculo.montoBeneficios,
          totalGanado: calculo.totalGanado,
          aporteLaboral: calculo.aporteLaboral,
          rcIva: calculo.rcIva,
          otrosDescuentosLey: calculo.otrosDescuentosLey,
          descuentoAtrasos: calculo.descuentoAtrasos,
          minutosAtraso: calculo.minutosAtraso,
          diasFalta: calculo.diasFalta,
          totalDescuentosLey: calculo.totalDescuentosLey,
          liquidoPagable: calculo.liquidoPagable,
          totalAportePatronal: calculo.totalAportePatronal,
          totalDescuentoPrestamos,
          montoPagado,
          idRecibo: recibo?.id ?? null,
          estado: 'PAGADA',
          personaAutorizo,
          observaciones: pago.observaciones?.trim() || null,
          usuarioRegistro: user.usuario,
        }),
      );

      if (calculo.detalles.length) {
        await manager.save(
          calculo.detalles.map((d) =>
            manager.create(BoletaPagoDetalle, {
              ...d,
              idBoletaPago: boleta.id,
              usuarioRegistro: user.usuario,
            }),
          ),
        );
      }

      for (const { prestamo, monto } of descuentos) {
        await this.prestamoPersonalService.registrarDescuentoSueldoEnTransaccion(
          manager,
          {
            prestamo,
            kardex,
            fecha: pago.fechaPago,
            detalle: `${concepto} - DESC. PRÉSTAMO N° ${prestamo.numero}: ${prestamo.descripcion}`,
            monto,
            idBoletaPago: boleta.id,
            usuarioRegistro: user.usuario,
          },
        );
      }

      await opciones.despues?.(manager, boleta);
      return boleta.id;
    });

    return this.buscarPorId(id);
  }

  // ---------------------------------------------------------------- reportes
  /**
   * Resumen del mes para la bandeja: cuánto del personal interno ya cobró su
   * sueldo y quiénes faltan. "Pagado" = tiene una boleta de SUELDO PAGADA con
   * fecha de pago dentro del mes. Cuenta solo el personal que trabajaba ese
   * mes: activo, de la empresa, con ingreso hasta fin de mes y sin fin de
   * labores antes del inicio del mes.
   */
  async resumenMensual(gestionQ?: number, mesQ?: number) {
    const { gestion, mes, desde, hasta } = this.mes(gestionQ, mesQ);

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
          .andWhere("b.tipo = 'SUELDO'")
          .andWhere('b.fechaPago BETWEEN :desde AND :hasta', { desde, hasta })
          .andWhere('b.idPersona IN (:...ids)', { ids })
          .groupBy('b.idPersona')
          .getRawMany<{ idPersona: string; neto: string }>()
      : [];
    const pagados = new Set(filas.map((f) => String(f.idPersona)));

    return {
      gestion,
      mes,
      totalPersonal: personal.length,
      pagados: pagados.size,
      pendientes: personal.length - pagados.size,
      totalNetoPagado: this.r2(filas.reduce((s, f) => s + Number(f.neto), 0)),
      pendientesDetalle: personal
        .filter((p) => !pagados.has(String(p.id)))
        .map((p) => ({ id: p.id, nombre: this.nombre(p) })),
    };
  }

  /** Mes indicado o el actual (hora de Bolivia, UTC-4 fijo). */
  private mes(gestionQ?: number, mesQ?: number) {
    const hoy = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const gestion = gestionQ ?? hoy.getUTCFullYear();
    const mes = mesQ ?? hoy.getUTCMonth() + 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    const ultimoDia = new Date(Date.UTC(gestion, mes, 0)).getUTCDate();
    return {
      gestion,
      mes,
      desde: `${gestion}-${pad(mes)}-01`,
      hasta: `${gestion}-${pad(mes)}-${pad(ultimoDia)}`,
    };
  }

  /**
   * Planilla mensual de sueldos: todas las boletas PAGADAS con fecha de pago
   * en el mes (por defecto solo SUELDO y RETROACTIVO, que son las que
   * cotizan), una fila por boleta con cada descuento y aporte en su columna,
   * los totales y lo que hay que pagarle a cada entidad (Gestora, CNS...).
   *
   * Un aporte laboral ingresado a mano (sin detalle) va a la columna y a la
   * entidad "SIN DETALLE".
   */
  async planillaMensual(gestionQ?: number, mesQ?: number, tipos?: TipoBoletaPago[]) {
    const { gestion, mes, desde, hasta } = this.mes(gestionQ, mesQ);
    const boletas = await this.boletaRepository.find({
      where: {
        estado: 'PAGADA',
        activo: true,
        tipo: In(tipos?.length ? tipos : ['SUELDO', 'RETROACTIVO']),
        fechaPago: Between(desde, hasta),
      },
      relations: { persona: true, detalles: true },
      order: { fechaPago: 'ASC', numero: 'ASC' },
    });
    const configs = boletas.length
      ? await this.personalPlanillaRepository.find({
          where: { idPersona: In([...new Set(boletas.map((b) => b.idPersona))]) },
          relations: { tipoContrato: true },
        })
      : [];
    const cfgPorPersona = new Map(configs.map((c) => [String(c.idPersona), c]));

    // Columnas: un descuento o aporte por cada código usado en el mes.
    const columnas = new Map<
      string,
      { codigo: string; nombre: string; tipo: string; entidad: string; porcentaje: number | null; orden: number }
    >();
    for (const b of boletas) {
      for (const d of b.detalles ?? []) {
        if (d.tipo === 'INGRESO' || columnas.has(d.codigo)) continue;
        columnas.set(d.codigo, {
          codigo: d.codigo,
          nombre: d.nombre,
          tipo: d.tipo,
          entidad: d.entidad ?? 'OTRO',
          porcentaje: d.porcentaje != null ? Number(d.porcentaje) : null,
          orden: d.orden,
        });
      }
    }
    const SIN_DETALLE = 'APORTE_LABORAL_SIN_DETALLE';
    const hayManual = boletas.some(
      (b) => Number(b.aporteLaboral) > 0 && !(b.detalles ?? []).some((d) => d.tipo === 'DESCUENTO_LABORAL'),
    );
    if (hayManual) {
      columnas.set(SIN_DETALLE, {
        codigo: SIN_DETALLE,
        nombre: 'Aporte laboral ingresado a mano',
        tipo: 'DESCUENTO_LABORAL',
        entidad: 'SIN DETALLE',
        porcentaje: null,
        orden: 999,
      });
    }
    const listaColumnas = [...columnas.values()].sort(
      (a, b) => (a.tipo === b.tipo ? a.orden - b.orden : a.tipo === 'DESCUENTO_LABORAL' ? -1 : 1),
    );

    const filas = boletas.map((b) => {
      const cfg = cfgPorPersona.get(String(b.idPersona));
      const montos: Record<string, number> = {};
      for (const d of b.detalles ?? []) {
        if (d.tipo !== 'INGRESO') montos[d.codigo] = this.r2((montos[d.codigo] ?? 0) + Number(d.monto));
      }
      if (
        Number(b.aporteLaboral) > 0 &&
        !(b.detalles ?? []).some((d) => d.tipo === 'DESCUENTO_LABORAL')
      ) {
        montos[SIN_DETALLE] = this.r2(b.aporteLaboral);
      }
      return {
        idBoleta: b.id,
        numero: b.numero,
        tipo: b.tipo,
        fechaPago: b.fechaPago,
        periodo: { desde: b.fechaDesde, hasta: b.fechaHasta },
        persona: {
          id: b.idPersona,
          nombre: b.persona ? this.nombre(b.persona) : '',
          numeroDocumento: b.persona?.numeroDocumento ?? null,
          fechaInicioLaboral: b.persona?.fechaInicioLaboral ?? null,
          cargo: cfg?.cargo ?? null,
          nuaCua: cfg?.nuaCua ?? null,
          matriculaCns: cfg?.matriculaCns ?? null,
          tipoContrato: cfg?.tipoContrato?.descripcion ?? null,
        },
        diasTrabajados: b.diasTrabajados ?? null,
        salarioBase: this.r2(b.salarioBase),
        bonoAntiguedad: this.r2(b.bonoAntiguedad),
        horasExtra: this.r2(b.horasExtra),
        montoHorasExtra: this.r2(b.montoHorasExtra),
        diasDominicales: this.r2(b.diasDominicales),
        montoDominicales: this.r2(b.montoDominicales),
        otrosIngresos: this.r2(b.otrosIngresos),
        montoBeneficios: this.r2(b.montoBeneficios),
        totalGanado: this.r2(b.totalGanado),
        montos,
        aporteLaboral: this.r2(b.aporteLaboral),
        rcIva: this.r2(b.rcIva),
        otrosDescuentosLey: this.r2(b.otrosDescuentosLey),
        descuentoAtrasos: this.r2(b.descuentoAtrasos),
        minutosAtraso: Number(b.minutosAtraso ?? 0),
        diasFalta: Number(b.diasFalta ?? 0),
        totalDescuentosLey: this.r2(b.totalDescuentosLey),
        liquidoPagable: this.r2(b.liquidoPagable),
        totalAportePatronal: this.r2(b.totalAportePatronal),
        totalDescuentoPrestamos: this.r2(b.totalDescuentoPrestamos),
        montoPagado: this.r2(b.montoPagado),
      };
    });

    const sumar = (campo: keyof (typeof filas)[number]) =>
      this.r2(filas.reduce((s, f) => s + Number(f[campo] ?? 0), 0));
    const totalesPorConcepto = Object.fromEntries(
      listaColumnas.map((c) => [c.codigo, this.r2(filas.reduce((s, f) => s + (f.montos[c.codigo] ?? 0), 0))]),
    );

    const porEntidad = new Map<string, { entidad: string; descuentoLaboral: number; aportePatronal: number }>();
    for (const c of listaColumnas) {
      const e = porEntidad.get(c.entidad) ?? { entidad: c.entidad, descuentoLaboral: 0, aportePatronal: 0 };
      if (c.tipo === 'DESCUENTO_LABORAL') e.descuentoLaboral = this.r2(e.descuentoLaboral + totalesPorConcepto[c.codigo]);
      else e.aportePatronal = this.r2(e.aportePatronal + totalesPorConcepto[c.codigo]);
      porEntidad.set(c.entidad, e);
    }

    return {
      gestion,
      mes,
      desde,
      hasta,
      columnas: listaColumnas,
      filas,
      totales: {
        salarioBase: sumar('salarioBase'),
        bonoAntiguedad: sumar('bonoAntiguedad'),
        montoHorasExtra: sumar('montoHorasExtra'),
        montoDominicales: sumar('montoDominicales'),
        otrosIngresos: sumar('otrosIngresos'),
        montoBeneficios: sumar('montoBeneficios'),
        totalGanado: sumar('totalGanado'),
        porConcepto: totalesPorConcepto,
        aporteLaboral: sumar('aporteLaboral'),
        rcIva: sumar('rcIva'),
        otrosDescuentosLey: sumar('otrosDescuentosLey'),
        descuentoAtrasos: sumar('descuentoAtrasos'),
        totalDescuentosLey: sumar('totalDescuentosLey'),
        liquidoPagable: sumar('liquidoPagable'),
        totalAportePatronal: sumar('totalAportePatronal'),
        totalDescuentoPrestamos: sumar('totalDescuentoPrestamos'),
        montoPagado: sumar('montoPagado'),
        // Lo que cuesta la planilla a la empresa: total ganado + aportes patronales.
        costoEmpresa: this.r2(sumar('totalGanado') + sumar('totalAportePatronal')),
      },
      // Lo que hay que pagarle a cada entidad (descuento al trabajador + aporte de la empresa).
      porEntidad: [...porEntidad.values()].map((e) => ({
        ...e,
        total: this.r2(e.descuentoLaboral + e.aportePatronal),
      })),
    };
  }

  /**
   * Planilla de sueldos para FIRMAS de un mes: todo el personal interno
   * activo que trabajó en el mes (no depende de boletas emitidas), con su
   * salario establecido. Se imprime antes de pagar (ej. el 1 de octubre la
   * de septiembre) y cada uno firma al recoger su pago.
   *
   *   días pagados  = días del mes comercial (30) que estuvo vinculado
   *   haber básico  = salario mensual * días / 30
   *   bono          = bono de antigüedad del mes * días / 30 (si le corresponde)
   *   total ganado  = haber básico + bono
   *   descuentos    = descuentos laborales marcados (AFP 12,71%) sobre el total ganado
   *   anticipos     = cuota de sus préstamos vigentes (o el saldo, si es menor)
   *   líquido       = total ganado - descuentos - anticipos
   *
   * Horas extra, dominicales e incrementos no van acá: salen en la boleta.
   * Con `idTipoContrato` solo el personal de ese contrato.
   */
  async planillaFirmas(gestionQ?: number, mesQ?: number, idTipoContrato?: number) {
    const { gestion, mes, desde, hasta } = this.mes(gestionQ, mesQ);
    const personas = await this.personaRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.personaTipos', 'ppt')
      .leftJoinAndSelect('ppt.personaTipo', 'pt')
      .where('p.activo = true')
      .andWhere('p.idActorProductivoMinero = :idEmpresa', { idEmpresa: '1' })
      .andWhere('(p.fechaInicioLaboral IS NULL OR p.fechaInicioLaboral <= :hasta)', { hasta })
      .andWhere('(p.fechaFinLabores IS NULL OR p.fechaFinLabores >= :desde)', { desde })
      .getMany();
    const ids = personas.map((p) => p.id);
    const [configs, prestamos] = ids.length
      ? await Promise.all([
          this.personalPlanillaRepository.find({
            where: { idPersona: In(ids), activo: true },
            relations: { tipoContrato: true, conceptos: true },
          }),
          this.prestamoRepository.find({
            where: { idPersona: In(ids), estado: 'VIGENTE', activo: true },
          }),
        ])
      : [[], []];
    const cfgPorPersona = new Map(configs.map((c) => [String(c.idPersona), c]));
    const tipoContrato = idTipoContrato
      ? (configs.find((c) => c.idTipoContrato === idTipoContrato)?.tipoContrato?.descripcion ?? null)
      : null;

    const p = await this.planillaCalculoService.parametros();
    const diasMes = p.DIAS_MES;
    const diaComercial = (fecha: string) => Math.min(Number(fecha.slice(8, 10)), diasMes);

    const filas: Array<{
      persona: PersonaCi;
      tipoContrato: string | null;
      ocupacion: string | null;
      diasPagados: number;
      salarioMensual: number;
      haberBasico: number;
      bonoAntiguedad: number;
      totalGanado: number;
      descuentos: Record<string, number>;
      totalDescuentos: number;
      anticipos: number;
      liquidoPagable: number;
      configurado: boolean;
    }> = [];
    const columnas = new Map<string, { codigo: string; nombre: string; porcentaje: number; orden: number }>();
    // La AFP (y todo descuento laboral activo) va siempre en la planilla,
    // aunque a alguien le salga en 0 por no tener configuración de sueldo.
    const laboralesActivos = await this.dataSource.getRepository(ConceptoPlanilla).find({
      where: { tipo: 'DESCUENTO_LABORAL', activo: true },
    });
    for (const c of laboralesActivos) {
      columnas.set(c.codigo, { codigo: c.codigo, nombre: c.nombre, porcentaje: Number(c.porcentaje), orden: c.orden });
    }

    for (const persona of personas) {
      const cfg = cfgPorPersona.get(String(persona.id)) ?? null;
      if (idTipoContrato && cfg?.idTipoContrato !== idTipoContrato) continue;

      const ingreso = persona.fechaInicioLaboral?.slice(0, 10);
      const fin = persona.fechaFinLabores?.slice(0, 10);
      const primerDia = ingreso && ingreso >= desde ? diaComercial(ingreso) : 1;
      const ultimoDia = fin && fin <= hasta ? diaComercial(fin) : diasMes;
      const diasPagados = Math.max(0, ultimoDia - primerDia + 1);
      const proporcion = diasPagados / diasMes;

      const salarioMensual = this.r2(persona.salarioMensual);
      const haberBasico = this.r2(salarioMensual * proporcion);
      const bono = cfg?.aplicaBonoAntiguedad
        ? await this.planillaCalculoService.bonoAntiguedadMensual(persona.fechaInicioLaboral, hasta)
        : null;
      const bonoAntiguedad = this.r2((bono?.monto ?? 0) * proporcion);
      const totalGanado = this.r2(haberBasico + bonoAntiguedad);

      const lineas = this.planillaCalculoService
        .calcularConceptos((cfg?.conceptos ?? []).filter((c) => c.tipo === 'DESCUENTO_LABORAL'), totalGanado);
      const descuentos: Record<string, number> = {};
      for (const l of lineas) {
        descuentos[l.codigo] = this.r2((descuentos[l.codigo] ?? 0) + l.monto);
        if (!columnas.has(l.codigo)) {
          columnas.set(l.codigo, { codigo: l.codigo, nombre: l.nombre, porcentaje: l.porcentaje ?? 0, orden: l.orden });
        }
      }
      const totalDescuentos = this.r2(lineas.reduce((s, l) => s + l.monto, 0));
      const anticipos = this.r2(
        prestamos
          .filter((pr) => String(pr.idPersona) === String(persona.id))
          .reduce((s, pr) => s + this.descuentoSugerido(pr), 0),
      );
      const tipos = (persona.personaTipos ?? [])
        .filter((pt) => pt.activo !== false && pt.personaTipo?.nombre)
        .map((pt) => pt.personaTipo.nombre);

      filas.push({
        persona,
        tipoContrato: cfg?.tipoContrato?.descripcion ?? null,
        ocupacion: cfg?.cargo || tipos.join(', ') || null,
        diasPagados,
        salarioMensual,
        haberBasico,
        bonoAntiguedad,
        totalGanado,
        descuentos,
        totalDescuentos,
        anticipos,
        // Los anticipos no pueden dejar el líquido en negativo.
        liquidoPagable: this.r2(Math.max(0, totalGanado - totalDescuentos - anticipos)),
        configurado: !!cfg,
      });
    }

    // Por tipo de contrato y luego por apellido.
    filas.sort(
      (a, b) =>
        (a.tipoContrato ?? 'ZZZ').localeCompare(b.tipoContrato ?? 'ZZZ') ||
        [a.persona.apellidoPaterno, a.persona.apellidoMaterno, a.persona.nombres].join(' ')
          .localeCompare([b.persona.apellidoPaterno, b.persona.apellidoMaterno, b.persona.nombres].join(' ')),
    );

    const listaColumnas = [...columnas.values()].sort((a, b) => a.orden - b.orden);
    const sumar = (f: (x: (typeof filas)[number]) => number) => this.r2(filas.reduce((s, x) => s + f(x), 0));
    return {
      gestion,
      mes,
      desde,
      hasta,
      idTipoContrato: idTipoContrato ?? null,
      tipoContrato,
      columnasDescuento: listaColumnas,
      filas: filas.map((f) => ({
        idPersona: f.persona.id,
        numeroDocumento: f.persona.numeroDocumento ?? null,
        // "APELLIDOS Y NOMBRE", como en la planilla del Ministerio.
        nombre: [f.persona.apellidoPaterno, f.persona.apellidoMaterno, f.persona.nombres].filter(Boolean).join(' '),
        nacionalidad: f.persona.nacionalidad ?? null,
        fechaNacimiento: f.persona.fechaNacimiento ?? null,
        sexo: f.persona.sexo ?? null,
        ocupacion: f.ocupacion,
        fechaIngreso: f.persona.fechaInicioLaboral ?? null,
        // Retiro dentro del mes: sus días pagados ya cortan en esa fecha.
        fechaRetiro: f.persona.fechaFinLabores ?? null,
        motivoRetiro: f.persona.motivoRetiro ?? null,
        tipoContrato: f.tipoContrato,
        configurado: f.configurado,
        diasPagados: f.diasPagados,
        horasDia: p.HORAS_JORNADA_DIA,
        salarioMensual: f.salarioMensual,
        haberBasico: f.haberBasico,
        bonoAntiguedad: f.bonoAntiguedad,
        totalGanado: f.totalGanado,
        descuentos: f.descuentos,
        totalDescuentos: f.totalDescuentos,
        anticipos: f.anticipos,
        liquidoPagable: f.liquidoPagable,
      })),
      totales: {
        haberBasico: sumar((x) => x.haberBasico),
        bonoAntiguedad: sumar((x) => x.bonoAntiguedad),
        totalGanado: sumar((x) => x.totalGanado),
        porDescuento: Object.fromEntries(
          listaColumnas.map((c) => [c.codigo, sumar((x) => x.descuentos[c.codigo] ?? 0)]),
        ),
        totalDescuentos: sumar((x) => x.totalDescuentos),
        anticipos: sumar((x) => x.anticipos),
        liquidoPagable: sumar((x) => x.liquidoPagable),
      },
    };
  }

  async buscarPorId(id: string): Promise<BoletaPago> {
    const boleta = await this.boletaRepository.findOne({
      where: { id },
      relations: RELACIONES,
      order: { detalles: { orden: 'ASC', id: 'ASC' } },
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
    if (filtro.tipo) {
      qb.andWhere('b.tipo = :tipo', { tipo: filtro.tipo });
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
