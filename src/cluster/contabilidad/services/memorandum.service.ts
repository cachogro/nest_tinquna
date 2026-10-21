import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { PlanillaConfigService } from 'src/cluster/parametricas/services/planilla-config.service';
import { numeroALetras } from 'src/common/utils/numero-a-letras.util';
import { tratamientoPersona } from 'src/common/utils/tratamiento.util';
import { EmisorMemorandum, Memorandum } from '../entities/memorandum.entity';
import { PersonalPlanilla } from '../entities/personal-planilla.entity';
import { BoletaPago } from '../entities/boleta-pago.entity';
import {
  AnularMemorandumDto,
  CrearMemorandumDto,
  FiltroMemorandumDto,
} from '../dto/memorandum/memorandum.dto';
import { PrestamoPersonalService } from './prestamo-personal.service';

const PREFIJO_CITE_DEFECTO = 'TINKURIQUNA/RRHH/MEMO';

// Clave del pg_advisory_xact_lock que serializa el correlativo del CITE.
const LOCK_CORRELATIVO = 72001;

const ORDINALES = [
  'PRIMERA',
  'SEGUNDA',
  'TERCERA',
  'CUARTA',
  'QUINTA',
  'SEXTA',
  'SÉPTIMA',
  'OCTAVA',
  'NOVENA',
  'DÉCIMA',
];

/** Hoy en hora de Bolivia (UTC-4 fijo), "YYYY-MM-DD". */
const hoyBolivia = () => new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Memorándums de llamada de atención y sanción al personal. Cada uno lleva
 * un CITE correlativo por gestión; no se editan: se anulan y se emite otro.
 * La sanción se descuenta en la boleta de sueldo (PlanillaCalculoService).
 */
@Injectable()
export class MemorandumService {
  constructor(
    @InjectRepository(Memorandum, 'ci')
    private readonly memorandumRepository: Repository<Memorandum>,

    @InjectRepository(PersonalPlanilla, 'ci')
    private readonly personalPlanillaRepository: Repository<PersonalPlanilla>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(BoletaPago, 'ci')
    private readonly boletaRepository: Repository<BoletaPago>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,

    private readonly configService: ConfigService,
    private readonly planillaConfigService: PlanillaConfigService,
    private readonly prestamoPersonalService: PrestamoPersonalService,
  ) {}

  // ------------------------------------------------------------------ textos
  /** 1 → "PRIMERA"; desde la 11 → "11.ª". */
  static ordinal(n: number): string {
    return ORDINALES[n - 1] ?? `${n}.ª`;
  }

  /** "Un (1) día", "Medio (0,5) día", "Dos (2) días", "Uno y medio (1,5) días". */
  static textoDias(dias: number): string {
    const d = Number(dias);
    const entero = Math.floor(d);
    const medio = d - entero >= 0.5;
    const cifra = String(d).replace('.', ',');
    let letras: string;
    if (entero === 0) letras = 'medio';
    else {
      letras = numeroALetras(entero);
      letras = medio ? `${letras} y medio` : letras.replace(/uno$/, 'un');
    }
    const plural = d > 1 ? 'días' : 'día';
    return `${letras.charAt(0).toUpperCase()}${letras.slice(1)} (${cifra}) ${plural}`;
  }

  /** Texto de la columna SANCIÓN del PDF y del listado. */
  static textoSancion(m: Pick<Memorandum, 'tipoSancion' | 'diasSancion'>): string {
    if (m.tipoSancion === 'DIAS') return MemorandumService.textoDias(Number(m.diasSancion));
    if (m.tipoSancion === 'MONTO') return 'Multa';
    return 'Ninguna';
  }

  private prefijoCite(): string {
    return (this.configService.get<string>('MEMORANDUM_CITE_PREFIJO') || PREFIJO_CITE_DEFECTO).trim();
  }

  private cite(numero: number, gestion: number): string {
    return `${this.prefijoCite()}/${String(numero).padStart(3, '0')}/${gestion}`;
  }

  private nombre(p: PersonaCi): string {
    // Los nombres a veces vienen con espacios de más ("RAUL "): se normalizan.
    return [p.nombres, p.apellidoPaterno, p.apellidoMaterno]
      .map((s) => (s ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .toUpperCase();
  }

  /** Primer nombre y primer apellido, para la columna del listado. */
  private nombreCorto(p: PersonaCi): string {
    const primerNombre = (p.nombres ?? '').trim().split(/\s+/)[0] ?? '';
    return [primerNombre, (p.apellidoPaterno ?? '').trim() || (p.apellidoMaterno ?? '').trim()]
      .filter(Boolean)
      .join(' ')
      .toUpperCase();
  }

  private r2(v: number | string | null | undefined): number {
    return Math.round(Number(v ?? 0) * 100) / 100;
  }

  // ------------------------------------------------------------------ datos
  /** Roles de la persona (CHOFER, GERENTE...) unidos: "GERENTE / CONTADOR". */
  private async roles(idPersona: string): Promise<string | null> {
    const p = await this.personaRepository.findOne({
      where: { id: String(idPersona) },
      relations: { personaTipos: { personaTipo: true } },
    });
    const nombres = (p?.personaTipos ?? [])
      .filter((pt) => pt.activo !== false && pt.personaTipo?.nombre)
      .map((pt) => pt.personaTipo.nombre.toUpperCase());
    return nombres.length ? nombres.join(' / ') : null;
  }

  /** Cargo del destinatario: el de su configuración de sueldo o, sin él, sus roles. */
  private async cargo(idPersona: string): Promise<string | null> {
    const cfg = await this.personalPlanillaRepository.findOne({ where: { idPersona: String(idPersona) } });
    return cfg?.cargo?.trim() || (await this.roles(idPersona));
  }

  /** Personas que pueden firmar: check `autorizado` y activas, con su cargo (roles). */
  private async firmantes() {
    const personas = await this.personaRepository.find({
      where: { autorizado: true, activo: true },
      relations: { personaTipos: { personaTipo: true } },
      order: { nombres: 'ASC' },
    });
    return personas.map((p) => {
      const roles = (p.personaTipos ?? [])
        .filter((pt) => pt.activo !== false && pt.personaTipo?.nombre)
        .map((pt) => pt.personaTipo.nombre.toUpperCase());
      return {
        id: p.id,
        nombre: this.nombre(p),
        numeroDocumento: p.numeroDocumento ?? null,
        tratamiento: tratamientoPersona(p),
        cargo: roles.length ? roles.join(' / ') : null,
      };
    });
  }

  /**
   * Llamadas de atención VIGENTES (EMITIDAS, no anuladas) de la persona con
   * fecha hasta `fecha`: el memorándum de esa fecha es la siguiente. Es la
   * cuenta que respalda el ordinal impreso (PRIMERA, SEGUNDA...), por eso
   * depende de la fecha y no de cuántos memorándums se cargaron.
   */
  private async llamadasPrevias(idPersona: string, fecha: string, manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(Memorandum) : this.memorandumRepository;
    return repo.count({
      where: { idPersona: String(idPersona), estado: 'EMITIDO', activo: true, fecha: LessThanOrEqual(fecha) },
    });
  }

  /** Primer memorándum EMITIDO de la persona con fecha posterior a `fecha` (null si no hay). */
  private async posteriorA(idPersona: string, fecha: string, manager?: EntityManager): Promise<Memorandum | null> {
    const repo = manager ? manager.getRepository(Memorandum) : this.memorandumRepository;
    return repo.findOne({
      where: { idPersona: String(idPersona), estado: 'EMITIDO', activo: true, fecha: MoreThan(fecha) },
      order: { fecha: 'ASC', id: 'ASC' },
    });
  }

  private mensajePosterior(m: Memorandum): string {
    return (
      `Ya existe el memorándum ${m.cite} del ${m.fecha.slice(0, 10).split('-').reverse().join('/')} ` +
      `(${MemorandumService.ordinal(m.numeroLlamada)} llamada), posterior a esta fecha: un memorándum con fecha ` +
      'anterior alteraría el orden de las llamadas ya entregadas. Use una fecha igual o posterior, o regístrelo como memorándum ya emitido en papel.'
    );
  }

  private async siguienteNumero(manager: EntityManager, gestion: number): Promise<number> {
    const row = await manager
      .createQueryBuilder(Memorandum, 'm')
      .select('COALESCE(MAX(m.numero), 0)', 'max')
      .where('m.gestion = :gestion', { gestion })
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  /** Haber diario = salario mensual / 30 (null sin salario registrado). */
  private haberDiario(persona: PersonaCi): number | null {
    const salario = Number(persona.salarioMensual ?? 0);
    return salario > 0 ? this.r2(salario / 30) : null;
  }

  /**
   * Lo que el front necesita para armar el memorándum: CITE que tendría,
   * número de llamada sugerido, cargo y tratamiento, haber diario, quiénes
   * pueden firmar y los memorándums previos.
   */
  async preparar(idPersona: string, fecha?: string) {
    const persona = await this.prestamoPersonalService.obtenerPersonal(idPersona);
    const dia = (fecha ?? hoyBolivia()).slice(0, 10);
    const gestion = Number(dia.slice(0, 4));
    const numero = await this.siguienteNumero(this.dataSource.manager, gestion);
    const previas = await this.llamadasPrevias(persona.id, dia);
    const posterior = await this.posteriorA(persona.id, dia);
    const empleador = await this.planillaConfigService.datosEmpleador();
    const historial = await this.memorandumRepository.find({
      where: { idPersona: persona.id, activo: true },
      order: { fecha: 'DESC', id: 'DESC' },
    });

    return {
      persona: {
        id: persona.id,
        nombre: this.nombre(persona),
        numeroDocumento: persona.numeroDocumento ?? null,
        tratamiento: tratamientoPersona(persona),
        cargo: await this.cargo(persona.id),
        haberDiario: this.haberDiario(persona),
      },
      citeSugerido: this.cite(numero, gestion),
      numeroLlamadaSugerido: previas + 1,
      ordinalSugerido: MemorandumService.ordinal(previas + 1),
      // Llamadas vigentes que respaldan el número y, si la fecha es anterior
      // a un memorándum ya emitido, por qué no se puede emitir con esa fecha.
      llamadasVigentes: previas,
      avisoFecha: posterior ? this.mensajePosterior(posterior) : null,
      lugar: empleador.ciudad ?? null,
      firmantes: (await this.firmantes()).filter((f) => String(f.id) !== String(persona.id)),
      historial: await this.conBoleta(historial),
    };
  }

  // ------------------------------------------------------------------ emitir
  async crear(dto: CrearMemorandumDto, user: Usuario): Promise<Memorandum> {
    const persona = await this.prestamoPersonalService.obtenerPersonal(dto.idPersona);
    const fecha = dto.fecha.slice(0, 10);
    const gestion = Number(fecha.slice(0, 4));

    // ---------------------------------------------------------- sanción
    const tipoSancion = dto.tipoSancion ?? 'NINGUNA';
    let diasSancion: number | null = null;
    let importeSancion = 0;
    if (tipoSancion === 'DIAS') {
      if (!dto.diasSancion) {
        throw new BadRequestException('Indique los días de sanción (diasSancion).');
      }
      diasSancion = Number(dto.diasSancion);
      if (dto.importeSancion != null) {
        importeSancion = this.r2(dto.importeSancion);
      } else {
        const diario = this.haberDiario(persona);
        if (diario == null) {
          throw new BadRequestException(
            'La persona no tiene salario mensual registrado: envíe el importe de la sanción (importeSancion).',
          );
        }
        importeSancion = this.r2(diario * diasSancion);
      }
    } else if (tipoSancion === 'MONTO') {
      if (!dto.importeSancion || dto.importeSancion <= 0) {
        throw new BadRequestException('Indique el importe de la multa (importeSancion).');
      }
      importeSancion = this.r2(dto.importeSancion);
    }

    // ---------------------------------------------------------- firmante
    if (String(dto.idPersonaEmisor) === String(persona.id)) {
      throw new BadRequestException('Quien firma no puede ser el mismo destinatario.');
    }
    const firmante = await this.personaRepository.findOne({ where: { id: String(dto.idPersonaEmisor) } });
    if (!firmante) throw new NotFoundException('No se encontró la persona que firma.');
    if (!firmante.activo || !firmante.autorizado) {
      throw new BadRequestException('Quien firma debe ser una persona activa y autorizada.');
    }
    const emisor: EmisorMemorandum = {
      idPersona: firmante.id,
      nombre: this.nombre(firmante),
      ci: firmante.numeroDocumento ?? null,
      cargo: await this.roles(firmante.id),
      tratamiento: tratamientoPersona(firmante),
    };

    const lugar =
      dto.lugar?.trim() || (await this.planillaConfigService.datosEmpleador()).ciudad || null;
    if (!lugar) {
      throw new BadRequestException(
        'Indique el lugar o cargue la ciudad en Paramétricas › Sueldos y planillas › Empleador.',
      );
    }
    const asunto =
      dto.asunto?.trim().toUpperCase() ||
      (tipoSancion === 'NINGUNA' ? 'LLAMADA DE ATENCIÓN' : 'LLAMADA DE ATENCIÓN Y SANCIÓN');
    const cargo = dto.cargo?.trim().toUpperCase() || (await this.cargo(persona.id));

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [LOCK_CORRELATIVO]);

      let numero: number;
      if (dto.numero) {
        const existe = await manager.findOne(Memorandum, { where: { gestion, numero: dto.numero } });
        if (existe) {
          throw new ConflictException(`Ya existe el memorándum ${existe.cite}.`);
        }
        numero = dto.numero;
      } else {
        numero = await this.siguienteNumero(manager, gestion);
      }
      // N° de llamada: lo da la cuenta de llamadas vigentes hasta la fecha.
      // Solo un memorándum en papel (historial previo al sistema) puede
      // traer el suyo, y nunca repetir uno vigente de la persona.
      const calculado = (await this.llamadasPrevias(persona.id, fecha, manager)) + 1;
      let numeroLlamada = calculado;
      if (dto.numero) {
        numeroLlamada = dto.numeroLlamada ?? calculado;
        const repetido = await manager.findOne(Memorandum, {
          where: { idPersona: persona.id, estado: 'EMITIDO', activo: true, numeroLlamada },
        });
        if (repetido) {
          throw new ConflictException(
            `La persona ya tiene la ${MemorandumService.ordinal(numeroLlamada)} llamada de atención vigente (${repetido.cite}).`,
          );
        }
      } else {
        const posterior = await this.posteriorA(persona.id, fecha, manager);
        if (posterior) throw new BadRequestException(this.mensajePosterior(posterior));
        if (dto.numeroLlamada != null && dto.numeroLlamada !== calculado) {
          throw new BadRequestException(
            `El N° de llamada debe ser ${calculado} (${MemorandumService.ordinal(calculado)}): la persona tiene ` +
              `${calculado - 1} llamada(s) de atención vigente(s) hasta esa fecha. Solo un memorándum ya emitido en papel puede indicar otro.`,
          );
        }
      }

      const memo = manager.create(Memorandum, {
        gestion,
        numero,
        cite: this.cite(numero, gestion),
        idPersona: persona.id,
        tratamiento: tratamientoPersona(persona),
        cargo,
        emisor,
        fecha,
        lugar: lugar.trim(),
        asunto,
        numeroLlamada,
        motivo: dto.motivo.trim().toUpperCase(),
        tipoSancion,
        diasSancion,
        importeSancion,
        estado: 'EMITIDO',
        observaciones: dto.observaciones?.trim().toUpperCase() || null,
        usuarioRegistro: user.usuario,
      });
      const guardado = await manager.save(memo);
      return manager.findOneOrFail(Memorandum, { where: { id: guardado.id }, relations: { persona: true } });
    });
  }

  // ------------------------------------------------------------------ consultas
  /**
   * Resumen de cada memorándum con el estado de su descuento:
   * SIN_SANCION | PENDIENTE (aún no entra a una boleta) | DESCONTADO.
   */
  private async conBoleta(memos: Memorandum[]) {
    const ids = [...new Set(memos.map((m) => m.idBoletaPago).filter(Boolean))] as string[];
    const boletas = ids.length
      ? await this.boletaRepository.find({ where: { id: In(ids) }, select: { id: true, numero: true, fechaPago: true } })
      : [];
    const porId = new Map(boletas.map((b) => [String(b.id), b]));
    return memos.map((m) => {
      const boleta = m.idBoletaPago ? porId.get(String(m.idBoletaPago)) : undefined;
      return {
        id: m.id,
        cite: m.cite,
        fecha: m.fecha,
        asunto: m.asunto,
        numeroLlamada: m.numeroLlamada,
        ordinal: MemorandumService.ordinal(m.numeroLlamada),
        motivo: m.motivo,
        tipoSancion: m.tipoSancion,
        sancion: MemorandumService.textoSancion(m),
        importeSancion: this.r2(m.importeSancion),
        estadoDescuento:
          !(Number(m.importeSancion) > 0) ? 'SIN_SANCION' : m.idBoletaPago ? 'DESCONTADO' : 'PENDIENTE',
        boleta: boleta ? { id: boleta.id, numero: boleta.numero, fechaPago: boleta.fechaPago } : null,
        estado: m.estado,
        motivoAnulacion: m.motivoAnulacion ?? null,
      };
    });
  }

  async listar(filtro: FiltroMemorandumDto) {
    const page = filtro.page ?? 1;
    const limit = filtro.limit ?? 10;

    const qb = this.memorandumRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.persona', 'persona')
      .where('m.activo = true');
    if (filtro.idPersona) qb.andWhere('m.idPersona = :idPersona', { idPersona: filtro.idPersona });
    if (filtro.gestion) qb.andWhere('m.gestion = :gestion', { gestion: filtro.gestion });
    if (filtro.estado) qb.andWhere('m.estado = :estado', { estado: filtro.estado });
    qb.orderBy('m.gestion', 'DESC').addOrderBy('m.numero', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [filas, total] = await qb.getManyAndCount();
    const resumenes = await this.conBoleta(filas);
    return {
      data: filas.map((m, i) => ({
        ...resumenes[i],
        persona: m.persona
          ? {
              id: m.persona.id,
              nombre: this.nombre(m.persona),
              nombreCorto: this.nombreCorto(m.persona),
              numeroDocumento: m.persona.numeroDocumento ?? null,
            }
          : null,
        emisor: m.emisor,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async buscarPorId(id: string): Promise<Memorandum> {
    const memo = await this.memorandumRepository.findOne({
      where: { id: String(id), activo: true },
      relations: { persona: true },
    });
    if (!memo) throw new NotFoundException('No se encontró el memorándum.');
    return memo;
  }

  async anular(id: string, dto: AnularMemorandumDto, user: Usuario): Promise<Memorandum> {
    const memo = await this.buscarPorId(id);
    if (memo.estado === 'ANULADO') {
      throw new BadRequestException(`El memorándum ${memo.cite} ya está anulado.`);
    }
    if (memo.idBoletaPago) {
      const boleta = await this.boletaRepository.findOne({ where: { id: memo.idBoletaPago } });
      throw new BadRequestException(
        `La sanción del memorándum ${memo.cite} ya se descontó en la boleta N° ${boleta?.numero ?? ''}: no se puede anular.`,
      );
    }
    // Anular una llamada con otras posteriores ya entregadas dejaría, por
    // ejemplo, una SEGUNDA sin PRIMERA: se anula desde la más reciente.
    const siguiente = await this.memorandumRepository.findOne({
      where: {
        idPersona: memo.idPersona,
        estado: 'EMITIDO',
        activo: true,
        numeroLlamada: MoreThan(memo.numeroLlamada),
      },
      order: { numeroLlamada: 'ASC' },
    });
    if (siguiente) {
      throw new BadRequestException(
        `No se puede anular la ${MemorandumService.ordinal(memo.numeroLlamada)} llamada (${memo.cite}): la persona ya tiene ` +
          `la ${MemorandumService.ordinal(siguiente.numeroLlamada)} (${siguiente.cite}), que se apoya en ella. Anule primero las posteriores.`,
      );
    }
    memo.estado = 'ANULADO';
    memo.motivoAnulacion = dto.motivo.trim().toUpperCase();
    memo.usuarioUltimaModificacion = user.usuario;
    return this.memorandumRepository.save(memo);
  }
}
