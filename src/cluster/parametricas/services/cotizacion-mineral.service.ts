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

    // Vigencia inicial: instante exacto de creación.
    // Vigencia final: fin del día (23:59:59.999) de la fecha elegida, en hora de Bolivia.
    const ahora = new Date();
    const fechaVigenciaFinal = this.finDeDiaBolivia(
      createDto.fechaVigenciaFinal,
    );

    if (fechaVigenciaFinal < ahora) {
      throw new BadRequestException(
        'La fecha de vigencia final no puede ser menor a la fecha actual.',
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

      const vigente = cotizacionesMineral.find(
        (c) =>
          c.activo &&
          c.fechaVigenciaInicial <= ahora &&
          c.fechaVigenciaFinal >= ahora,
      );

      if (vigente) {
        throw new BadRequestException(
          'El mineral ya tiene una cotización vigente.',
        );
      }

      const cotizacion = queryRunner.manager.create(CotizacionMineral, {
        idMineral: createDto.idMineral,
        cotizacionMineralDolares: createDto.cotizacionMineralDolares,
        fechaVigenciaInicial: ahora,
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
      if (vigente) {
        query.andWhere(
          'NOW() BETWEEN cotizacion.fechaVigenciaInicial AND cotizacion.fechaVigenciaFinal',
        );
      } else {
        query.andWhere(
          'NOW() NOT BETWEEN cotizacion.fechaVigenciaInicial AND cotizacion.fechaVigenciaFinal',
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
   * Cotización vigente de un mineral: activa y cuyo rango de vigencia
   * contiene el instante exacto de la petición (NOW() de la BD).
   */
  async findVigenteByMineral(idMineral: number): Promise<CotizacionMineral> {
    const cotizacion = await this.cotizacionRepository
      .createQueryBuilder('cotizacion')
      .leftJoinAndSelect('cotizacion.mineral', 'mineral')
      .where('cotizacion.idMineral = :idMineral', { idMineral })
      .andWhere('cotizacion.activo = true')
      .andWhere(
        'NOW() BETWEEN cotizacion.fechaVigenciaInicial AND cotizacion.fechaVigenciaFinal',
      )
      .getOne();

    if (!cotizacion) {
      throw new NotFoundException(
        'El mineral no tiene una cotización vigente en este momento.',
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

    const ahora = new Date();
    if (new Date(cotizacion.fechaVigenciaFinal) < ahora) {
      throw new BadRequestException(
        'No es posible modificar una cotización que ya no se encuentra vigente.',
      );
    }

    if (updateDto.fechaVigenciaFinal) {
      const nuevaFechaVigenciaFinal = this.finDeDiaBolivia(
        updateDto.fechaVigenciaFinal,
      );
      if (nuevaFechaVigenciaFinal < ahora) {
        throw new BadRequestException(
          'La fecha de vigencia final no puede ser menor a la fecha actual.',
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
}
