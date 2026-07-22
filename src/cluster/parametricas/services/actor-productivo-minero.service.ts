import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { CreateActorProductivoMineroDto } from '../dto/ingenios/create-actor-productivo-minero.dto';

import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltrosActorProductivoMineroDto } from '../dto/ingenios/filtros-actor-productivo-minero.dto';
import { ActoresProductivosMinerosPaginadosDto } from '../dto/ingenios/actor-productivo-minero-paginacion.dto';
import { ActorProductivoMinero } from '../entities/actor-productivo-minero.entity';
import { TipoActorProductivoMinero } from '../entities/tipo-actor-productivo-minero.entity';
import { UpdateActorProductivoMineroDto } from '../dto/ingenios/update-actor-productivo-minero.dto';

@Injectable()
export class ActorProdMineroService {
  constructor(
    @InjectRepository(ActorProductivoMinero, 'ci')
    private readonly actorProdMineroRepository: Repository<ActorProductivoMinero>,

    @InjectRepository(TipoActorProductivoMinero, 'ci')
    private readonly tipoActorRepository: Repository<TipoActorProductivoMinero>,
  ) {}

  // async create(
  //   createIngenioDto: CreateIngenioDto,
  //   user: Usuario,
  // ): Promise<ActorProductivoMinero> {
  //   const existe = await this.actorProdMineroRepository
  //     .createQueryBuilder('ingenio')
  //     .where('LOWER(ingenio.nombre) = LOWER(:nombre)', {
  //       nombre: createIngenioDto.nombre.trim(),
  //     })
  //     .getOne();

  //   if (existe) {
  //     throw new ConflictException(
  //       `Ya existe un ingenio registrado con el nombre "${createIngenioDto.nombre}".`,
  //     );
  //   }

  //   const ingenio = this.actorProdMineroRepository.create({
  //     nombre: createIngenioDto.nombre.trim(),
  //     direccion: createIngenioDto.direccion.trim(),
  //     telefono: createIngenioDto.telefono?.trim(),
  //     usuarioRegistro: user.usuario,
  //   });

  //   return await this.actorProdMineroRepository.save(ingenio);
  // }

  async create(
    createActorDto: CreateActorProductivoMineroDto,
    user: Usuario,
  ): Promise<ActorProductivoMinero> {
    const tipo = await this.tipoActorRepository.findOne({
      where: {
        id: createActorDto.idTipoActorProductivoMinero.toString(),
        activo: true,
      },
    });

    if (!tipo) {
      throw new NotFoundException(
        'No existe el tipo de actor productivo minero seleccionado.',
      );
    }

    const actorExistente = await this.actorProdMineroRepository
      .createQueryBuilder('actor')
      .where('LOWER(actor.nombre) = LOWER(:nombre)', {
        nombre: createActorDto.nombre.trim(),
      })
      .getOne();

    if (actorExistente) {
      throw new ConflictException(
        `Ya existe un actor productivo minero registrado con el nombre "${createActorDto.nombre}".`,
      );
    }

    const actorProductivoMinero = this.actorProdMineroRepository.create({
      idTipoActorProductivoMinero:
        createActorDto.idTipoActorProductivoMinero.toString(),
      nombre: createActorDto.nombre.trim(),
      direccion: createActorDto.direccion.trim(),
      telefono: createActorDto.telefono?.trim(),
      usuarioRegistro: user.usuario,
    });

    return await this.actorProdMineroRepository.save(actorProductivoMinero);
  }

  async update(
    updateActorDto: UpdateActorProductivoMineroDto,
    user: Usuario,
  ): Promise<ActorProductivoMinero> {
    const actorProductivoMinero = await this.actorProdMineroRepository.findOne({
      where: {
        id: updateActorDto.id.toString(),
        activo: true,
      },
    });

    if (!actorProductivoMinero) {
      throw new NotFoundException(
        'No se encontró el actor productivo minero solicitado.',
      );
    }

    const tipo = await this.tipoActorRepository.findOne({
      where: {
        id: updateActorDto.idTipoActorProductivoMinero.toString(),
        activo: true,
      },
    });

    if (!tipo) {
      throw new NotFoundException(
        'No existe el tipo de actor productivo minero seleccionado.',
      );
    }

    const actorDuplicado = await this.actorProdMineroRepository
      .createQueryBuilder('actor')
      .where('LOWER(actor.nombre) = LOWER(:nombre)', {
        nombre: updateActorDto.nombre.trim(),
      })
      .andWhere('actor.id <> :id', {
        id: updateActorDto.id,
      })
      .getOne();

    if (actorDuplicado) {
      throw new ConflictException(
        `Ya existe un actor productivo minero registrado con el nombre "${updateActorDto.nombre}".`,
      );
    }

    actorProductivoMinero.idTipoActorProductivoMinero =
      updateActorDto.idTipoActorProductivoMinero.toString();

    actorProductivoMinero.nombre = updateActorDto.nombre.trim();
    actorProductivoMinero.direccion = updateActorDto.direccion.trim();
    actorProductivoMinero.telefono = updateActorDto.telefono?.trim();
    actorProductivoMinero.usuarioUltimaModificacion = user.usuario;

    return await this.actorProdMineroRepository.save(actorProductivoMinero);
  }

  // ACTIVAR O DESACTIVAR
  async cambiarEstadoIngenio(id: string, activo: boolean, user: Usuario) {
    const updateResult = await this.actorProdMineroRepository.update(id, {
      usuarioUltimaModificacion: user.usuario,
      activo,
    });
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Ingenio con ID ${id} no fue encontrado`);
    }
    const ingenioActualizado = await this.actorProdMineroRepository.findOne({
      where: { id },
    });

    if (!ingenioActualizado) {
      throw new NotFoundException(`Error al recuperar el usuario actualizado`);
    }
    return ingenioActualizado;
  }

  //-------------------------FILTROS-------------------------------

  async findAll(
    filtros: FiltrosActorProductivoMineroDto,
  ): Promise<ActoresProductivosMinerosPaginadosDto> {
    const {
      page = 1,
      limit = 10,
      busqueda,
      activo,
      idTipoActorProductivoMinero,
      orderBy = 'nombre',
      orderDirection = 'ASC',
    } = filtros;

    const query = this.actorProdMineroRepository
      .createQueryBuilder('actor')

      .leftJoinAndSelect('actor.tipoActorProductivoMinero', 'tipoActor');

    //---------------------------------------------------------
    // Activo
    //---------------------------------------------------------

    if (activo !== undefined) {
      query.andWhere('actor.activo = :activo', { activo });
    }

    //---------------------------------------------------------
    // Tipo Actor Productivo
    //---------------------------------------------------------

    if (idTipoActorProductivoMinero) {
      query.andWhere(
        'actor.idTipoActorProductivoMinero = :idTipoActorProductivoMinero',
        {
          idTipoActorProductivoMinero,
        },
      );
    }

    //---------------------------------------------------------
    // Búsqueda
    //---------------------------------------------------------

    if (busqueda) {
      query.andWhere(
        `(
          actor.nombre ILIKE :busqueda
          OR actor.direccion ILIKE :busqueda
          OR actor.telefono ILIKE :busqueda
          OR tipoActor.nombre ILIKE :busqueda
      )`,
        {
          busqueda: `%${busqueda}%`,
        },
      );
    }

    //---------------------------------------------------------
    // Ordenamiento
    //---------------------------------------------------------

    const columnasOrden = {
      id: 'actor.id',
      nombre: 'actor.nombre',
      direccion: 'actor.direccion',
      telefono: 'actor.telefono',
      tipoActorProductivoMinero: 'tipoActor.nombre',
    };

    query.orderBy(columnasOrden[orderBy], orderDirection);

    //---------------------------------------------------------
    // Paginación
    //---------------------------------------------------------

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

   async findAllActorPrdcMinero(): Promise<ActorProductivoMinero[]> {
    const allActorMiinero = await this.actorProdMineroRepository.find({
      where: { activo: true },
      order: { id: 'ASC' },
    });
    return allActorMiinero;
  }




}
