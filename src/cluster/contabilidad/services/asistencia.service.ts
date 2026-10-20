import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import {
  HorarioTrabajo,
  HorarioTrabajoDia,
} from 'src/cluster/parametricas/entities/horario-trabajo.entity';
import { PARAMETROS_PLANILLA } from 'src/cluster/parametricas/entities/parametro-planilla.entity';
import { PlanillaConfigService } from 'src/cluster/parametricas/services/planilla-config.service';
import { Asistencia } from '../entities/asistencia.entity';
import { BoletaPago } from '../entities/boleta-pago.entity';
import { PersonalPlanilla } from '../entities/personal-planilla.entity';
import { GuardarAsistenciaLoteDto } from '../dto/asistencia/asistencia.dto';
import { PrestamoPersonalService } from './prestamo-personal.service';

const P = PARAMETROS_PLANILLA;
const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export interface DiaAsistencia {
  fecha: string;
  diaSemana: number;
  nombreDia: string;
  /** Horario que rige ese día (null = no laborable). */
  horario: {
    idHorario: number;
    descripcion: string;
    temporada: boolean;
    horaIngreso: string;
    horaSalidaAlmuerzo: string | null;
    horaRetornoAlmuerzo: string | null;
    horaSalida: string;
  } | null;
  registro: {
    id: string;
    horaIngreso: string | null;
    horaSalidaAlmuerzo: string | null;
    horaRetornoAlmuerzo: string | null;
    horaSalida: string | null;
    falta: boolean;
    justificado: boolean;
    justificacion: string | null;
    observaciones: string | null;
  } | null;
  minutosAtraso: number;
  minutosSalidaAnticipada: number;
  /** Marcas que el horario pide y no se registraron. */
  marcasFaltantes: string[];
  /** true si el día cuenta para el descuento (no justificado). */
  descontable: boolean;
}

export interface ResumenAtrasos {
  controlaAsistencia: boolean;
  desde: string;
  hasta: string;
  minutosAtraso: number;
  minutosSalidaAnticipada: number;
  /** Atraso + salida anticipada de los días NO justificados. */
  minutosDescontables: number;
  diasFalta: number;
  diasJustificados: number;
  modo: 'PROPORCIONAL' | 'ESCALA';
  valorMinuto: number;
  haberDiario: number;
  montoAtrasos: number;
  montoFaltas: number;
  monto: number;
  explicacion: string;
}

/**
 * Control de asistencia: marcaciones por día y su evaluación contra el
 * horario de la persona (con su temporada, ej. invierno) y las tolerancias
 * de paramétricas. Solo para quien tiene `controlaAsistencia`.
 *
 * Por día: atraso = ingreso real − ingreso del horario (y lo mismo al volver
 * del almuerzo); salida anticipada = hora de salida del horario − salida
 * real (y al salir a almuerzo). Cada uno cuenta solo si supera su
 * tolerancia, y entonces cuenta completo. Los días justificados no cuentan.
 */
@Injectable()
export class AsistenciaService {
  constructor(
    @InjectRepository(Asistencia, 'ci')
    private readonly asistenciaRepository: Repository<Asistencia>,

    @InjectRepository(PersonalPlanilla, 'ci')
    private readonly personalPlanillaRepository: Repository<PersonalPlanilla>,

    @InjectRepository(HorarioTrabajo, 'ci')
    private readonly horarioRepository: Repository<HorarioTrabajo>,

    @InjectRepository(BoletaPago, 'ci')
    private readonly boletaRepository: Repository<BoletaPago>,

    private readonly planillaConfigService: PlanillaConfigService,
    private readonly prestamoPersonalService: PrestamoPersonalService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /** "08:30:00" -> 510. */
  private min(hora: string | null | undefined): number | null {
    if (!hora) return null;
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  private hhmm(hora: string | null | undefined): string | null {
    return hora ? hora.slice(0, 5) : null;
  }

  /** Fechas "YYYY-MM-DD" de desde a hasta, ambas inclusive. */
  private fechas(desde: string, hasta: string): string[] {
    const out: string[] = [];
    const d = new Date(`${desde.slice(0, 10)}T00:00:00Z`);
    const fin = new Date(`${hasta.slice(0, 10)}T00:00:00Z`);
    while (d <= fin && out.length < 400) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  /** 1 = lunes ... 7 = domingo. */
  private diaSemana(fecha: string): number {
    const d = new Date(`${fecha}T00:00:00Z`).getUTCDay();
    return d === 0 ? 7 : d;
  }

  private async configPersona(idPersona: string) {
    return await this.personalPlanillaRepository.findOne({
      where: { idPersona: String(idPersona), activo: true },
    });
  }

  /**
   * Para cada fecha, el horario que rige: el de temporada activo que
   * reemplaza al base y cubre la fecha, o el base.
   */
  private async resolverHorarios(idHorarioBase: number | null | undefined) {
    if (!idHorarioBase) return () => null;
    const horarios = await this.horarioRepository.find({ relations: { dias: true } });
    const base = horarios.find((h) => h.id === Number(idHorarioBase));
    const temporadas = horarios.filter(
      (h) => h.activo !== false && h.idHorarioReemplaza === Number(idHorarioBase) && h.vigenciaDesde && h.vigenciaHasta,
    );
    return (fecha: string): { horario: HorarioTrabajo; dia: HorarioTrabajoDia | null } | null => {
      const t = temporadas.find((h) => fecha >= h.vigenciaDesde!.slice(0, 10) && fecha <= h.vigenciaHasta!.slice(0, 10));
      const h = t ?? base;
      if (!h) return null;
      const dia = (h.dias ?? []).find((d) => d.diaSemana === this.diaSemana(fecha)) ?? null;
      return { horario: h, dia };
    };
  }

  /** Atraso y salida anticipada de un día, con las tolerancias. */
  private evaluar(
    dia: HorarioTrabajoDia | null,
    r: Asistencia | null,
    tolAtraso: number,
    tolSalida: number,
  ) {
    const res = { minutosAtraso: 0, minutosSalidaAnticipada: 0, marcasFaltantes: [] as string[] };
    if (!dia || !r || r.falta) return res;
    const continuo = !dia.horaSalidaAlmuerzo;
    const marcas: [string, string | null | undefined][] = continuo
      ? [['ingreso', r.horaIngreso], ['salida', r.horaSalida]]
      : [
          ['ingreso', r.horaIngreso],
          ['salida a almuerzo', r.horaSalidaAlmuerzo],
          ['retorno de almuerzo', r.horaRetornoAlmuerzo],
          ['salida', r.horaSalida],
        ];
    res.marcasFaltantes = marcas.filter(([, v]) => !v).map(([n]) => n);

    const atraso = (real: string | null | undefined, esperado: string | null | undefined) => {
      const a = this.min(real), e = this.min(esperado);
      if (a == null || e == null) return 0;
      const m = a - e;
      return m > tolAtraso ? m : 0;
    };
    const salida = (real: string | null | undefined, esperado: string | null | undefined) => {
      const a = this.min(real), e = this.min(esperado);
      if (a == null || e == null) return 0;
      const m = e - a;
      return m > tolSalida ? m : 0;
    };
    res.minutosAtraso = atraso(r.horaIngreso, dia.horaIngreso) + (continuo ? 0 : atraso(r.horaRetornoAlmuerzo, dia.horaRetornoAlmuerzo));
    res.minutosSalidaAnticipada =
      salida(r.horaSalida, dia.horaSalida) + (continuo ? 0 : salida(r.horaSalidaAlmuerzo, dia.horaSalidaAlmuerzo));
    return res;
  }

  // ---------------------------------------------------------------- consulta
  /** Todos los días del rango con su horario, marcas y minutos. */
  async listar(idPersona: string, desde: string, hasta: string) {
    if (desde > hasta) {
      throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta.');
    }
    const persona = await this.prestamoPersonalService.obtenerPersonal(idPersona);
    const cfg = await this.configPersona(persona.id);
    const p = await this.planillaConfigService.valoresParametros();
    const tolAtraso = p[P.TOLERANCIA_ATRASO_MINUTOS] ?? 0;
    const tolSalida = p[P.TOLERANCIA_SALIDA_MINUTOS] ?? 0;
    const horarioDe = await this.resolverHorarios(cfg?.idHorarioTrabajo);
    const registros = await this.asistenciaRepository.find({
      where: { idPersona: persona.id, activo: true, fecha: Between(desde.slice(0, 10), hasta.slice(0, 10)) },
    });
    const porFecha = new Map(registros.map((r) => [String(r.fecha).slice(0, 10), r]));

    const dias: DiaAsistencia[] = this.fechas(desde, hasta).map((fecha) => {
      const h = horarioDe(fecha);
      const r = porFecha.get(fecha) ?? null;
      const ev = this.evaluar(h?.dia ?? null, r, tolAtraso, tolSalida);
      return {
        fecha,
        diaSemana: this.diaSemana(fecha),
        nombreDia: DIAS[this.diaSemana(fecha)],
        horario:
          h && h.dia
            ? {
                idHorario: h.horario.id,
                descripcion: h.horario.descripcion,
                temporada: !!h.horario.idHorarioReemplaza,
                horaIngreso: this.hhmm(h.dia.horaIngreso)!,
                horaSalidaAlmuerzo: this.hhmm(h.dia.horaSalidaAlmuerzo),
                horaRetornoAlmuerzo: this.hhmm(h.dia.horaRetornoAlmuerzo),
                horaSalida: this.hhmm(h.dia.horaSalida)!,
              }
            : null,
        registro: r
          ? {
              id: r.id,
              horaIngreso: this.hhmm(r.horaIngreso),
              horaSalidaAlmuerzo: this.hhmm(r.horaSalidaAlmuerzo),
              horaRetornoAlmuerzo: this.hhmm(r.horaRetornoAlmuerzo),
              horaSalida: this.hhmm(r.horaSalida),
              falta: r.falta,
              justificado: r.justificado,
              justificacion: r.justificacion ?? null,
              observaciones: r.observaciones ?? null,
            }
          : null,
        ...ev,
        descontable: !!r && !r.justificado,
      };
    });

    const sum = (f: (d: DiaAsistencia) => number) => dias.reduce((s, d) => s + f(d), 0);
    return {
      persona: { id: persona.id, nombre: [persona.nombres, persona.apellidoPaterno, persona.apellidoMaterno].filter(Boolean).join(' ') },
      controlaAsistencia: !!cfg?.controlaAsistencia,
      idHorarioTrabajo: cfg?.idHorarioTrabajo ?? null,
      tolerancias: { atraso: tolAtraso, salida: tolSalida },
      dias,
      resumen: {
        minutosAtraso: sum((d) => (d.descontable ? d.minutosAtraso : 0)),
        minutosSalidaAnticipada: sum((d) => (d.descontable ? d.minutosSalidaAnticipada : 0)),
        faltas: dias.filter((d) => d.registro?.falta && !d.registro.justificado).length,
        justificados: dias.filter((d) => d.registro?.justificado).length,
        diasConMarcasFaltantes: dias.filter((d) => d.marcasFaltantes.length && d.registro && !d.registro.falta).length,
      },
    };
  }

  // ---------------------------------------------------------------- registro
  async guardarLote(dto: GuardarAsistenciaLoteDto, user: Usuario) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    const cfg = await this.configPersona(persona.id);
    if (!cfg?.controlaAsistencia) {
      throw new BadRequestException(
        'Esta persona no tiene control de asistencia: actívalo en su configuración de sueldo.',
      );
    }
    const fechas = dto.registros.map((r) => r.fecha.slice(0, 10));
    if (new Set(fechas).size !== fechas.length) {
      throw new BadRequestException('Una fecha figura más de una vez.');
    }
    const limpio = (v?: string | null) => (v && v.trim() ? v.trim() : null);

    await this.dataSource.transaction(async (manager) => {
      for (const r of dto.registros) {
        const fecha = r.fecha.slice(0, 10);
        const datos = {
          horaIngreso: limpio(r.horaIngreso),
          horaSalidaAlmuerzo: limpio(r.horaSalidaAlmuerzo),
          horaRetornoAlmuerzo: limpio(r.horaRetornoAlmuerzo),
          horaSalida: limpio(r.horaSalida),
          falta: !!r.falta,
          justificado: !!r.justificado,
          justificacion: limpio(r.justificacion)?.toUpperCase() ?? null,
          observaciones: limpio(r.observaciones)?.toUpperCase() ?? null,
        };
        if (datos.falta) {
          datos.horaIngreso = datos.horaSalidaAlmuerzo = datos.horaRetornoAlmuerzo = datos.horaSalida = null;
        }
        const vacio =
          !datos.horaIngreso && !datos.horaSalidaAlmuerzo && !datos.horaRetornoAlmuerzo &&
          !datos.horaSalida && !datos.falta && !datos.justificado && !datos.justificacion && !datos.observaciones;
        const existente = await manager.findOne(Asistencia, { where: { idPersona: persona.id, fecha } });
        if (vacio) {
          if (existente) await manager.delete(Asistencia, { id: existente.id });
          continue;
        }
        if (existente) {
          await manager.update(Asistencia, { id: existente.id }, {
            ...datos,
            activo: true,
            usuarioUltimaModificacion: user.usuario,
          });
        } else {
          await manager.save(manager.create(Asistencia, { idPersona: persona.id, fecha, ...datos, usuarioRegistro: user.usuario }));
        }
      }
    });
    const ordenadas = [...fechas].sort();
    return ordenadas.length
      ? await this.listar(persona.id, ordenadas[0], ordenadas[ordenadas.length - 1])
      : { ok: true };
  }

  // ----------------------------------------------------------------- boleta
  /**
   * Atrasos, salidas antes de hora y faltas sin justificar del periodo de
   * una boleta, con su monto según paramétricas:
   *   - MODO 1 proporcional: minutos × valor del minuto × factor.
   *   - MODO 2 escala: días de haber según los minutos acumulados (escala ATRASO).
   *   - faltas: días × haber diario × FACTOR_DESCUENTO_FALTA.
   * Si el primer día del periodo es el día de corte de la boleta anterior,
   * se deja fuera (ya se contó en esa boleta).
   */
  async resumenParaBoleta(persona: PersonaCi, desde: string, hasta: string): Promise<ResumenAtrasos> {
    const cfg = await this.configPersona(persona.id);
    const p = await this.planillaConfigService.valoresParametros();
    const diasMes = p[P.DIAS_MES] > 0 ? p[P.DIAS_MES] : 30;
    const horasDia = p[P.HORAS_JORNADA_DIA] > 0 ? p[P.HORAS_JORNADA_DIA] : 8;
    const salario = Number(persona.salarioMensual ?? 0);
    const haberDiario = salario / diasMes;
    const valorMinuto = haberDiario / horasDia / 60;
    const modo = Number(p[P.MODO_DESCUENTO_ATRASO]) === 2 ? 'ESCALA' : 'PROPORCIONAL';
    const vacio: ResumenAtrasos = {
      controlaAsistencia: !!cfg?.controlaAsistencia,
      desde, hasta, minutosAtraso: 0, minutosSalidaAnticipada: 0, minutosDescontables: 0, diasFalta: 0,
      diasJustificados: 0, modo, valorMinuto: this.r2(valorMinuto), haberDiario: this.r2(haberDiario),
      montoAtrasos: 0, montoFaltas: 0, monto: 0, explicacion: 'Sin control de asistencia.',
    };
    if (!cfg?.controlaAsistencia) return vacio;

    let inicio = desde.slice(0, 10);
    const anterior = await this.boletaRepository.findOne({
      where: { idPersona: persona.id, tipo: 'SUELDO', estado: 'PAGADA', fechaHasta: inicio },
    });
    if (anterior) {
      const d = new Date(`${inicio}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      inicio = d.toISOString().slice(0, 10);
    }
    if (inicio > hasta.slice(0, 10)) return { ...vacio, explicacion: 'Periodo sin días.' };

    const { dias } = await this.listar(persona.id, inicio, hasta.slice(0, 10));
    const contables = dias.filter((d) => d.descontable);
    const minutosAtraso = contables.reduce((s, d) => s + d.minutosAtraso, 0);
    const minutosSalida = contables.reduce((s, d) => s + d.minutosSalidaAnticipada, 0);
    const minutos = minutosAtraso + minutosSalida;
    const diasFalta = contables.filter((d) => d.registro?.falta).length;

    let montoAtrasos = 0;
    let detalleAtrasos = '';
    if (modo === 'PROPORCIONAL') {
      const factor = p[P.FACTOR_DESCUENTO_ATRASO] > 0 ? p[P.FACTOR_DESCUENTO_ATRASO] : 1;
      montoAtrasos = minutos * valorMinuto * factor;
      detalleAtrasos = `${minutos} min × Bs ${this.r2(valorMinuto)}${factor !== 1 ? ` × ${factor}` : ''}`;
    } else {
      const escala = await this.planillaConfigService.listarEscala('ATRASO');
      const tramo = escala.find((t) => minutos >= t.aniosDesde && (t.aniosHasta == null || minutos <= t.aniosHasta));
      const diasHaber = tramo ? Number(tramo.valor) : 0;
      montoAtrasos = diasHaber * haberDiario;
      detalleAtrasos = `${minutos} min → ${diasHaber} día(s) de haber según la escala`;
    }
    const factorFalta = p[P.FACTOR_DESCUENTO_FALTA] > 0 ? p[P.FACTOR_DESCUENTO_FALTA] : 1;
    const montoFaltas = diasFalta * haberDiario * factorFalta;

    return {
      controlaAsistencia: true,
      desde: inicio,
      hasta: hasta.slice(0, 10),
      minutosAtraso,
      minutosSalidaAnticipada: minutosSalida,
      minutosDescontables: minutos,
      diasFalta,
      diasJustificados: dias.filter((d) => d.registro?.justificado).length,
      modo,
      valorMinuto: this.r2(valorMinuto),
      haberDiario: this.r2(haberDiario),
      montoAtrasos: this.r2(montoAtrasos),
      montoFaltas: this.r2(montoFaltas),
      monto: this.r2(montoAtrasos + montoFaltas),
      explicacion:
        `Atrasos y salidas: ${detalleAtrasos} = Bs ${this.r2(montoAtrasos)}` +
        (diasFalta ? ` · Faltas: ${diasFalta} × Bs ${this.r2(haberDiario)}${factorFalta !== 1 ? ` × ${factorFalta}` : ''} = Bs ${this.r2(montoFaltas)}` : ''),
    };
  }
}
