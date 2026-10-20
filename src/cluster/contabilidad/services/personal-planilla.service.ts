import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { PlanillaConfigService } from 'src/cluster/parametricas/services/planilla-config.service';
import { PersonalPlanilla } from '../entities/personal-planilla.entity';
import { Vacacion } from '../entities/vacacion.entity';
import { BoletaPago } from '../entities/boleta-pago.entity';
import {
  GuardarPersonalPlanillaDto,
  RegistrarRetiroDto,
  RegistrarVacacionDto,
} from '../dto/personal-planilla/personal-planilla.dto';
import { PrestamoPersonalService } from './prestamo-personal.service';
import { PlanillaCalculoService } from './planilla-calculo.service';
import { PersonalBeneficio } from '../entities/personal-beneficio.entity';
import { GuardarPersonalBeneficioDto } from '../dto/personal-planilla/personal-beneficio.dto';
import { validarValorBeneficio } from 'src/cluster/parametricas/entities/beneficio-planilla.entity';

const CHECKS = [
  'aplicaBonoAntiguedad',
  'aplicaHorasExtra',
  'aplicaAguinaldo',
  'aplicaVacaciones',
  'aplicaIndemnizacion',
  'aplicaDesahucio',
] as const;

/** Hoy en hora de Bolivia (UTC-4 fijo), "YYYY-MM-DD". */
const hoyBolivia = () => new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Configuración de sueldo de cada persona del personal (qué le corresponde
 * y qué no) y su registro de vacaciones.
 */
@Injectable()
export class PersonalPlanillaService {
  constructor(
    @InjectRepository(PersonalPlanilla, 'ci')
    private readonly personalPlanillaRepository: Repository<PersonalPlanilla>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(Vacacion, 'ci')
    private readonly vacacionRepository: Repository<Vacacion>,

    @InjectRepository(PersonalBeneficio, 'ci')
    private readonly personalBeneficioRepository: Repository<PersonalBeneficio>,

    private readonly planillaConfigService: PlanillaConfigService,
    private readonly planillaCalculoService: PlanillaCalculoService,
    private readonly prestamoPersonalService: PrestamoPersonalService,
  ) {}

  private nombre(p: PersonaCi): string {
    return [p.nombres, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ');
  }

  /**
   * Personal interno activo con un resumen de su configuración (null si
   * todavía no la tiene).
   */
  async listar() {
    const personal = await this.personaRepository
      .createQueryBuilder('p')
      .where('p.activo = true')
      .andWhere('p.idActorProductivoMinero = :idEmpresa', { idEmpresa: '1' })
      .orderBy('p.nombres', 'ASC')
      .getMany();
    const configs = await this.personalPlanillaRepository.find({
      relations: { tipoContrato: true, conceptos: true },
    });
    const porPersona = new Map(configs.map((c) => [String(c.idPersona), c]));

    return personal.map((p) => {
      const cfg = porPersona.get(String(p.id));
      return {
        id: p.id,
        nombre: this.nombre(p),
        numeroDocumento: p.numeroDocumento ?? null,
        fechaInicioLaboral: p.fechaInicioLaboral ?? null,
        fechaFinLabores: p.fechaFinLabores ?? null,
        motivoRetiro: p.motivoRetiro ?? null,
        salarioMensual: p.salarioMensual != null ? this.planillaCalculoService.r2(p.salarioMensual) : null,
        configuracion: cfg
          ? {
              id: cfg.id,
              tipoContrato: cfg.tipoContrato?.descripcion ?? null,
              cargo: cfg.cargo ?? null,
              controlaAsistencia: cfg.controlaAsistencia,
              aplicaRcIva: cfg.aplicaRcIva,
              aplicaOtrosDescuentosLey: cfg.aplicaOtrosDescuentosLey,
              ...Object.fromEntries(CHECKS.map((k) => [k, cfg[k]])),
              conceptos: (cfg.conceptos ?? []).map((c) => c.codigo),
            }
          : null,
      };
    });
  }

  /**
   * Configuración de una persona con TODOS los conceptos activos marcados
   * (`aplica`) o no, más su antigüedad, bono de antigüedad del mes y saldo
   * de vacaciones a hoy. Sin configuración: `configurado: false` y los
   * checks en false.
   */
  async obtener(idPersona: string) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(idPersona);
    const cfg = await this.personalPlanillaRepository.findOne({
      where: { idPersona: persona.id },
      relations: { tipoContrato: true, conceptos: true, horarioTrabajo: true },
    });
    const conceptos = (await this.planillaConfigService.listarConceptos()).filter((c) => c.activo);
    const marcados = new Set((cfg?.conceptos ?? []).map((c) => c.id));
    const hoy = hoyBolivia();
    const bono = await this.planillaCalculoService.bonoAntiguedadMensual(persona.fechaInicioLaboral, hoy);
    const vacaciones = await this.planillaCalculoService.saldoVacaciones(persona, hoy);
    // Tipos de la persona (CHOFER, MUESTRERO...): el front los propone como
    // cargo mientras no se haya guardado uno.
    const conTipos = await this.personaRepository.findOne({
      where: { id: persona.id },
      relations: { personaTipos: { personaTipo: true } },
    });
    const tipos = (conTipos?.personaTipos ?? [])
      .filter((pt) => pt.activo !== false && pt.personaTipo?.nombre)
      .map((pt) => pt.personaTipo.nombre);

    return {
      persona: {
        id: persona.id,
        nombre: this.nombre(persona),
        tipos,
        numeroDocumento: persona.numeroDocumento ?? null,
        fechaInicioLaboral: persona.fechaInicioLaboral ?? null,
        fechaFinLabores: persona.fechaFinLabores ?? null,
        motivoRetiro: persona.motivoRetiro ?? null,
        observacionRetiro: persona.observacionRetiro ?? null,
        salarioMensual:
          persona.salarioMensual != null ? this.planillaCalculoService.r2(persona.salarioMensual) : null,
      },
      configurado: !!cfg,
      configuracion: {
        id: cfg?.id ?? null,
        idTipoContrato: cfg?.idTipoContrato ?? null,
        tipoContrato: cfg?.tipoContrato?.descripcion ?? null,
        cargo: cfg?.cargo ?? null,
        nuaCua: cfg?.nuaCua ?? null,
        matriculaCns: cfg?.matriculaCns ?? null,
        observaciones: cfg?.observaciones ?? null,
        controlaAsistencia: cfg?.controlaAsistencia ?? false,
        aplicaRcIva: cfg?.aplicaRcIva ?? false,
        aplicaOtrosDescuentosLey: cfg?.aplicaOtrosDescuentosLey ?? false,
        idHorarioTrabajo: cfg?.idHorarioTrabajo ?? null,
        horarioTrabajo: cfg?.horarioTrabajo?.descripcion ?? null,
        ...Object.fromEntries(CHECKS.map((k) => [k, cfg?.[k] ?? false])),
      },
      conceptos: conceptos.map((c) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        entidad: c.entidad,
        porcentaje: Number(c.porcentaje),
        montoDesde: Number(c.montoDesde),
        aplica: marcados.has(c.id),
      })),
      antiguedad: {
        aniosCumplidos: bono.anios,
        porcentajeBono: bono.porcentaje,
        baseBono: bono.base,
        bonoMensual: cfg?.aplicaBonoAntiguedad ? bono.monto : 0,
      },
      vacaciones: {
        saldo: vacaciones.saldo,
        ganados: vacaciones.ganados,
        tomadas: vacaciones.tomadas,
        pagadas: vacaciones.pagadas,
        ajustes: vacaciones.ajustes,
      },
    };
  }

  async guardar(dto: GuardarPersonalPlanillaDto, user: Usuario) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    const existente = await this.personalPlanillaRepository.findOne({
      where: { idPersona: persona.id },
      relations: { conceptos: true },
    });
    const cfg =
      existente ??
      this.personalPlanillaRepository.create({
        idPersona: persona.id,
        usuarioRegistro: user.usuario,
      });

    // Tipo de contrato: undefined = no cambia; null = sin tipo.
    if (dto.idTipoContrato !== undefined) {
      cfg.idTipoContrato = dto.idTipoContrato ?? null;
    }
    const tipo = cfg.idTipoContrato
      ? await this.planillaConfigService.obtenerTipoContrato(cfg.idTipoContrato)
      : null;
    if (dto.usarDefectosContrato && !tipo) {
      throw new BadRequestException('Para copiar los valores por defecto indica un tipo de contrato.');
    }
    const copiar = dto.usarDefectosContrato || (!existente && !!tipo);

    for (const k of CHECKS) {
      if (dto.usarDefectosContrato) {
        cfg[k] = tipo![k];
      } else if (dto[k] !== undefined) {
        cfg[k] = dto[k]!;
      } else if (!existente) {
        cfg[k] = tipo?.[k] ?? false;
      }
    }

    if (dto.usarDefectosContrato || (dto.idsConceptos === undefined && copiar)) {
      cfg.conceptos = tipo?.conceptos ?? [];
    } else if (dto.idsConceptos !== undefined) {
      cfg.conceptos = await this.planillaConfigService.conceptosPorIds(dto.idsConceptos);
    } else if (!existente) {
      cfg.conceptos = [];
    }

    if (dto.cargo !== undefined) cfg.cargo = dto.cargo?.trim().toUpperCase() || null;
    if (dto.nuaCua !== undefined) cfg.nuaCua = dto.nuaCua?.trim() || null;
    if (dto.matriculaCns !== undefined) cfg.matriculaCns = dto.matriculaCns?.trim() || null;
    if (dto.observaciones !== undefined) cfg.observaciones = dto.observaciones?.trim() || null;
    if (dto.controlaAsistencia !== undefined) cfg.controlaAsistencia = dto.controlaAsistencia;
    else if (!existente) cfg.controlaAsistencia = false;
    if (dto.aplicaRcIva !== undefined) cfg.aplicaRcIva = dto.aplicaRcIva;
    else if (!existente) cfg.aplicaRcIva = false;
    if (dto.aplicaOtrosDescuentosLey !== undefined) cfg.aplicaOtrosDescuentosLey = dto.aplicaOtrosDescuentosLey;
    else if (!existente) cfg.aplicaOtrosDescuentosLey = false;
    if (dto.idHorarioTrabajo !== undefined) {
      if (dto.idHorarioTrabajo) await this.planillaConfigService.obtenerHorario(Number(dto.idHorarioTrabajo));
      cfg.idHorarioTrabajo = dto.idHorarioTrabajo ?? null;
    }
    if (cfg.controlaAsistencia && !cfg.idHorarioTrabajo) {
      throw new BadRequestException('Para controlar asistencia indica su horario de trabajo.');
    }
    cfg.activo = true;
    if (existente) cfg.usuarioUltimaModificacion = user.usuario;

    await this.personalPlanillaRepository.save(cfg);
    return await this.obtener(persona.id);
  }

  // -------------------------------------------------------------- vacaciones
  async vacaciones(idPersona: string, fecha?: string) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(idPersona);
    return await this.planillaCalculoService.saldoVacaciones(persona, (fecha ?? hoyBolivia()).slice(0, 10));
  }

  async registrarVacacion(dto: RegistrarVacacionDto, user: Usuario) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    const cfg = await this.planillaCalculoService.configPersona(persona.id);
    if (!cfg?.aplicaVacaciones) {
      throw new BadRequestException(
        'A esta persona no le corresponden vacaciones según su configuración de sueldo.',
      );
    }
    if (dto.tipo === 'TOMADA' && !(dto.dias > 0)) {
      throw new BadRequestException('Los días tomados deben ser mayores a 0.');
    }
    if (dto.tipo === 'AJUSTE' && dto.dias === 0) {
      throw new BadRequestException('El ajuste no puede ser de 0 días.');
    }
    if (dto.fechaHasta && dto.fechaHasta < dto.fechaDesde) {
      throw new BadRequestException('La fecha hasta no puede ser anterior a la fecha desde.');
    }
    await this.vacacionRepository.save(
      this.vacacionRepository.create({
        idPersona: persona.id,
        tipo: dto.tipo,
        fechaDesde: dto.fechaDesde.slice(0, 10),
        fechaHasta: dto.fechaHasta?.slice(0, 10) ?? null,
        dias: dto.dias,
        observaciones: dto.observaciones?.trim() || null,
        usuarioRegistro: user.usuario,
      }),
    );
    return await this.vacaciones(persona.id);
  }

  /** Baja lógica de una vacación TOMADA o AJUSTE (las PAGADAS son del finiquito). */
  async anularVacacion(id: string, user: Usuario) {
    const vacacion = await this.vacacionRepository.findOne({ where: { id } });
    if (!vacacion || !vacacion.activo) {
      throw new NotFoundException('No se encontró el registro de vacación.');
    }
    if (vacacion.tipo === 'PAGADA') {
      throw new BadRequestException('Las vacaciones pagadas en un finiquito no se anulan.');
    }
    vacacion.activo = false;
    vacacion.usuarioUltimaModificacion = user.usuario;
    await this.vacacionRepository.save(vacacion);
    return await this.vacaciones(vacacion.idPersona);
  }

  // ------------------------------------------- beneficios (lactancia...)
  /** "2026-11-01" + 11 meses → "2027-10-01". */
  private sumarMeses(fecha: string, meses: number): string {
    const [y, m] = fecha.slice(0, 7).split('-').map(Number);
    const total = y * 12 + (m - 1) + meses;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
  }

  /**
   * Beneficios asignados a la persona (también los anulados) con su
   * importe mensual a hoy, rango de meses, cuotas pagadas y estado:
   * POR_INICIAR | VIGENTE | CONCLUIDO | ANULADO.
   */
  async beneficios(idPersona: string) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(idPersona);
    const asignados = await this.personalBeneficioRepository.find({
      where: { idPersona: persona.id },
      relations: { beneficio: true },
      order: { activo: 'DESC', fechaInicio: 'DESC', id: 'DESC' },
    });
    const calc = this.planillaCalculoService;
    const pagos = await calc.cuotasPagadas(asignados.map((a) => a.id));
    const mesHoy = hoyBolivia().slice(0, 7);

    return asignados.map((a) => {
      const fechaFin = this.sumarMeses(a.fechaInicio, a.meses - 1);
      const propios = pagos.filter((x) => x.idPersonalBeneficio === String(a.id));
      const estado = !a.activo
        ? 'ANULADO'
        : mesHoy < a.fechaInicio.slice(0, 7)
          ? 'POR_INICIAR'
          : mesHoy > fechaFin.slice(0, 7) || propios.length >= a.meses
            ? 'CONCLUIDO'
            : 'VIGENTE';
      const importe = calc.importeBeneficio(a, Number(persona.salarioMensual ?? 0));
      return {
        id: a.id,
        idBeneficioPlanilla: a.idBeneficioPlanilla,
        nombre: a.beneficio?.nombre ?? null,
        fechaInicio: a.fechaInicio,
        fechaFin,
        meses: a.meses,
        porcentaje: a.porcentaje != null ? Number(a.porcentaje) : null,
        monto: a.monto != null ? calc.r2(a.monto) : null,
        cotiza: a.cotiza,
        observaciones: a.observaciones ?? null,
        importeMensual: importe.monto,
        cuotasPagadas: propios.length,
        totalPagado: calc.r2(propios.reduce((s, x) => s + x.monto, 0)),
        pagos: propios.map(({ mes, numeroBoleta, monto }) => ({ mes, numeroBoleta, monto })),
        estado,
        activo: a.activo,
      };
    });
  }

  /**
   * Asigna (sin `id`) o actualiza un beneficio de la persona. Lo omitido se
   * copia del catálogo al asignar y no cambia al actualizar. Con cuotas ya
   * pagadas no se cambia el beneficio ni el mes de inicio, y los meses no
   * pueden quedar por debajo de las cuotas pagadas.
   */
  async guardarBeneficio(dto: GuardarPersonalBeneficioDto, user: Usuario) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    const catalogo = await this.planillaConfigService.obtenerBeneficio(Number(dto.idBeneficioPlanilla));
    const fechaInicio = `${dto.fechaInicio.slice(0, 7)}-01`;

    let pb: PersonalBeneficio;
    if (dto.id) {
      const existente = await this.personalBeneficioRepository.findOne({ where: { id: dto.id } });
      if (!existente || !existente.activo || String(existente.idPersona) !== String(persona.id)) {
        throw new NotFoundException('No se encontró el beneficio asignado a esta persona.');
      }
      const pagadas = (await this.planillaCalculoService.cuotasPagadas([existente.id])).length;
      if (pagadas > 0) {
        if (existente.idBeneficioPlanilla !== catalogo.id || existente.fechaInicio.slice(0, 7) !== fechaInicio.slice(0, 7)) {
          throw new BadRequestException(
            `Ya se pagaron ${pagadas} cuota(s): no se puede cambiar el beneficio ni el mes de inicio. Anúlalo y asigna uno nuevo.`,
          );
        }
        if (dto.meses != null && dto.meses < pagadas) {
          throw new BadRequestException(`Ya se pagaron ${pagadas} cuota(s): los meses no pueden ser menos.`);
        }
      }
      pb = existente;
      pb.usuarioUltimaModificacion = user.usuario;
    } else {
      if (!catalogo.activo) {
        throw new BadRequestException(`El beneficio "${catalogo.nombre}" está inactivo.`);
      }
      pb = this.personalBeneficioRepository.create({
        idPersona: persona.id,
        meses: catalogo.meses,
        porcentaje: catalogo.porcentaje,
        monto: catalogo.monto,
        cotiza: catalogo.cotiza,
        usuarioRegistro: user.usuario,
      });
    }

    pb.idBeneficioPlanilla = catalogo.id;
    pb.fechaInicio = fechaInicio;
    if (dto.meses != null) pb.meses = dto.meses;
    if (dto.porcentaje !== undefined || dto.monto !== undefined) {
      const valor = validarValorBeneficio(dto.porcentaje, dto.monto);
      pb.porcentaje = valor.porcentaje;
      pb.monto = valor.monto;
    }
    if (dto.cotiza !== undefined) pb.cotiza = dto.cotiza;
    if (dto.observaciones !== undefined) pb.observaciones = dto.observaciones?.trim().toUpperCase() || null;

    await this.personalBeneficioRepository.save(pb);
    return await this.beneficios(persona.id);
  }

  /** Baja lógica: deja de pagarse desde la próxima boleta; las cuotas pagadas quedan. */
  async anularBeneficio(id: string, user: Usuario) {
    const pb = await this.personalBeneficioRepository.findOne({ where: { id } });
    if (!pb || !pb.activo) {
      throw new NotFoundException('No se encontró el beneficio asignado.');
    }
    pb.activo = false;
    pb.usuarioUltimaModificacion = user.usuario;
    await this.personalBeneficioRepository.save(pb);
    return await this.beneficios(pb.idPersona);
  }

  // ------------------------------------------------------------------ retiro
  /**
   * Registra la baja: último día trabajado y motivo. La persona sigue activa
   * para pagarle los días trabajados (la boleta corta en esa fecha) y el
   * finiquito. Admite fecha pasada (baja acordada días después), pero no
   * anterior a una boleta de sueldo ya pagada que empiece después: esos días
   * ya se pagaron. Devuelve `avisos` si alguna boleta pagada cubre días
   * posteriores al retiro (pago de más a revisar).
   */
  async registrarRetiro(idPersona: string, dto: RegistrarRetiroDto, user: Usuario) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(idPersona);
    const fecha = dto.fechaRetiro.slice(0, 10);
    const ingreso = persona.fechaInicioLaboral?.slice(0, 10);
    if (ingreso && fecha < ingreso) {
      throw new BadRequestException('La fecha de retiro no puede ser anterior a la fecha de ingreso.');
    }
    const fmt = (d: string) => d.slice(0, 10).split('-').reverse().join('/');
    const boletas = await this.personaRepository.manager.getRepository(BoletaPago).find({
      where: { idPersona: persona.id, tipo: 'SUELDO', estado: 'PAGADA', activo: true },
      order: { fechaHasta: 'DESC' },
    });
    const posterior = boletas.find((b) => String(b.fechaDesde).slice(0, 10) > fecha);
    if (posterior) {
      throw new BadRequestException(
        `Ya se pagó la boleta N° ${posterior.numero} del ${fmt(String(posterior.fechaDesde))} al ${fmt(String(posterior.fechaHasta))}, posterior al retiro.`,
      );
    }
    const avisos = boletas
      .filter((b) => String(b.fechaHasta).slice(0, 10) > fecha)
      .map(
        (b) =>
          `La boleta N° ${b.numero} (${fmt(String(b.fechaDesde))} al ${fmt(String(b.fechaHasta))}) ya pagó días posteriores al retiro: revisar el pago de más.`,
      );

    await this.personaRepository.update({ id: persona.id }, {
      fechaFinLabores: fecha,
      motivoRetiro: dto.motivoRetiro.trim().toUpperCase(),
      observacionRetiro: dto.observacion?.trim().toUpperCase() || null,
      usuarioUltimaModificacion: user.usuario,
    });
    return { ...(await this.obtener(persona.id)), avisos };
  }

  /** Deja sin efecto el retiro (reincorporación o error). No si ya tiene finiquito pagado. */
  async anularRetiro(idPersona: string, user: Usuario) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(idPersona);
    if (!persona.fechaFinLabores) {
      throw new BadRequestException('La persona no tiene un retiro registrado.');
    }
    const finiquito = await this.personaRepository.manager.getRepository(BoletaPago).findOne({
      where: { idPersona: persona.id, tipo: 'FINIQUITO', estado: 'PAGADA', activo: true },
    });
    if (finiquito) {
      throw new BadRequestException(
        `Ya se pagó su finiquito (boleta N° ${finiquito.numero}): el retiro no se puede anular.`,
      );
    }
    await this.personaRepository.update({ id: persona.id }, {
      fechaFinLabores: null,
      motivoRetiro: null,
      observacionRetiro: null,
      usuarioUltimaModificacion: user.usuario,
    });
    return await this.obtener(persona.id);
  }
}
