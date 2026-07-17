import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CotizacionMineral } from '../entities/cotizacion-mineral.entity';
import { Mineral } from '../entities/mineral.entity';
import { CreateCotizacionMineralDto } from '../dto/cotizacion-mineral/create-cotizacion-mineral.dto';
import { UpdateCotizacionMineralDto } from '../dto/cotizacion-mineral/update-cotizacion-mineral.dto';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltrosCotizacionDto } from '../dto/cotizacion-mineral/filtros-cotizacion.dto';
import { CotizacionesPaginadasDto } from '../dto/cotizacion-mineral/cotizacion-paginacion.dto';

@Injectable()
export class CotizacionMineralService {
  constructor(
    @InjectRepository(CotizacionMineral, 'ci')
    private readonly cotizacionRepository: Repository<CotizacionMineral>,

    @InjectRepository(Mineral, 'ci')
    private readonly mineralRepository: Repository<Mineral>,
  ) {}

  async create(
    createDto: CreateCotizacionMineralDto,
    user: Usuario,
  ): Promise<CotizacionMineral> {
    const mineral = await this.mineralRepository.findOne({
      where: {
        id: createDto.idMineral.toLocaleString(),
        activo: true,
      },
    });

    if (!mineral) {
      throw new NotFoundException(
        'No existe el mineral seleccionado o se encuentra inactivo.',
      );
    }

    // --- OBTENER LAS FECHAS FORMATEADAS EN STRING ---
    const hoyStr = this.formatearFechaLocal(new Date());
    const fechaFinalStr = this.formatearFechaLocal(
      createDto.fechaVigenciaFinal,
    );

    // 1. Validar duplicidad usando comparación de strings en la consulta SQL
    const vigente = await this.cotizacionRepository
      .createQueryBuilder('cotizacion')
      .where('cotizacion.id_mineral = :idMineral', {
        idMineral: createDto.idMineral,
      })
      .andWhere('cotizacion.activo = true')
      // Mandamos hoyStr como texto. Postgres lo comparará limpiamente con sus columnas de fecha
      .andWhere(
        ':hoy BETWEEN cotizacion.fecha_vigencia_inicial AND cotizacion.fecha_vigencia_final',
        {
          hoy: hoyStr,
        },
      )
      .getOne();

    if (vigente) {
      throw new BadRequestException(
        'El mineral ya tiene una cotización vigente.',
      );
    }

    console.log('create ->', 'fechaFinal:', fechaFinalStr, 'hoy:', hoyStr);

    // 2. Validar que la nueva fecha de vigencia no sea menor a hoy
    if (fechaFinalStr < hoyStr) {
      throw new BadRequestException(
        'La fecha de vigencia final no puede ser menor a la fecha actual.',
      );
    }

    // 3. Crear el registro persistiendo las fechas mapeadas correctamente
    const cotizacion = this.cotizacionRepository.create({
      idMineral: createDto.idMineral,
      cotizacionMineralDolares: createDto.cotizacionMineralDolares,
      alicuotaExterna: createDto.alicuotaExterna ?? 0,
      alicuotaInterna: createDto.alicuotaInterna ?? 0,
      fechaVigenciaInicial: hoyStr as any, // TypeORM se encarga de transformarlo al tipo de columna
      fechaVigenciaFinal: createDto.fechaVigenciaFinal as any,
      usuarioRegistro: user.usuario,
    });

    return await this.cotizacionRepository.save(cotizacion);
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
    } = filtros;

    const query = this.cotizacionRepository
      .createQueryBuilder('cotizacion')

      .leftJoinAndSelect('cotizacion.mineral', 'mineral')
      .orderBy('cotizacion.id', 'DESC');
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
    // Vigente
    //----------------------------------------------------
    if (vigente !== undefined) {
      const hoy = new Date();

      if (vigente) {
        query.andWhere(
          ':hoy BETWEEN cotizacion.fechaVigenciaInicial AND cotizacion.fechaVigenciaFinal',
          { hoy },
        );
      } else {
        query.andWhere(
          ':hoy NOT BETWEEN cotizacion.fechaVigenciaInicial AND cotizacion.fechaVigenciaFinal',
          { hoy },
        );
      }
    }
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

    // --- USO DE LA FUNCIÓN UTILITARIA ---
    const hoyStr = this.formatearFechaLocal(new Date());
    const fechaFinalActualStr = this.formatearFechaLocal(
      cotizacion.fechaVigenciaFinal,
    );

    console.log(
      'Update -> fechaFinalActual =',
      fechaFinalActualStr,
      '| hoy =',
      hoyStr,
    );

    if (fechaFinalActualStr < hoyStr) {
      throw new BadRequestException(
        'No es posible modificar una cotización que ya no se encuentra vigente.',
      );
    }

    if (updateDto.fechaVigenciaFinal) {
      const nuevaFechaStr = this.formatearFechaLocal(
        updateDto.fechaVigenciaFinal,
      );

      console.log('Update -> nuevaFecha =', nuevaFechaStr, '| hoy =', hoyStr);

      if (nuevaFechaStr < hoyStr) {
        throw new BadRequestException(
          'La fecha de vigencia final no puede ser menor a la fecha actual.',
        );
      }

      cotizacion.fechaVigenciaFinal = updateDto.fechaVigenciaFinal as any;
    }
    // ------------------------------------

    cotizacion.usuarioUltimaModificacion = user.usuario;

    if (updateDto.cotizacionMineralDolares !== undefined) {
      cotizacion.cotizacionMineralDolares = updateDto.cotizacionMineralDolares;
    }
    if (updateDto.alicuotaExterna !== undefined) {
      cotizacion.alicuotaExterna = updateDto.alicuotaExterna;
    }
    if (updateDto.alicuotaInterna !== undefined) {
      cotizacion.alicuotaInterna = updateDto.alicuotaInterna;
    }

    return await this.cotizacionRepository.save(cotizacion);
  }

  formatearFechaLocal(fecha: Date | string | unknown): string {
    if (!fecha) return new Date().toLocaleDateString('sv-SE');

    if (fecha instanceof Date) {
      // Si es un objeto Date con horas, extraemos solo la fecha en UTC si viene de la BD
      // o usamos toLocaleDateString si es una fecha generada localmente.
      return fecha.toISOString().split('T')[0];
    }

    // Si es un string, nos aseguramos de limpiar si trae horas (ej: "2026-07-15T04:00:00")
    return String(fecha).split('T')[0];
  }
}
