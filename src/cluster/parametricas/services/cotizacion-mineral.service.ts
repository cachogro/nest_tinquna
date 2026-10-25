import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CotizacionMineral } from '../entities/cotizacion-mineral.entity';
import { Mineral } from '../entities/mineral.entity';
import { CreateCotizacionMineralDto } from '../dto/cotizacion-mineral/create-cotizacion-mineral.dto';
import { UpdateCotizacionMineralDto } from '../dto/cotizacion-mineral/update-cotizacion-mineral.dto';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltrosCotizacionDto } from '../dto/cotizacion-mineral/filtros-cotizacion.dto';
import { CotizacionesPaginadasDto } from '../dto/cotizacion-mineral/cotizacion-paginacion.dto';
import { aplicarOrden } from 'src/common/utils/query-orden.util';
import { validarFechaMinimaPrecios } from '../precios-fecha-minima.util';

// Bolivia no tiene horario de verano: el offset respecto a UTC es siempre -04:00.
const OFFSET_BOLIVIA = '-04:00';

@Injectable()
export class CotizacionMineralService {
  constructor(
    @InjectRepository(CotizacionMineral, 'ci')
    private readonly cotizacionRepository: Repository<CotizacionMineral>,

    @InjectRepository(Mineral, 'ci')
    private readonly mineralRepository: Repository<Mineral>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createDto: CreateCotizacionMineralDto,
    user: Usuario,
  ): Promise<CotizacionMineral> {
    const mineral = await this.mineralRepository.findOne({
      where: {
        id: String(createDto.idMineral),
        activo: true,
      },
    });

    if (!mineral) {
      throw new NotFoundException(
        'No existe el mineral seleccionado o se encuentra inactivo.',
      );
    }

    // Por ahora (migración desde el 01/10/2026) no se controlan vigencias:
    // la cotización es "la del día" de su vigencia inicial (00:00 en Bolivia)
    // y aplica hasta que se registre otra con fecha posterior (ver
    // findVigenteByMineral). La vigencia final solo se guarda. Sin "desde",
    // es la de hoy.
    const ahora = new Date();
    const fechaVigenciaInicial = this.inicioDeDiaBolivia(
      createDto.fechaVigenciaInicial ?? this.diaBolivia(ahora),
    );
    const fechaVigenciaFinal = this.finDeDiaBolivia(
      createDto.fechaVigenciaFinal,
    );

    validarFechaMinimaPrecios(this.diaBolivia(fechaVigenciaInicial));
    if (fechaVigenciaInicial > ahora) {
      throw new BadRequestException(
        'La fecha de la cotización no puede ser posterior a hoy.',
      );
    }
    if (fechaVigenciaInicial > fechaVigenciaFinal) {
      throw new BadRequestException(
        'La fecha de vigencia inicial no puede ser posterior a la final.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock por mineral: serializa creaciones concurrentes para el mismo mineral,
      // incluso cuando aún no existe ninguna cotización previa que bloquear con FOR UPDATE.
      await queryRunner.manager.query('SELECT pg_advisory_xact_lock($1)', [
        createDto.idMineral,
      ]);

      const cotizacionesMineral = await queryRunner.manager
        .createQueryBuilder(CotizacionMineral, 'cotizacion')
        .setLock('pessimistic_write')
        .where('cotizacion.id_mineral = :idMineral', {
          idMineral: createDto.idMineral,
        })
        .orderBy('cotizacion.id', 'DESC')
        .getMany();

      // Una sola cotización activa por mineral y día (el de su vigencia
      // inicial). Los rangos sí pueden cruzarse: manda la de fecha mayor.
      const dia = this.diaBolivia(fechaVigenciaInicial);
      const mismoDia = cotizacionesMineral.find(
        (c) => c.activo && this.diaBolivia(c.fechaVigenciaInicial) === dia,
      );
      if (mismoDia) {
        throw new BadRequestException(
          `El mineral ya tiene una cotización registrada para el ${this.diaBoliviaTexto(dia)} (${mismoDia.cotizacionMineralDolares} USD). Edítala en vez de registrar otra.`,
        );
      }

      const cotizacion = queryRunner.manager.create(CotizacionMineral, {
        idMineral: createDto.idMineral,
        cotizacionMineralDolares: createDto.cotizacionMineralDolares,
        fechaVigenciaInicial,
        fechaVigenciaFinal,
        usuarioRegistro: user.usuario,
      });

      const guardada = await queryRunner.manager.save(cotizacion);
      await queryRunner.commitTransaction();
      return guardada;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<CotizacionMineral[]> {
    return await this.cotizacionRepository.find({
      relations: {
        mineral: true,
      },
      order: {
        fechaVigenciaInicial: 'DESC',
      },
    });
  }

  async findAllCotizacion(
    filtros: FiltrosCotizacionDto,
  ): Promise<CotizacionesPaginadasDto> {
    const {
      page = 1,
      limit = 10,
      busqueda,
      idMineral,
      vigente,
      activo,
      orderBy = 'id',
      orderDirection = 'DESC',
    } = filtros;

    const query = this.cotizacionRepository
      .createQueryBuilder('cotizacion')

      .leftJoinAndSelect('cotizacion.mineral', 'mineral');
    //----------------------------------------------------
    // Activo
    //----------------------------------------------------
    if (activo !== undefined) {
      query.andWhere('cotizacion.activo = :activo', { activo });
    }

    //----------------------------------------------------
    // Mineral
    //----------------------------------------------------

    if (idMineral) {
      query.andWhere('cotizacion.idMineral = :idMineral', { idMineral });
    }

    //----------------------------------------------------
    // Búsqueda
    //----------------------------------------------------

    if (busqueda) {
      query.andWhere(
        `(
          mineral.descripcion ILIKE :busqueda
          OR mineral.simbolo ILIKE :busqueda
          OR mineral.detalleMineral ILIKE :busqueda
      )`,
        {
          busqueda: `%${busqueda}%`,
        },
      );
    }

    //----------------------------------------------------
    // Vigente: se compara contra el instante exacto (NOW()) de la BD,
    // no contra la hora del servidor de aplicación, para evitar
    // desfases de reloj entre ambos.
    //----------------------------------------------------
    if (vigente !== undefined) {
      // Mismo criterio que findVigenteByMineral: una dada de baja no es vigente.
      if (vigente) {
        query.andWhere(
          'cotizacion.activo = true AND NOW() BETWEEN cotizacion.fechaVigenciaInicial AND cotizacion.fechaVigenciaFinal',
        );
      } else {
        query.andWhere(
          '(cotizacion.activo = false OR NOW() NOT BETWEEN cotizacion.fechaVigenciaInicial AND cotizacion.fechaVigenciaFinal)',
        );
      }
    }
    //----------------------------------------------------
    // Ordenamiento
    //----------------------------------------------------
    aplicarOrden(
      query,
      {
        id: 'cotizacion.id',
        mineral: 'mineral.descripcion',
        fechaVigenciaInicial: 'cotizacion.fechaVigenciaInicial',
        fechaVigenciaFinal: 'cotizacion.fechaVigenciaFinal',
      },
      orderBy,
      orderDirection,
    );
    //----------------------------------------------------
    // Paginación
    //----------------------------------------------------
    query.skip((page - 1) * limit);
    query.take(limit);
    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Cotización que aplica a un mineral en una fecha (YYYY-MM-DD, hora de
   * Bolivia; sin fecha, hoy): la activa más reciente cuya vigencia inicial
   * no pase del fin de ese día. La vigencia final no se controla por ahora
   * (migración): una cotización rige hasta que se registre otra posterior.
   */
  async findVigenteByMineral(
    idMineral: number,
    fecha?: string,
  ): Promise<CotizacionMineral> {
    const limite = fecha ? this.finDeDiaBolivia(fecha) : new Date();
    if (isNaN(limite.getTime())) {
      throw new BadRequestException('La fecha indicada no es válida.');
    }

    const cotizacion = await this.cotizacionRepository
      .createQueryBuilder('cotizacion')
      .leftJoinAndSelect('cotizacion.mineral', 'mineral')
      .where('cotizacion.idMineral = :idMineral', { idMineral })
      .andWhere('cotizacion.activo = true')
      .andWhere('cotizacion.fechaVigenciaInicial <= :limite', { limite })
      .orderBy('cotizacion.fechaVigenciaInicial', 'DESC')
      .addOrderBy('cotizacion.id', 'DESC')
      .getOne();

    if (!cotizacion) {
      throw new NotFoundException(
        fecha
          ? `El mineral no tiene una cotización registrada al ${this.diaBoliviaTexto(fecha)} o antes.`
          : 'El mineral no tiene una cotización registrada.',
      );
    }

    return cotizacion;
  }

  async findOne(id: number): Promise<CotizacionMineral> {
    const cotizacion = await this.cotizacionRepository.findOne({
      where: { id },
      relations: {
        mineral: true,
      },
    });

    if (!cotizacion) {
      throw new NotFoundException('No se encontró la cotización solicitada.');
    }

    return cotizacion;
  }

  async update(
    updateDto: UpdateCotizacionMineralDto,
    user: Usuario,
  ): Promise<CotizacionMineral> {
    const id = updateDto.id;
    if (!id) {
      throw new BadRequestException('Se requiere el ID para actualizar.');
    }
    const cotizacion = await this.cotizacionRepository.findOne({
      where: { id, activo: true },
    });
    if (!cotizacion) {
      throw new NotFoundException('No se encontró la cotización solicitada.');
    }

    // Sin control de vigencias por ahora (migración): se puede corregir
    // cualquier cotización activa, también las de días pasados.
    if (updateDto.fechaVigenciaFinal) {
      const nuevaFechaVigenciaFinal = this.finDeDiaBolivia(
        updateDto.fechaVigenciaFinal,
      );
      if (nuevaFechaVigenciaFinal < new Date(cotizacion.fechaVigenciaInicial)) {
        throw new BadRequestException(
          'La fecha de vigencia final no puede ser anterior a la inicial.',
        );
      }
      cotizacion.fechaVigenciaFinal = nuevaFechaVigenciaFinal;
    }

    cotizacion.usuarioUltimaModificacion = user.usuario;
    if (updateDto.cotizacionMineralDolares !== undefined) {
      cotizacion.cotizacionMineralDolares = updateDto.cotizacionMineralDolares;
    }
    return await this.cotizacionRepository.save(cotizacion);
  }

  /**
   * Convierte una fecha calendario ("YYYY-MM-DD" o Date) en el instante
   * correspondiente al fin de ese día (23:59:59.999) en hora de Bolivia (UTC-4 fijo).
   */
  private finDeDiaBolivia(fecha: string | Date): Date {
    const fechaStr =
      fecha instanceof Date
        ? fecha.toISOString().split('T')[0]
        : String(fecha).split('T')[0];

    return new Date(`${fechaStr}T23:59:59.999${OFFSET_BOLIVIA}`);
  }

  /** Día calendario en Bolivia ("YYYY-MM-DD") de un instante. */
  private diaBolivia(instante: Date | string): string {
    const bolivia = new Date(new Date(instante).getTime() - 4 * 3600 * 1000);
    return bolivia.toISOString().slice(0, 10);
  }

  /** "YYYY-MM-DD" -> "dd/mm/aaaa", para los mensajes. */
  private diaBoliviaTexto(dia: string): string {
    const [anio, mes, d] = String(dia).slice(0, 10).split('-');
    return `${d}/${mes}/${anio}`;
  }

  /** Inicio (00:00:00.000) de la fecha calendario en hora de Bolivia. */
  private inicioDeDiaBolivia(fecha: string | Date): Date {
    const fechaStr =
      fecha instanceof Date
        ? fecha.toISOString().split('T')[0]
        : String(fecha).split('T')[0];

    return new Date(`${fechaStr}T00:00:00.000${OFFSET_BOLIVIA}`);
  }
}
