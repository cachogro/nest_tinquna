import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { actualizarDatosEmpresa } from 'src/common/datos-empresa';
import { ParametroPlanilla } from '../entities/parametro-planilla.entity';
import { ConceptoPlanilla } from '../entities/concepto-planilla.entity';
import { EscalaPlanilla, TipoEscalaPlanilla } from '../entities/escala-planilla.entity';
import { TipoContrato } from '../entities/tipo-contrato.entity';
import { HorarioTrabajo, HorarioTrabajoDia } from '../entities/horario-trabajo.entity';
import { DatosEmpleador } from '../entities/datos-empleador.entity';
import { GuardarDatosEmpleadorDto } from '../dto/planilla/guardar-datos-empleador.dto';
import { GuardarHorarioTrabajoDto } from '../dto/planilla/guardar-horario-trabajo.dto';
import { GuardarParametrosPlanillaDto } from '../dto/planilla/guardar-parametros-planilla.dto';
import { GuardarConceptoPlanillaDto } from '../dto/planilla/guardar-concepto-planilla.dto';
import { GuardarEscalaPlanillaDto } from '../dto/planilla/guardar-escala-planilla.dto';
import { GuardarTipoContratoDto } from '../dto/planilla/guardar-tipo-contrato.dto';
import { GuardarBeneficioPlanillaDto } from '../dto/planilla/guardar-beneficio-planilla.dto';
import { BeneficioPlanilla, validarValorBeneficio } from '../entities/beneficio-planilla.entity';

/**
 * Panel de configuración de sueldos y planillas: parámetros sueltos
 * (salario mínimo, recargos...), descuentos y aportes con su porcentaje,
 * escalas por antigüedad (bono y vacaciones) y tipos de contrato con lo que
 * les corresponde por defecto. Todo se lee al calcular cada boleta, así que
 * un cambio acá rige para las boletas que se emitan después (las ya
 * emitidas guardan su propia copia).
 */
@Injectable()
export class PlanillaConfigService implements OnModuleInit {
  constructor(
    @InjectRepository(ParametroPlanilla, 'ci')
    private readonly parametroRepository: Repository<ParametroPlanilla>,

    @InjectRepository(ConceptoPlanilla, 'ci')
    private readonly conceptoRepository: Repository<ConceptoPlanilla>,

    @InjectRepository(EscalaPlanilla, 'ci')
    private readonly escalaRepository: Repository<EscalaPlanilla>,

    @InjectRepository(TipoContrato, 'ci')
    private readonly tipoContratoRepository: Repository<TipoContrato>,

    @InjectRepository(HorarioTrabajo, 'ci')
    private readonly horarioRepository: Repository<HorarioTrabajo>,

    @InjectRepository(DatosEmpleador, 'ci')
    private readonly datosEmpleadorRepository: Repository<DatosEmpleador>,

    @InjectRepository(BeneficioPlanilla, 'ci')
    private readonly beneficioRepository: Repository<BeneficioPlanilla>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  /** Todo el panel en una sola llamada. */
  async configuracion() {
    const [parametros, conceptos, beneficios, bonoAntiguedad, vacacion, atraso, tiposContrato, horarios, empleador] =
      await Promise.all([
        this.listarParametros(),
        this.listarConceptos(),
        this.listarBeneficios(),
        this.listarEscala('BONO_ANTIGUEDAD'),
        this.listarEscala('VACACION'),
        this.listarEscala('ATRASO'),
        this.listarTiposContrato(),
        this.listarHorarios(),
        this.datosEmpleador(),
      ]);
    return {
      parametros,
      conceptos,
      beneficios,
      escalas: { bonoAntiguedad, vacacion, atraso },
      tiposContrato,
      horarios,
      empleador,
    };
  }

  // -------------------------------------------------------------- parámetros
  async listarParametros(): Promise<ParametroPlanilla[]> {
    return await this.parametroRepository.find({ order: { id: 'ASC' } });
  }

  /** { SALARIO_MINIMO_NACIONAL: 3300, ... } con los valores numéricos. */
  async valoresParametros(): Promise<Record<string, number>> {
    const filas = await this.parametroRepository.find({ where: { activo: true } });
    return Object.fromEntries(filas.map((p) => [p.codigo, Number(p.valor)]));
  }

  async guardarParametros(
    dto: GuardarParametrosPlanillaDto,
    user: Usuario,
  ): Promise<ParametroPlanilla[]> {
    const codigos = dto.parametros.map((p) => p.codigo.trim().toUpperCase());
    if (new Set(codigos).size !== codigos.length) {
      throw new BadRequestException('Un parámetro figura más de una vez.');
    }
    const existentes = await this.parametroRepository.find({
      where: { codigo: In(codigos) },
    });
    const porCodigo = new Map(existentes.map((p) => [p.codigo, p]));
    const faltan = codigos.filter((c) => !porCodigo.has(c));
    if (faltan.length) {
      throw new NotFoundException(`No existen los parámetros: ${faltan.join(', ')}.`);
    }

    dto.parametros.forEach((p, i) => {
      const parametro = porCodigo.get(codigos[i])!;
      parametro.valor = p.valor;
      parametro.usuarioUltimaModificacion = user.usuario;
    });
    await this.parametroRepository.save(existentes);
    return await this.listarParametros();
  }

  // ------------------------------------------------- descuentos y aportes
  /** Activos e inactivos, en el orden de la boleta. */
  async listarConceptos(): Promise<ConceptoPlanilla[]> {
    return await this.conceptoRepository.find({
      order: { tipo: 'DESC', orden: 'ASC', id: 'ASC' },
    });
  }

  async guardarConcepto(
    dto: GuardarConceptoPlanillaDto,
    user: Usuario,
  ): Promise<ConceptoPlanilla> {
    const codigo = dto.codigo.trim().toUpperCase();
    const duplicado = await this.conceptoRepository
      .createQueryBuilder('c')
      .where('UPPER(c.codigo) = :codigo', { codigo })
      .andWhere(dto.id ? 'c.id <> :id' : '1 = 1', { id: dto.id })
      .getOne();
    if (duplicado) {
      throw new ConflictException(`Ya existe un concepto con el código "${codigo}".`);
    }

    const concepto = dto.id
      ? await this.obtenerConcepto(dto.id)
      : this.conceptoRepository.create({ usuarioRegistro: user.usuario });

    concepto.codigo = codigo;
    concepto.nombre = dto.nombre.trim();
    concepto.tipo = dto.tipo;
    concepto.entidad = dto.entidad.trim().toUpperCase();
    concepto.porcentaje = dto.porcentaje;
    concepto.montoDesde = dto.montoDesde ?? 0;
    concepto.orden = dto.orden ?? concepto.orden ?? 0;
    if (dto.id) {
      concepto.usuarioUltimaModificacion = user.usuario;
    }
    return await this.conceptoRepository.save(concepto);
  }

  async cambiarEstadoConcepto(
    id: number,
    activo: boolean,
    user: Usuario,
  ): Promise<ConceptoPlanilla> {
    const concepto = await this.obtenerConcepto(id);
    concepto.activo = activo;
    concepto.usuarioUltimaModificacion = user.usuario;
    return await this.conceptoRepository.save(concepto);
  }

  private async obtenerConcepto(id: number): Promise<ConceptoPlanilla> {
    const concepto = await this.conceptoRepository.findOne({ where: { id } });
    if (!concepto) {
      throw new NotFoundException('No se encontró el concepto de planilla.');
    }
    return concepto;
  }

  // ---------------------------------------------- beneficios (lactancia...)
  /** Activos e inactivos, por nombre. */
  async listarBeneficios(): Promise<BeneficioPlanilla[]> {
    return await this.beneficioRepository.find({ order: { nombre: 'ASC' } });
  }

  async obtenerBeneficio(id: number): Promise<BeneficioPlanilla> {
    const beneficio = await this.beneficioRepository.findOne({ where: { id } });
    if (!beneficio) {
      throw new NotFoundException('No se encontró el beneficio.');
    }
    return beneficio;
  }

  async guardarBeneficio(dto: GuardarBeneficioPlanillaDto, user: Usuario): Promise<BeneficioPlanilla> {
    const nombre = dto.nombre.trim().toUpperCase();
    const duplicado = await this.beneficioRepository
      .createQueryBuilder('b')
      .where('UPPER(b.nombre) = :nombre', { nombre })
      .andWhere(dto.id ? 'b.id <> :id' : '1 = 1', { id: dto.id })
      .getOne();
    if (duplicado) {
      throw new ConflictException(`Ya existe el beneficio "${nombre}".`);
    }
    const valor = validarValorBeneficio(dto.porcentaje, dto.monto);

    const beneficio = dto.id
      ? await this.obtenerBeneficio(dto.id)
      : this.beneficioRepository.create({ usuarioRegistro: user.usuario });

    beneficio.nombre = nombre;
    beneficio.porcentaje = valor.porcentaje;
    beneficio.monto = valor.monto;
    beneficio.meses = dto.meses;
    beneficio.cotiza = dto.cotiza ?? beneficio.cotiza ?? false;
    beneficio.descripcion = dto.descripcion?.trim().toUpperCase() || null;
    if (dto.id) {
      beneficio.usuarioUltimaModificacion = user.usuario;
    }
    return await this.beneficioRepository.save(beneficio);
  }

  async cambiarEstadoBeneficio(id: number, activo: boolean, user: Usuario): Promise<BeneficioPlanilla> {
    const beneficio = await this.obtenerBeneficio(id);
    beneficio.activo = activo;
    beneficio.usuarioUltimaModificacion = user.usuario;
    return await this.beneficioRepository.save(beneficio);
  }

  // --------------------------------------------------------------- escalas
  async listarEscala(tipo: TipoEscalaPlanilla): Promise<EscalaPlanilla[]> {
    return await this.escalaRepository.find({
      where: { tipo, activo: true },
      order: { aniosDesde: 'ASC' },
    });
  }

  /** Reemplaza todos los tramos del tipo. Rechaza tramos que se pisen. */
  async guardarEscala(
    dto: GuardarEscalaPlanillaDto,
    user: Usuario,
  ): Promise<EscalaPlanilla[]> {
    const tramos = [...dto.tramos].sort((a, b) => a.aniosDesde - b.aniosDesde);
    tramos.forEach((t, i) => {
      if (t.aniosHasta != null && t.aniosHasta < t.aniosDesde) {
        throw new BadRequestException(
          `El tramo desde ${t.aniosDesde} años tiene "hasta" menor que "desde".`,
        );
      }
      const siguiente = tramos[i + 1];
      if (siguiente && (t.aniosHasta == null || t.aniosHasta >= siguiente.aniosDesde)) {
        throw new BadRequestException(
          `Los tramos desde ${t.aniosDesde} y desde ${siguiente.aniosDesde} años se superponen.`,
        );
      }
    });

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(EscalaPlanilla, { tipo: dto.tipo });
      if (tramos.length) {
        await manager.save(
          tramos.map((t) =>
            manager.create(EscalaPlanilla, {
              tipo: dto.tipo,
              aniosDesde: t.aniosDesde,
              aniosHasta: t.aniosHasta ?? null,
              valor: t.valor,
              usuarioRegistro: user.usuario,
            }),
          ),
        );
      }
    });
    return await this.listarEscala(dto.tipo);
  }

  // ---------------------------------------------------- tipos de contrato
  async listarTiposContrato(): Promise<TipoContrato[]> {
    return await this.tipoContratoRepository.find({
      relations: { conceptos: true },
      order: { descripcion: 'ASC' },
    });
  }

  async obtenerTipoContrato(id: number): Promise<TipoContrato> {
    const tipo = await this.tipoContratoRepository.findOne({
      where: { id },
      relations: { conceptos: true },
    });
    if (!tipo) {
      throw new NotFoundException('No se encontró el tipo de contrato.');
    }
    return tipo;
  }

  async guardarTipoContrato(
    dto: GuardarTipoContratoDto,
    user: Usuario,
  ): Promise<TipoContrato> {
    const descripcion = dto.descripcion.trim().toUpperCase();
    const duplicado = await this.tipoContratoRepository
      .createQueryBuilder('t')
      .where('UPPER(t.descripcion) = :descripcion', { descripcion })
      .andWhere(dto.id ? 't.id <> :id' : '1 = 1', { id: dto.id })
      .getOne();
    if (duplicado) {
      throw new ConflictException(`Ya existe el tipo de contrato "${descripcion}".`);
    }

    const tipo = dto.id
      ? await this.obtenerTipoContrato(dto.id)
      : this.tipoContratoRepository.create({ usuarioRegistro: user.usuario });

    tipo.descripcion = descripcion;
    tipo.aplicaBonoAntiguedad = dto.aplicaBonoAntiguedad ?? tipo.aplicaBonoAntiguedad ?? false;
    tipo.aplicaHorasExtra = dto.aplicaHorasExtra ?? tipo.aplicaHorasExtra ?? false;
    tipo.aplicaAguinaldo = dto.aplicaAguinaldo ?? tipo.aplicaAguinaldo ?? false;
    tipo.aplicaVacaciones = dto.aplicaVacaciones ?? tipo.aplicaVacaciones ?? false;
    tipo.aplicaIndemnizacion = dto.aplicaIndemnizacion ?? tipo.aplicaIndemnizacion ?? false;
    tipo.aplicaDesahucio = dto.aplicaDesahucio ?? tipo.aplicaDesahucio ?? false;
    if (dto.idsConceptos) {
      tipo.conceptos = await this.conceptosPorIds(dto.idsConceptos);
    }
    if (dto.id) {
      tipo.usuarioUltimaModificacion = user.usuario;
    }

    const guardado = await this.tipoContratoRepository.save(tipo);
    return await this.obtenerTipoContrato(guardado.id);
  }

  async cambiarEstadoTipoContrato(
    id: number,
    activo: boolean,
    user: Usuario,
  ): Promise<TipoContrato> {
    const tipo = await this.obtenerTipoContrato(id);
    tipo.activo = activo;
    tipo.usuarioUltimaModificacion = user.usuario;
    return await this.tipoContratoRepository.save(tipo);
  }

  /** Valida que existan todos los ids (activos o no) y los devuelve. */
  async conceptosPorIds(ids: number[]): Promise<ConceptoPlanilla[]> {
    const unicos = [...new Set(ids.map(Number))];
    if (!unicos.length) return [];
    const conceptos = await this.conceptoRepository.find({ where: { id: In(unicos) } });
    if (conceptos.length !== unicos.length) {
      const encontrados = new Set(conceptos.map((c) => c.id));
      const faltan = unicos.filter((id) => !encontrados.has(id));
      throw new NotFoundException(`No existen los conceptos de planilla: ${faltan.join(', ')}.`);
    }
    return conceptos;
  }

  // --------------------------------------------------------------- horarios
  /** Activos e inactivos, con sus días en orden. */
  async listarHorarios(): Promise<HorarioTrabajo[]> {
    return await this.horarioRepository.find({
      relations: { dias: true, horarioReemplaza: true },
      order: { descripcion: 'ASC', dias: { diaSemana: 'ASC' } },
    });
  }

  async obtenerHorario(id: number): Promise<HorarioTrabajo> {
    const horario = await this.horarioRepository.findOne({
      where: { id },
      relations: { dias: true, horarioReemplaza: true },
      order: { dias: { diaSemana: 'ASC' } },
    });
    if (!horario) {
      throw new NotFoundException('No se encontró el horario de trabajo.');
    }
    return horario;
  }

  /** "08:30" o "08:30:00" -> minutos desde las 00:00. */
  private minutos(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  /** Crea o actualiza el horario; `dias` reemplaza todos sus días. */
  async guardarHorario(dto: GuardarHorarioTrabajoDto, user: Usuario): Promise<HorarioTrabajo> {
    const descripcion = dto.descripcion.trim().toUpperCase();
    const duplicado = await this.horarioRepository
      .createQueryBuilder('h')
      .where('UPPER(h.descripcion) = :descripcion', { descripcion })
      .andWhere(dto.id ? 'h.id <> :id' : '1 = 1', { id: dto.id })
      .getOne();
    if (duplicado) {
      throw new ConflictException(`Ya existe el horario "${descripcion}".`);
    }

    const dias = new Set<number>();
    for (const d of dto.dias) {
      if (dias.has(d.diaSemana)) {
        throw new BadRequestException(`El día ${d.diaSemana} figura más de una vez.`);
      }
      dias.add(d.diaSemana);
      const conAlmuerzo = !!d.horaSalidaAlmuerzo || !!d.horaRetornoAlmuerzo;
      if (conAlmuerzo && !(d.horaSalidaAlmuerzo && d.horaRetornoAlmuerzo)) {
        throw new BadRequestException(
          `Día ${d.diaSemana}: indica la salida y el retorno de almuerzo, o ninguno (horario continuo).`,
        );
      }
      const orden = [d.horaIngreso, d.horaSalidaAlmuerzo, d.horaRetornoAlmuerzo, d.horaSalida]
        .filter((h): h is string => !!h)
        .map((h) => this.minutos(h));
      if (orden.some((m, i) => i > 0 && m <= orden[i - 1])) {
        throw new BadRequestException(
          `Día ${d.diaSemana}: las horas deben ir en orden (ingreso, salida a almuerzo, retorno, salida).`,
        );
      }
    }

    const temporada = dto.idHorarioReemplaza != null;
    if (temporada) {
      if (dto.id && Number(dto.idHorarioReemplaza) === Number(dto.id)) {
        throw new BadRequestException('Un horario no puede reemplazarse a sí mismo.');
      }
      await this.obtenerHorario(Number(dto.idHorarioReemplaza));
      if (!dto.vigenciaDesde || !dto.vigenciaHasta || dto.vigenciaDesde > dto.vigenciaHasta) {
        throw new BadRequestException(
          'Un horario de temporada necesita vigencia desde y hasta (desde <= hasta).',
        );
      }
    }

    const id = await this.dataSource.transaction(async (manager) => {
      const horario = dto.id
        ? await manager.findOne(HorarioTrabajo, { where: { id: dto.id } })
        : manager.create(HorarioTrabajo, { usuarioRegistro: user.usuario });
      if (!horario) {
        throw new NotFoundException('No se encontró el horario de trabajo.');
      }
      horario.descripcion = descripcion;
      horario.idHorarioReemplaza = temporada ? Number(dto.idHorarioReemplaza) : null;
      horario.vigenciaDesde = temporada ? dto.vigenciaDesde!.slice(0, 10) : null;
      horario.vigenciaHasta = temporada ? dto.vigenciaHasta!.slice(0, 10) : null;
      horario.observaciones = dto.observaciones?.trim() || null;
      if (dto.id) horario.usuarioUltimaModificacion = user.usuario;
      const guardado = await manager.save(HorarioTrabajo, { ...horario, dias: undefined });

      await manager.delete(HorarioTrabajoDia, { idHorarioTrabajo: guardado.id });
      if (dto.dias.length) {
        await manager.save(
          dto.dias.map((d) =>
            manager.create(HorarioTrabajoDia, {
              idHorarioTrabajo: guardado.id,
              diaSemana: d.diaSemana,
              horaIngreso: d.horaIngreso,
              horaSalidaAlmuerzo: d.horaSalidaAlmuerzo || null,
              horaRetornoAlmuerzo: d.horaRetornoAlmuerzo || null,
              horaSalida: d.horaSalida,
            }),
          ),
        );
      }
      return guardado.id;
    });
    return await this.obtenerHorario(id);
  }

  async cambiarEstadoHorario(id: number, activo: boolean, user: Usuario): Promise<HorarioTrabajo> {
    const horario = await this.obtenerHorario(id);
    horario.activo = activo;
    horario.usuarioUltimaModificacion = user.usuario;
    await this.horarioRepository.save({ ...horario, dias: undefined, horarioReemplaza: undefined });
    return await this.obtenerHorario(id);
  }

  // --------------------------------------------------- datos del empleador
  /** La única fila (la crea el script 104); sin ella, solo la razón social por defecto. */
  async datosEmpleador(): Promise<DatosEmpleador> {
    const fila = await this.datosEmpleadorRepository.findOne({ where: {}, order: { id: 'ASC' } });
    return fila ?? this.datosEmpleadorRepository.create({ razonSocial: 'EMPRESA TINKURIQUNA MINERALS S.R.L.' });
  }

  async guardarDatosEmpleador(dto: GuardarDatosEmpleadorDto, user: Usuario): Promise<DatosEmpleador> {
    const texto = (v?: string | null) => (v ?? '').trim().toUpperCase() || null;
    const fila = await this.datosEmpleadorRepository.findOne({ where: {}, order: { id: 'ASC' } });
    const datos = fila ?? this.datosEmpleadorRepository.create({ usuarioRegistro: user.usuario });
    datos.razonSocial = dto.razonSocial.trim().toUpperCase();
    datos.nit = texto(dto.nit);
    datos.ruex = texto(dto.ruex);
    datos.nim = texto(dto.nim);
    datos.sucursal = texto(dto.sucursal);
    datos.puntoVenta = texto(dto.puntoVenta);
    datos.direccion = texto(dto.direccion);
    datos.telefono = texto(dto.telefono);
    datos.ciudad = texto(dto.ciudad);
    datos.numeroEmpleadorMteps = texto(dto.numeroEmpleadorMteps);
    datos.numeroEmpleadorCns = texto(dto.numeroEmpleadorCns);
    datos.representanteLegal = texto(dto.representanteLegal);
    datos.ciRepresentanteLegal = texto(dto.ciRepresentanteLegal);
    datos.usuarioUltimaModificacion = user.usuario;
    const guardado = await this.datosEmpleadorRepository.save(datos);
    actualizarDatosEmpresa(guardado);
    return guardado;
  }

  /** Carga razón social y NIT para los reportes (ver src/common/datos-empresa). */
  async onModuleInit(): Promise<void> {
    try {
      const fila = await this.datosEmpleadorRepository.findOne({ where: {}, order: { id: 'ASC' } });
      if (fila) actualizarDatosEmpresa(fila);
    } catch {
      // Sin la tabla (script 104 pendiente) los reportes usan el nombre por defecto.
    }
  }
}
