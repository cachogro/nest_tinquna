import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, Repository } from 'typeorm';

import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { PlanillaConfigService } from 'src/cluster/parametricas/services/planilla-config.service';
import { PARAMETROS_PLANILLA } from 'src/cluster/parametricas/entities/parametro-planilla.entity';
import { ConceptoPlanilla } from 'src/cluster/parametricas/entities/concepto-planilla.entity';
import {
  EscalaPlanilla,
  TipoEscalaPlanilla,
} from 'src/cluster/parametricas/entities/escala-planilla.entity';
import { PersonalPlanilla } from '../entities/personal-planilla.entity';
import { BoletaPago, TipoBoletaPago } from '../entities/boleta-pago.entity';
import { BoletaPagoDetalle, TipoBoletaPagoDetalle } from '../entities/boleta-pago-detalle.entity';
import { Vacacion } from '../entities/vacacion.entity';
import { PersonalBeneficio } from '../entities/personal-beneficio.entity';
import { AsistenciaService } from './asistencia.service';
import { CalcularBoletaPagoDto } from '../dto/boleta-pago/create-boleta-pago.dto';
import {
  CalcularAguinaldoDto,
  CalcularFiniquitoDto,
  CalcularRetroactivoDto,
} from '../dto/boleta-pago/boletas-especiales.dto';

const P = PARAMETROS_PLANILLA;

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface LineaDetalle {
  tipo: TipoBoletaPagoDetalle;
  idConceptoPlanilla: number | null;
  codigo: string;
  nombre: string;
  entidad: string | null;
  porcentaje: number | null;
  base: number | null;
  monto: number;
  orden: number;
  /** Solo en las líneas de beneficios (lactancia, natalidad...). */
  idPersonalBeneficio?: string | null;
}

/** Cuota de un beneficio ya pagada en una boleta. */
export interface CuotaBeneficioPagada {
  idPersonalBeneficio: string;
  /** "YYYY-MM" del fin de periodo de la boleta. */
  mes: string;
  numeroBoleta: number;
  monto: number;
}

/** Todo lo que se guarda en una boleta, ya calculado. */
export interface CalculoBoleta {
  tipo: TipoBoletaPago;
  fechaDesde: string;
  fechaHasta: string;
  diasTrabajados: number | null;
  salarioBase: number;
  bonoAntiguedad: number;
  horasExtra: number;
  montoHorasExtra: number;
  diasDominicales: number;
  montoDominicales: number;
  otrosIngresos: number;
  /** Beneficios del mes (lactancia, natalidad...), con su línea en `detalles`. */
  montoBeneficios: number;
  totalGanado: number;
  aporteLaboral: number;
  rcIva: number;
  otrosDescuentosLey: number;
  /** Atrasos, salidas antes de hora y faltas descontados (solo sueldo). */
  descuentoAtrasos: number;
  minutosAtraso: number;
  diasFalta: number;
  totalDescuentosLey: number;
  liquidoPagable: number;
  totalAportePatronal: number;
  detalles: LineaDetalle[];
  /** Cómo se llegó a cada número (para mostrar en el front). */
  explicacion: Record<string, unknown>;
}

/** Tiempo entre dos fechas en mes comercial (30 días) y año de 360. */
export interface Tiempo360 {
  totalDias: number;
  anios: number;
  meses: number;
  dias: number;
}

/**
 * Cálculos de sueldos y beneficios según la configuración (panel de
 * paramétricas + configuración de cada persona). No guarda nada: lo usan
 * las rutas "calcular" para previsualizar y la emisión de cada boleta.
 *
 * Regla general: lo que la persona no tiene marcado no se calcula (queda en
 * 0), y todo importe enviado a mano manda sobre el cálculo.
 */
@Injectable()
export class PlanillaCalculoService {
  constructor(
    private readonly planillaConfigService: PlanillaConfigService,

    @InjectRepository(PersonalPlanilla, 'ci')
    private readonly personalPlanillaRepository: Repository<PersonalPlanilla>,

    @InjectRepository(BoletaPago, 'ci')
    private readonly boletaRepository: Repository<BoletaPago>,

    @InjectRepository(Vacacion, 'ci')
    private readonly vacacionRepository: Repository<Vacacion>,

    @InjectRepository(PersonalBeneficio, 'ci')
    private readonly personalBeneficioRepository: Repository<PersonalBeneficio>,

    private readonly asistenciaService: AsistenciaService,
  ) {}

  // ----------------------------------------------------------------- helpers
  r2(n: number | string | null | undefined): number {
    return Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;
  }

  private suma(valores: number[]): number {
    return this.r2(valores.reduce((s, v) => s + v, 0));
  }

  /** Años cumplidos (calendario) de `desde` a `hasta`. */
  aniosCumplidos(desde: string, hasta: string): number {
    const [y1, m1, d1] = desde.slice(0, 10).split('-').map(Number);
    const [y2, m2, d2] = hasta.slice(0, 10).split('-').map(Number);
    const anios = y2 - y1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
    return Math.max(0, anios);
  }

  /** Tiempo de servicio de `desde` a `hasta`, ambos inclusive, base 30/360. */
  tiempo360(desde: string, hasta: string): Tiempo360 {
    const [y1, m1, d1] = desde.slice(0, 10).split('-').map(Number);
    const [y2, m2, d2] = hasta.slice(0, 10).split('-').map(Number);
    const total = Math.max(
      0,
      (y2 - y1) * 360 + (m2 - m1) * 30 + (Math.min(d2, 30) - Math.min(d1, 30)) + 1,
    );
    return {
      totalDias: total,
      anios: Math.floor(total / 360),
      meses: Math.floor((total % 360) / 30),
      dias: total % 30,
    };
  }

  private valorEscala(escala: EscalaPlanilla[], anios: number): number {
    const tramo = escala.find(
      (t) => anios >= t.aniosDesde && (t.aniosHasta == null || anios <= t.aniosHasta),
    );
    return tramo ? Number(tramo.valor) : 0;
  }

  async escala(tipo: TipoEscalaPlanilla): Promise<EscalaPlanilla[]> {
    return await this.planillaConfigService.listarEscala(tipo);
  }

  async parametros(): Promise<Record<string, number>> {
    const p = await this.planillaConfigService.valoresParametros();
    const valor = (codigo: string, defecto: number) =>
      p[codigo] != null && p[codigo] > 0 ? p[codigo] : defecto;
    return {
      ...p,
      [P.DIAS_MES]: valor(P.DIAS_MES, 30),
      [P.HORAS_JORNADA_DIA]: valor(P.HORAS_JORNADA_DIA, 8),
      [P.MESES_PROMEDIO_INDEMNIZACION]: valor(P.MESES_PROMEDIO_INDEMNIZACION, 3),
    };
  }

  /** Configuración de sueldo de la persona, o null si no la tiene. */
  async configPersona(idPersona: string): Promise<PersonalPlanilla | null> {
    return await this.personalPlanillaRepository.findOne({
      where: { idPersona: String(idPersona), activo: true },
      relations: { conceptos: true, tipoContrato: true },
    });
  }

  /**
   * Una línea por cada concepto ACTIVO marcado en la persona:
   * max(0, base - montoDesde) * porcentaje / 100. Las líneas en 0 (tramos
   * del Aporte Nacional Solidario que no se alcanzan) no se incluyen.
   */
  calcularConceptos(conceptos: ConceptoPlanilla[], base: number): LineaDetalle[] {
    return [...conceptos]
      .filter((c) => c.activo)
      .sort((a, b) => a.orden - b.orden || a.id - b.id)
      .map((c) => {
        const desde = Number(c.montoDesde ?? 0);
        const baseConcepto = this.r2(Math.max(0, base - desde));
        return {
          tipo: c.tipo,
          idConceptoPlanilla: c.id,
          codigo: c.codigo,
          nombre: c.nombre,
          entidad: c.entidad,
          porcentaje: Number(c.porcentaje),
          base: baseConcepto,
          monto: this.r2((baseConcepto * Number(c.porcentaje)) / 100),
          orden: c.orden,
        };
      })
      .filter((l) => l.monto > 0);
  }

  linea(codigo: string, nombre: string, monto: number, orden: number, base?: number): LineaDetalle {
    return {
      tipo: 'INGRESO',
      idConceptoPlanilla: null,
      codigo,
      nombre,
      entidad: null,
      porcentaje: null,
      base: base ?? null,
      monto: this.r2(monto),
      orden,
    };
  }

  /**
   * Bono de antigüedad de un mes completo a la fecha indicada:
   * % (escala por años cumplidos) * BASE_BONO_ANTIGUEDAD_SMN * salario mínimo.
   */
  async bonoAntiguedadMensual(fechaInicioLaboral: string | null | undefined, fecha: string) {
    if (!fechaInicioLaboral) {
      return { anios: 0, porcentaje: 0, base: 0, monto: 0 };
    }
    const p = await this.parametros();
    const anios = this.aniosCumplidos(fechaInicioLaboral, fecha);
    const porcentaje = this.valorEscala(await this.escala('BONO_ANTIGUEDAD'), anios);
    const base = this.r2((p[P.BASE_BONO_ANTIGUEDAD_SMN] ?? 0) * (p[P.SALARIO_MINIMO_NACIONAL] ?? 0));
    return { anios, porcentaje, base, monto: this.r2((base * porcentaje) / 100) };
  }

  // ------------------------------------------------------------- beneficios
  /** Meses de diferencia por año-mes: 2026-11-xx → 2027-01-xx = 2. */
  difMeses(desde: string, hasta: string): number {
    const [y1, m1] = desde.slice(0, 7).split('-').map(Number);
    const [y2, m2] = hasta.slice(0, 7).split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1);
  }

  /** Cuotas pagadas (boletas PAGADAS) de los beneficios indicados. */
  async cuotasPagadas(ids: string[]): Promise<CuotaBeneficioPagada[]> {
    if (!ids.length) return [];
    const filas = await this.boletaRepository.manager
      .getRepository(BoletaPagoDetalle)
      .createQueryBuilder('d')
      .innerJoin('d.boletaPago', 'b')
      .select('d.id_personal_beneficio', 'id')
      .addSelect('d.monto', 'monto')
      .addSelect("TO_CHAR(b.fecha_hasta, 'YYYY-MM')", 'mes')
      .addSelect('b.numero', 'numero')
      .where('d.id_personal_beneficio IN (:...ids)', { ids })
      .andWhere("b.estado = 'PAGADA'")
      .andWhere('b.activo = true')
      .orderBy('b.fecha_hasta', 'ASC')
      .getRawMany<{ id: string; monto: string; mes: string; numero: number }>();
    return filas.map((f) => ({
      idPersonalBeneficio: String(f.id),
      mes: f.mes,
      numeroBoleta: Number(f.numero),
      monto: this.r2(f.monto),
    }));
  }

  /** Importe mensual de un beneficio: % del salario mensual de la persona, o el monto fijo. */
  importeBeneficio(
    b: Pick<PersonalBeneficio, 'porcentaje' | 'monto'>,
    salarioPersona: number,
  ): { base: number | null; monto: number } {
    if (b.porcentaje != null) {
      const base = this.r2(salarioPersona);
      return { base, monto: this.r2((base * Number(b.porcentaje)) / 100) };
    }
    return { base: null, monto: this.r2(b.monto) };
  }

  /**
   * Beneficios que tocan en el mes de `fechaHasta`: una cuota completa por
   * cada beneficio activo de la persona cuyo rango (mes de inicio + meses)
   * incluya ese mes y que no se haya pagado ya en otra boleta del mes. No
   * se prorratean por días trabajados.
   */
  async beneficiosDelMes(persona: PersonaCi, fechaHasta: string) {
    const asignados = await this.personalBeneficioRepository.find({
      where: { idPersona: String(persona.id), activo: true },
      relations: { beneficio: true },
      order: { fechaInicio: 'ASC', id: 'ASC' },
    });
    const mes = fechaHasta.slice(0, 7);
    const pagadas = await this.cuotasPagadas(asignados.map((a) => a.id));
    const lineas: { linea: LineaDetalle; cotiza: boolean }[] = [];
    const omitidos: string[] = [];

    asignados.forEach((a, i) => {
      const cuota = this.difMeses(a.fechaInicio, fechaHasta) + 1;
      if (cuota < 1 || cuota > a.meses) return;
      const nombre = a.beneficio?.nombre ?? 'BENEFICIO';
      const yaPagada = pagadas.find((p) => p.idPersonalBeneficio === String(a.id) && p.mes === mes);
      if (yaPagada) {
        omitidos.push(`${nombre}: la cuota ${cuota}/${a.meses} ya se pagó en la boleta N° ${yaPagada.numeroBoleta}.`);
        return;
      }
      const { base, monto } = this.importeBeneficio(a, Number(persona.salarioMensual ?? 0));
      if (!(monto > 0)) {
        omitidos.push(`${nombre}: el importe da 0 (la persona no tiene salario mensual registrado).`);
        return;
      }
      lineas.push({
        cotiza: a.cotiza,
        linea: {
          tipo: 'INGRESO',
          idConceptoPlanilla: null,
          codigo: `BENEFICIO_${a.id}`,
          nombre: `${nombre} (${cuota}/${a.meses})`,
          entidad: null,
          porcentaje: a.porcentaje != null ? Number(a.porcentaje) : null,
          base,
          monto,
          orden: 20 + i,
          idPersonalBeneficio: String(a.id),
        },
      });
    });
    return { lineas, omitidos };
  }

  /** Cierra los totales a partir de ingresos, descuentos y las líneas. */
  private cerrar(
    c: Omit<
      CalculoBoleta,
      | 'totalGanado' | 'totalDescuentosLey' | 'liquidoPagable' | 'totalAportePatronal' | 'aporteLaboral'
      | 'descuentoAtrasos' | 'minutosAtraso' | 'diasFalta'
    > &
      Partial<Pick<CalculoBoleta, 'descuentoAtrasos' | 'minutosAtraso' | 'diasFalta'>>,
    aporteLaboralManual: number | undefined,
    lineasConceptos: LineaDetalle[],
  ): CalculoBoleta {
    const totalGanado = this.r2(
      c.salarioBase + c.bonoAntiguedad + c.montoHorasExtra + c.montoDominicales + c.otrosIngresos + c.montoBeneficios,
    );
    if (!(totalGanado > 0)) {
      throw new BadRequestException('El total ganado debe ser mayor a 0.');
    }
    const laborales = lineasConceptos.filter((l) => l.tipo === 'DESCUENTO_LABORAL');
    const patronales = lineasConceptos.filter((l) => l.tipo === 'APORTE_PATRONAL');
    const manual = aporteLaboralManual != null;
    const aporteLaboral = manual ? this.r2(aporteLaboralManual) : this.suma(laborales.map((l) => l.monto));
    const descuentoAtrasos = this.r2(c.descuentoAtrasos ?? 0);
    const totalDescuentosLey = this.r2(aporteLaboral + c.rcIva + c.otrosDescuentosLey + descuentoAtrasos);
    const liquidoPagable = this.r2(totalGanado - totalDescuentosLey);
    if (liquidoPagable < 0) {
      throw new BadRequestException(
        `Los descuentos de ley (${totalDescuentosLey}) superan el total ganado (${totalGanado}).`,
      );
    }
    return {
      ...c,
      descuentoAtrasos,
      minutosAtraso: c.minutosAtraso ?? 0,
      diasFalta: c.diasFalta ?? 0,
      totalGanado,
      aporteLaboral,
      totalDescuentosLey,
      liquidoPagable,
      totalAportePatronal: this.suma(patronales.map((l) => l.monto)),
      detalles: [...c.detalles, ...(manual ? [] : laborales), ...patronales],
      explicacion:
        c.tipo === 'SUELDO' ? { ...c.explicacion, aporteLaboralManual: manual } : c.explicacion,
    };
  }

  // ------------------------------------------------------------------ sueldo
  async calcularSueldo(persona: PersonaCi, dto: CalcularBoletaPagoDto): Promise<CalculoBoleta> {
    const fechaDesde = dto.fechaDesde.slice(0, 10);
    const fechaHasta = dto.fechaHasta.slice(0, 10);
    if (fechaDesde > fechaHasta) {
      throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta.');
    }
    const cfg = await this.configPersona(persona.id);
    const p = await this.parametros();
    const diasMes = p[P.DIAS_MES];
    // Sin días indicados: los del periodo en mes comercial (máximo 30),
    // desde el ingreso si entró después del inicio y hasta el retiro si se
    // fue antes del fin. Así coincide con la planilla para firmas.
    const ingreso = persona.fechaInicioLaboral?.slice(0, 10);
    const retiro = persona.fechaFinLabores?.slice(0, 10);
    if (retiro && retiro < fechaDesde) {
      throw new BadRequestException(
        `La persona se retiró el ${retiro.split('-').reverse().join('/')}: no tiene días por pagar desde el ${fechaDesde.split('-').reverse().join('/')}.`,
      );
    }
    const inicioEfectivo = ingreso && ingreso > fechaDesde ? ingreso : fechaDesde;
    const finEfectivo = retiro && retiro < fechaHasta ? retiro : fechaHasta;
    // Fin de mes (28/29 de febrero, 31...) cuenta como día 30.
    const [yH, mH, dH] = finEfectivo.split('-').map(Number);
    const finDeMes = dH === new Date(Date.UTC(yH, mH, 0)).getUTCDate();
    const hastaComercial = finDeMes ? `${finEfectivo.slice(0, 8)}30` : finEfectivo;
    const diasPeriodo = inicioEfectivo > finEfectivo
      ? 0
      : Math.min(this.tiempo360(inicioEfectivo, hastaComercial).totalDias, diasMes);
    const dias = dto.diasTrabajados ?? diasPeriodo;
    const proporcion = Math.min(dias, diasMes) / diasMes;
    const salarioMensual = this.r2(persona.salarioMensual);

    const salarioBase =
      dto.salarioBase != null ? this.r2(dto.salarioBase) : this.r2(salarioMensual * proporcion);
    if (!(salarioBase > 0)) {
      throw new BadRequestException(
        'La persona no tiene salario mensual registrado: regístralo en su ficha o envía salarioBase.',
      );
    }

    let bonoAntiguedad = 0;
    let bono: Awaited<ReturnType<PlanillaCalculoService['bonoAntiguedadMensual']>> | null = null;
    if (dto.bonoAntiguedad != null) {
      bonoAntiguedad = this.r2(dto.bonoAntiguedad);
    } else if (cfg?.aplicaBonoAntiguedad) {
      bono = await this.bonoAntiguedadMensual(persona.fechaInicioLaboral, fechaHasta);
      bonoAntiguedad = this.r2(bono.monto * proporcion);
    }

    // Horas extra y dominicales: a mano. Se escribe la cantidad y cuánto vale
    // cada una (lo acuerda el encargado, aunque la persona no marque
    // asistencia) y recién con los dos datos: importe = cantidad × valor.
    // Con uno solo de los dos no se paga y queda en `pendientes` (no se
    // puede emitir). El valor sugerido (salario / 30 / 8 × recargo, y
    // salario / 30 × factor) solo se muestra como referencia.
    const pendientes: string[] = [];
    const porCantidad = (
      cantidad: number,
      valor: number | null,
      montoManual: number | undefined,
      nombre: string,
      unidad: string,
    ) => {
      if (montoManual != null) return this.r2(montoManual);
      if (cantidad > 0 && !(valor != null && valor > 0)) {
        pendientes.push(`${nombre}: indica cuánto vale cada ${unidad}.`);
      } else if (valor != null && valor > 0 && !(cantidad > 0)) {
        pendientes.push(`${nombre}: indica la cantidad (o borra el valor).`);
      } else if (cantidad > 0) {
        return this.r2(cantidad * valor!);
      }
      return 0;
    };

    const horasExtra = this.r2(dto.horasExtra);
    const valorHoraExtra = dto.valorHoraExtra != null ? this.r2(dto.valorHoraExtra) : null;
    const montoHorasExtra = porCantidad(horasExtra, valorHoraExtra, dto.montoHorasExtra, 'Horas extra', 'hora extra');
    const valorHoraExtraSugerido = this.r2(
      (salarioMensual / diasMes / p[P.HORAS_JORNADA_DIA]) * (1 + (p[P.RECARGO_HORA_EXTRA] ?? 0) / 100),
    );

    const diasDominicales = this.r2(dto.diasDominicales);
    const valorDominical = dto.valorDominical != null ? this.r2(dto.valorDominical) : null;
    const montoDominicales = porCantidad(diasDominicales, valorDominical, dto.montoDominicales, 'Dominicales', 'dominical');
    const factorDominical = p[P.FACTOR_DOMINICAL] > 0 ? p[P.FACTOR_DOMINICAL] : 1;
    const valorDominicalSugerido = this.r2((salarioMensual / diasMes) * factorDominical);

    const otrosIngresos = this.r2(dto.otrosIngresos);

    // RC-IVA y otros descuentos de ley: solo si están habilitados en su
    // configuración de sueldo (si no, la boleta ni los muestra).
    if (this.r2(dto.rcIva) > 0 && !cfg?.aplicaRcIva) {
      throw new BadRequestException(
        'A esta persona no se le descuenta RC-IVA: habilítalo en su configuración de sueldo.',
      );
    }
    if (this.r2(dto.otrosDescuentosLey) > 0 && !cfg?.aplicaOtrosDescuentosLey) {
      throw new BadRequestException(
        'A esta persona no se le aplican otros descuentos de ley: habilítalo en su configuración de sueldo.',
      );
    }

    // Beneficios (lactancia, natalidad...): cuota completa del mes. Solo los
    // que cotizan entran en la base de los descuentos y aportes.
    // Se calculan siempre (la vista previa los muestra); con
    // incluirBeneficios = false no se pagan en esta boleta.
    const beneficios = await this.beneficiosDelMes(persona, fechaHasta);
    const incluirBeneficios = dto.incluirBeneficios !== false;
    const pagados = incluirBeneficios ? beneficios.lineas : [];
    const montoBeneficios = this.suma(pagados.map((b) => b.linea.monto));
    const beneficiosCotizan = this.suma(pagados.filter((b) => b.cotiza).map((b) => b.linea.monto));

    const totalGanadoPrevio = this.r2(
      salarioBase + bonoAntiguedad + montoHorasExtra + montoDominicales + otrosIngresos + beneficiosCotizan,
    );
    const lineas = this.calcularConceptos(cfg?.conceptos ?? [], totalGanadoPrevio);

    // Atrasos: el resumen se calcula siempre (para mostrarlo); se descuenta
    // solo con descontarAtrasos, o el monto enviado a mano.
    const atrasos = await this.asistenciaService.resumenParaBoleta(persona, fechaDesde, fechaHasta);
    const descontar = dto.descuentoAtrasos != null || !!dto.descontarAtrasos;
    const descuentoAtrasos = dto.descuentoAtrasos != null
      ? this.r2(dto.descuentoAtrasos)
      : dto.descontarAtrasos ? atrasos.monto : 0;

    return this.cerrar(
      {
        tipo: 'SUELDO',
        fechaDesde,
        fechaHasta,
        // Días del periodo (o los indicados): así se imprime en la boleta.
        diasTrabajados: dias,
        salarioBase,
        bonoAntiguedad,
        horasExtra,
        montoHorasExtra,
        diasDominicales,
        montoDominicales,
        otrosIngresos,
        montoBeneficios,
        rcIva: this.r2(dto.rcIva),
        otrosDescuentosLey: this.r2(dto.otrosDescuentosLey),
        descuentoAtrasos,
        minutosAtraso: descontar ? atrasos.minutosDescontables : 0,
        diasFalta: descontar ? atrasos.diasFalta : 0,
        detalles: pagados.map((b) => b.linea),
        explicacion: {
          // `lineas` = los que tocan en el mes (pagados o no, según `incluidos`).
          beneficios: {
            incluidos: incluirBeneficios,
            lineas: beneficios.lineas.map((b) => ({ ...b.linea, cotiza: b.cotiza })),
            omitidos: beneficios.omitidos,
          },
          atrasos: { ...atrasos, descontado: descontar, manual: dto.descuentoAtrasos != null },
          configurado: !!cfg,
          tipoContrato: cfg?.tipoContrato?.descripcion ?? null,
          salarioMensual,
          diasTrabajados: dias,
          diasMes,
          // Días contados del periodo (si se enviaron a mano, pueden diferir).
          diasPeriodo,
          retiro: retiro && retiro <= fechaHasta
            ? { fecha: retiro, motivo: persona.motivoRetiro ?? null }
            : null,
          bonoAntiguedad: bono
            ? { aniosCumplidos: bono.anios, porcentaje: bono.porcentaje, base: bono.base, mensual: bono.monto }
            : dto.bonoAntiguedad != null
              ? 'manual'
              : 'no corresponde',
          valorHoraExtra,
          valorDominical,
          // Solo referencia para el encargado: no se aplican solos.
          valorHoraExtraSugerido,
          valorDominicalSugerido,
          // Datos a medias (cantidad sin valor o al revés): no se puede emitir.
          pendientes,
        },
      },
      dto.aporteLaboral,
      lineas,
    );
  }

  // ---------------------------------------------------------------- promedio
  /**
   * Promedio del total ganado de las últimas N boletas de SUELDO PAGADAS
   * con fin de periodo hasta `fecha` (desde `desde`, si se indica). Sin
   * boletas: salario mensual + bono de antigüedad (si corresponde).
   */
  async promedioGanado(persona: PersonaCi, fecha: string, desde?: string) {
    const p = await this.parametros();
    const n = p[P.MESES_PROMEDIO_INDEMNIZACION];
    const boletas = await this.boletaRepository.find({
      where: {
        idPersona: persona.id,
        tipo: 'SUELDO',
        estado: 'PAGADA',
        fechaHasta: desde ? Between(desde, fecha) : LessThanOrEqual(fecha),
      },
      order: { fechaHasta: 'DESC' },
      take: n,
    });
    if (boletas.length) {
      // Los beneficios (lactancia, natalidad...) son subsidios, no sueldo:
      // no entran al promedio de aguinaldo e indemnización.
      const ganado = (b: BoletaPago) => this.r2(Number(b.totalGanado) - Number(b.montoBeneficios ?? 0));
      return {
        promedio: this.r2(boletas.reduce((s, b) => s + ganado(b), 0) / boletas.length),
        origen: 'BOLETAS',
        boletas: boletas.map((b) => ({
          id: b.id,
          numero: b.numero,
          fechaDesde: b.fechaDesde,
          fechaHasta: b.fechaHasta,
          totalGanado: ganado(b),
        })),
      };
    }
    const cfg = await this.configPersona(persona.id);
    const bono = cfg?.aplicaBonoAntiguedad
      ? await this.bonoAntiguedadMensual(persona.fechaInicioLaboral, fecha)
      : null;
    const promedio = this.r2(Number(persona.salarioMensual ?? 0) + (bono?.monto ?? 0));
    if (!(promedio > 0)) {
      throw new BadRequestException(
        'No hay boletas de sueldo ni salario mensual registrado para calcular el promedio: envía el promedio a mano.',
      );
    }
    return { promedio, origen: 'SALARIO_REGISTRADO', boletas: [] };
  }

  // -------------------------------------------------------------- vacaciones
  /**
   * Saldo de vacaciones a una fecha: lo ganado por cada año cumplido (escala
   * VACACION con los años de ese aniversario) + ajustes - tomadas - pagadas.
   * `proporcional` = parte del año en curso (para el finiquito), solo con
   * al menos un año cumplido.
   */
  async saldoVacaciones(persona: PersonaCi, fecha: string) {
    const escala = await this.escala('VACACION');
    const inicio = persona.fechaInicioLaboral;
    const anios = inicio ? this.aniosCumplidos(inicio, fecha) : 0;
    let ganados = 0;
    for (let k = 1; k <= anios; k++) {
      ganados += this.valorEscala(escala, k);
    }

    const movimientos = await this.vacacionRepository.find({
      where: { idPersona: persona.id, activo: true },
      order: { fechaDesde: 'ASC', id: 'ASC' },
    });
    const total = (tipo: string) =>
      Math.round(
        movimientos.filter((m) => m.tipo === tipo).reduce((s, m) => s + Number(m.dias), 0) * 10,
      ) / 10;
    const ajustes = total('AJUSTE');
    const tomadas = total('TOMADA');
    const pagadas = total('PAGADA');

    let proporcional = 0;
    if (inicio && anios >= 1) {
      const t = this.tiempo360(inicio, fecha);
      const diasAnioEnCurso = t.totalDias - t.anios * 360;
      proporcional =
        Math.round(((this.valorEscala(escala, anios + 1) * diasAnioEnCurso) / 360) * 10) / 10;
    }

    return {
      fecha,
      aniosCumplidos: anios,
      ganados,
      ajustes,
      tomadas,
      pagadas,
      saldo: Math.round((ganados + ajustes - tomadas - pagadas) * 10) / 10,
      proporcionalAnioEnCurso: proporcional,
      movimientos,
    };
  }

  // --------------------------------------------------------------- aguinaldo
  async calcularAguinaldo(persona: PersonaCi, dto: CalcularAguinaldoDto): Promise<CalculoBoleta> {
    const cfg = await this.configPersona(persona.id);
    if (!cfg?.aplicaAguinaldo) {
      throw new BadRequestException(
        'A esta persona no le corresponde aguinaldo según su configuración de sueldo.',
      );
    }
    const p = await this.parametros();
    const inicioGestion = `${dto.gestion}-01-01`;
    const finGestion = `${dto.gestion}-12-31`;
    const desde =
      persona.fechaInicioLaboral && persona.fechaInicioLaboral > inicioGestion
        ? persona.fechaInicioLaboral.slice(0, 10)
        : inicioGestion;
    const hasta =
      persona.fechaFinLabores && persona.fechaFinLabores < finGestion
        ? persona.fechaFinLabores.slice(0, 10)
        : finGestion;
    if (desde > hasta) {
      throw new BadRequestException(`La persona no trabajó en la gestión ${dto.gestion}.`);
    }

    const dias = dto.diasTrabajados ?? Math.min(360, this.tiempo360(desde, hasta).totalDias);
    const minimo = p[P.DIAS_MINIMOS_AGUINALDO] ?? 0;
    if (dias < minimo) {
      throw new BadRequestException(
        `Trabajó ${dias} días en la gestión: el aguinaldo corresponde desde ${minimo} días.`,
      );
    }
    const prom =
      dto.promedio != null
        ? { promedio: this.r2(dto.promedio), origen: 'MANUAL', boletas: [] }
        : await this.promedioGanado(persona, hasta, inicioGestion);
    const monto = this.r2((prom.promedio * dias) / 360);

    return this.cerrar(
      {
        tipo: 'AGUINALDO',
        fechaDesde: desde,
        fechaHasta: hasta,
        diasTrabajados: null,
        salarioBase: 0,
        bonoAntiguedad: 0,
        horasExtra: 0,
        montoHorasExtra: 0,
        diasDominicales: 0,
        montoDominicales: 0,
        otrosIngresos: monto,
        montoBeneficios: 0,
        rcIva: 0,
        otrosDescuentosLey: 0,
        detalles: [
          this.linea('AGUINALDO', `Aguinaldo de Navidad ${dto.gestion} (${dias} días)`, monto, 1, prom.promedio),
        ],
        explicacion: { gestion: dto.gestion, diasTrabajados: dias, ...prom },
      },
      0,
      [],
    );
  }

  // --------------------------------------------------------------- finiquito
  async calcularFiniquito(persona: PersonaCi, dto: CalcularFiniquitoDto): Promise<CalculoBoleta> {
    if (!persona.fechaInicioLaboral) {
      throw new BadRequestException('La persona no tiene fecha de inicio laboral registrada.');
    }
    const fechaRetiro = dto.fechaRetiro.slice(0, 10);
    if (fechaRetiro < persona.fechaInicioLaboral.slice(0, 10)) {
      throw new BadRequestException('La fecha de retiro es anterior al inicio laboral.');
    }
    const cfg = await this.configPersona(persona.id);
    const p = await this.parametros();
    const tiempo = this.tiempo360(persona.fechaInicioLaboral, fechaRetiro);
    const prom =
      dto.promedio != null
        ? { promedio: this.r2(dto.promedio), origen: 'MANUAL', boletas: [] }
        : await this.promedioGanado(persona, fechaRetiro);
    const promedio = prom.promedio;

    const lineas: LineaDetalle[] = [];
    const omitidos: string[] = [];

    // Indemnización: promedio por cada año, mes y día trabajado.
    if (cfg?.aplicaIndemnizacion && dto.incluirIndemnizacion !== false) {
      const minimo = p[P.DIAS_MINIMOS_INDEMNIZACION] ?? 0;
      if (tiempo.totalDias >= minimo) {
        lineas.push(
          this.linea(
            'INDEMNIZACION',
            `Indemnización (${tiempo.anios} años, ${tiempo.meses} meses, ${tiempo.dias} días)`,
            (promedio * tiempo.totalDias) / 360,
            1,
            promedio,
          ),
        );
      } else {
        omitidos.push(`Indemnización: trabajó ${tiempo.totalDias} días (mínimo ${minimo}).`);
      }
    } else if (dto.incluirIndemnizacion !== false) {
      omitidos.push('Indemnización: no le corresponde según su configuración.');
    }

    if (dto.incluirDesahucio) {
      if (cfg?.aplicaDesahucio) {
        const sueldos = p[P.DESAHUCIO_SUELDOS] ?? 0;
        lineas.push(
          this.linea('DESAHUCIO', `Desahucio (${sueldos} sueldos)`, promedio * sueldos, 2, promedio),
        );
      } else {
        omitidos.push('Desahucio: no le corresponde según su configuración.');
      }
    }

    // Aguinaldo proporcional, si no se pagó ya el de esa gestión.
    if (cfg?.aplicaAguinaldo && dto.incluirAguinaldo !== false) {
      const gestion = Number(fechaRetiro.slice(0, 4));
      const yaPagado = await this.boletaRepository.findOne({
        where: {
          idPersona: persona.id,
          tipo: 'AGUINALDO',
          estado: 'PAGADA',
          fechaDesde: Between(`${gestion}-01-01`, `${gestion}-12-31`),
        },
      });
      const inicioGestion = `${gestion}-01-01`;
      const desde =
        persona.fechaInicioLaboral > inicioGestion ? persona.fechaInicioLaboral.slice(0, 10) : inicioGestion;
      const dias = Math.min(360, this.tiempo360(desde, fechaRetiro).totalDias);
      const minimo = p[P.DIAS_MINIMOS_AGUINALDO] ?? 0;
      if (yaPagado) {
        omitidos.push(`Aguinaldo: ya se pagó el de ${gestion} (boleta N° ${yaPagado.numero}).`);
      } else if (dias < minimo) {
        omitidos.push(`Aguinaldo: trabajó ${dias} días en ${gestion} (mínimo ${minimo}).`);
      } else {
        lineas.push(
          this.linea(
            'AGUINALDO_PROPORCIONAL',
            `Aguinaldo proporcional ${gestion} (${dias} días)`,
            (promedio * dias) / 360,
            3,
            promedio,
          ),
        );
      }
    }

    // Vacaciones pendientes (saldo + proporcional del año en curso).
    let vacaciones: Awaited<ReturnType<PlanillaCalculoService['saldoVacaciones']>> | null = null;
    let diasVacacion = 0;
    if (cfg?.aplicaVacaciones && dto.incluirVacaciones !== false) {
      vacaciones = await this.saldoVacaciones(persona, fechaRetiro);
      diasVacacion =
        dto.diasVacacion ?? Math.max(0, vacaciones.saldo + vacaciones.proporcionalAnioEnCurso);
      if (diasVacacion > 0) {
        lineas.push(
          this.linea(
            'VACACIONES',
            `Vacaciones pendientes (${diasVacacion} días)`,
            (diasVacacion * promedio) / p[P.DIAS_MES],
            4,
            promedio,
          ),
        );
      }
    }

    (dto.otrosIngresos ?? []).forEach((o, i) =>
      lineas.push(this.linea(`OTRO_${i + 1}`, o.nombre.trim(), o.monto, 10 + i)),
    );

    const total = this.suma(lineas.map((l) => l.monto));
    if (!(total > 0)) {
      throw new BadRequestException(
        `No hay montos que pagar en el finiquito. ${omitidos.join(' ')}`.trim(),
      );
    }

    return this.cerrar(
      {
        tipo: 'FINIQUITO',
        fechaDesde: persona.fechaInicioLaboral.slice(0, 10),
        fechaHasta: fechaRetiro,
        diasTrabajados: null,
        salarioBase: 0,
        bonoAntiguedad: 0,
        horasExtra: 0,
        montoHorasExtra: 0,
        diasDominicales: 0,
        montoDominicales: 0,
        otrosIngresos: total,
        montoBeneficios: 0,
        rcIva: 0,
        otrosDescuentosLey: 0,
        detalles: lineas,
        explicacion: {
          configurado: !!cfg,
          motivoRetiro: dto.motivoRetiro ?? null,
          tiempoServicio: tiempo,
          ...prom,
          diasVacacionPagados: diasVacacion,
          vacaciones: vacaciones
            ? { saldo: vacaciones.saldo, proporcional: vacaciones.proporcionalAnioEnCurso }
            : null,
          omitidos,
        },
      },
      0,
      [],
    );
  }

  // ------------------------------------------------------------- retroactivo
  /**
   * Diferencia entre lo pagado en cada boleta de SUELDO del rango y lo que
   * correspondía con el nuevo salario y el salario mínimo vigente (bono de
   * antigüedad). Sobre el total se calculan los descuentos y aportes de la
   * persona, como en un sueldo.
   */
  async calcularRetroactivo(persona: PersonaCi, dto: CalcularRetroactivoDto): Promise<CalculoBoleta> {
    const desde = dto.fechaDesde.slice(0, 10);
    const hasta = dto.fechaHasta.slice(0, 10);
    if (desde > hasta) {
      throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta.');
    }
    const cfg = await this.configPersona(persona.id);
    const p = await this.parametros();
    const diasMes = p[P.DIAS_MES];
    const boletas = await this.boletaRepository.find({
      where: {
        idPersona: persona.id,
        tipo: 'SUELDO',
        estado: 'PAGADA',
        fechaHasta: Between(desde, hasta),
      },
      order: { fechaHasta: 'ASC' },
    });
    if (!boletas.length) {
      throw new BadRequestException('No hay boletas de sueldo pagadas en ese rango.');
    }

    const lineas: LineaDetalle[] = [];
    const meses: Record<string, unknown>[] = [];
    let orden = 1;
    for (const b of boletas) {
      const proporcion = Math.min(b.diasTrabajados ?? diasMes, diasMes) / diasMes;
      const periodo = `${b.fechaDesde} al ${b.fechaHasta}`;
      // Corto para que entre en la columna de la boleta: "oct/2026" (mes del fin de periodo).
      const [anio, mes] = b.fechaHasta.slice(0, 7).split('-');
      const mesCorto = `${MESES_CORTOS[Number(mes) - 1]}/${anio}`;
      const difBasico =
        dto.nuevoSalario != null
          ? this.r2(Math.max(0, dto.nuevoSalario * proporcion - Number(b.salarioBase)))
          : 0;
      let difBono = 0;
      if (cfg?.aplicaBonoAntiguedad) {
        const bono = await this.bonoAntiguedadMensual(persona.fechaInicioLaboral, b.fechaHasta);
        difBono = this.r2(Math.max(0, bono.monto * proporcion - Number(b.bonoAntiguedad)));
      }
      if (difBasico > 0) {
        lineas.push(this.linea(`RETRO_BASICO_${b.numero}`, `Retroactivo básico ${mesCorto}`, difBasico, orden++));
      }
      if (difBono > 0) {
        lineas.push(this.linea(`RETRO_BONO_${b.numero}`, `Retroactivo bono ${mesCorto}`, difBono, orden++));
      }
      meses.push({ boleta: b.numero, periodo, difBasico, difBono });
    }

    const total = this.suma(lineas.map((l) => l.monto));
    if (!(total > 0)) {
      throw new BadRequestException('No hay diferencias que pagar en ese rango.');
    }

    return this.cerrar(
      {
        tipo: 'RETROACTIVO',
        fechaDesde: boletas[0].fechaDesde,
        fechaHasta: boletas[boletas.length - 1].fechaHasta,
        diasTrabajados: null,
        salarioBase: 0,
        bonoAntiguedad: 0,
        horasExtra: 0,
        montoHorasExtra: 0,
        diasDominicales: 0,
        montoDominicales: 0,
        otrosIngresos: total,
        montoBeneficios: 0,
        rcIva: 0,
        otrosDescuentosLey: 0,
        detalles: lineas,
        explicacion: { configurado: !!cfg, nuevoSalario: dto.nuevoSalario ?? null, meses },
      },
      undefined,
      this.calcularConceptos(cfg?.conceptos ?? [], total),
    );
  }
}
