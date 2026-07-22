import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, In, Repository } from 'typeorm';
import { PersonaTipo } from '../../parametricas/entities/persona-tipo.entity';
import { PersonaPersonaTipo } from '../entities/persona-persona-tipo.entity';
import { CreatePersonaCiDto } from '../dto/create-persona-ci.dto';
import { PersonaCi } from '../entities/persona-ci.entity';
import { UpdatePersonaCiDto } from '../dto/update-persona-ci.dto';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltrosPersonaDto } from '../dto/filtros-persona-ci.dto';
import { PersonasPaginadas } from '../models/interfaces/paginacion-persona';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';

@Injectable()
export class PersonaCiService {
  constructor(
    @InjectRepository(PersonaCi, 'ci')
    private readonly personaCiRepository: Repository<PersonaCi>,

    @InjectRepository(PersonaTipo, 'ci')
    private readonly personaTipoRepository: Repository<PersonaTipo>,

    @InjectRepository(ActorProductivoMinero, 'ci')
    private readonly actorProductivoMineroRepo: Repository<ActorProductivoMinero>,

    @InjectRepository(PersonaPersonaTipo, 'ci')
    private readonly personaPersonaTipoRepository: Repository<PersonaPersonaTipo>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // En persona-ci.service.ts

  //import { Usuario } from 'src/auth/entities/usuario.entity'; // ajusta ruta

  async create(
    createPersonaDto: CreatePersonaCiDto,
    user: Usuario, // nuevo parámetro
  ): Promise<PersonaCi> {
    const {
      tiposPersona,
      idTipoDocumento,
      numeroDocumento,
      idActorProductivoMinero, // extraer
      ...personaDto
    } = createPersonaDto;

    // Validar documento duplicado
    if (numeroDocumento) {
      const existeDocumento = await this.personaCiRepository.findOne({
        where: { numeroDocumento },
      });
      if (existeDocumento) {
        throw new ConflictException(
          `Ya existe una persona registrada con el documento ${numeroDocumento}.`,
        );
      }
    }

    // Validar que el actor exista si se envía
    if (idActorProductivoMinero) {
      const actor = await this.actorProductivoMineroRepo.findOne({
        where: { id: String(idActorProductivoMinero) },
      });
      if (!actor) {
        throw new NotFoundException(
          `Actor productivo minero con id ${idActorProductivoMinero} no existe.`,
        );
      }
    }

    // Validar tipos de persona
    const tipos = await this.personaTipoRepository.findBy({
      id: In(tiposPersona),
    });
    if (tipos.length !== tiposPersona.length) {
      throw new NotFoundException('Uno o más tipos de persona no existen.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Crear persona con auditoría
      const persona = queryRunner.manager.create(PersonaCi, {
        ...personaDto,
        idTipoDocumento,
        numeroDocumento,
        idActorProductivoMinero, // agregar
        usuarioRegistro: user.usuario, // auditoría
        fechaRegistro: new Date(),
      });

      const personaGuardada = await queryRunner.manager.save(persona);

      // Crear relaciones con tipos de persona
      const relaciones = tiposPersona.map((idTipoPersona) =>
        queryRunner.manager.create(PersonaPersonaTipo, {
          idPersona: personaGuardada.id,
          idPersonaTipo: idTipoPersona,
        }),
      );
      await queryRunner.manager.save(relaciones);

      await queryRunner.commitTransaction();

      // Retornar persona con relaciones
      return await this.personaCiRepository.findOne({
        where: { id: personaGuardada.id },
        relations: {
          personaTipos: { personaTipo: true },
          tipoDocumento: true,
          actorProductivoMinero: true, // incluir
        },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    updatePersonaDto: UpdatePersonaCiDto,
    user: Usuario, // nuevo parámetro
  ): Promise<PersonaCi> {
    const {
      id,
      tiposPersona,
      idTipoDocumento,
      numeroDocumento,
      idActorProductivoMinero, // extraer
      ...personaDto
    } = updatePersonaDto;

    const persona = await this.personaCiRepository.findOne({
      where: { id },
    });
    if (!persona) {
      throw new NotFoundException(`No existe una persona con el id ${id}.`);
    }

    // Validar documento duplicado (excluyendo el mismo)
    if (numeroDocumento) {
      const existeDocumento = await this.personaCiRepository.findOne({
        where: { numeroDocumento },
      });
      if (existeDocumento && existeDocumento.id !== id) {
        throw new ConflictException(
          `Ya existe una persona registrada con el documento ${numeroDocumento}.`,
        );
      }
    }

    // Validar actor existente
    if (idActorProductivoMinero) {
      const actor = await this.actorProductivoMineroRepo.findOne({
        where: { id: String(idActorProductivoMinero) },
      });
      if (!actor) {
        throw new NotFoundException(
          `Actor productivo minero con id ${idActorProductivoMinero} no existe.`,
        );
      }
    }

    // Validar tipos
    const tipos = await this.personaTipoRepository.findBy({
      id: In(tiposPersona),
    });
    if (tipos.length !== tiposPersona.length) {
      throw new NotFoundException('Uno o más tipos de persona no existen.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Actualizar datos básicos (incluyendo auditoría)
      await queryRunner.manager.update(PersonaCi, id, {
        ...personaDto,
        idTipoDocumento,
        numeroDocumento,
        idActorProductivoMinero, // actualizar
        usuarioUltimaModificacion: user.usuario,
        fechaUltimaModificacion: new Date(),
      });

      // Eliminar relaciones antiguas y crear nuevas
      await queryRunner.manager.delete(PersonaPersonaTipo, {
        idPersona: id,
      });
      const relaciones = tiposPersona.map((tipoId) =>
        queryRunner.manager.create(PersonaPersonaTipo, {
          idPersona: id,
          idPersonaTipo: tipoId,
        }),
      );
      await queryRunner.manager.save(relaciones);

      await queryRunner.commitTransaction();

      // Retornar persona actualizada
      return await this.personaCiRepository.findOne({
        where: { id },
        relations: {
          tipoDocumento: true,
          personaTipos: { personaTipo: true },
          actorProductivoMinero: true,
        },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  //-----------cambiar estado------------

  async cambiarEstadoUser(id: string, activo: boolean, user: Usuario) {
    const updateResult = await this.personaCiRepository.update(id, {
      usuarioUltimaModificacion: user.usuario,
      activo,
    });
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Usuario con ID ${id} no fue encontrado`);
    }
    const usuarioActualizado = await this.personaCiRepository.findOne({
      where: { id },
    });

    if (!usuarioActualizado) {
      throw new NotFoundException(`Error al recuperar el usuario actualizado`);
    }
    return usuarioActualizado;
  }

  async findAllPersonaCi(): Promise<PersonaCi[]> {
    const allpersonaCi = await this.personaCiRepository.find({
      order: {
        id: 'ASC',
      },
    });
    return allpersonaCi;
  }

  async findAll(filtros: FiltrosPersonaDto): Promise<PersonasPaginadas> {
    const {
      page = 1,
      limit = 10,
      busqueda,
      numeroDocumento,
      idTipoPersona,
      activo,
    } = filtros;

    const query = this.personaCiRepository
      .createQueryBuilder('persona')
      .leftJoinAndSelect('persona.personaTipos', 'personaTipo')
      .leftJoinAndSelect('personaTipo.personaTipo', 'tipoPersona')
      .leftJoinAndSelect('persona.tipoDocumento', 'tipoDocumento')
      .leftJoinAndSelect(
        'persona.actorProductivoMinero',
        'actorProductivoMinero',
      )
      .orderBy('persona.id', 'ASC');
    //-----------------------------------------
    // Activo
    //-----------------------------------------
    if (activo !== undefined) {
      query.andWhere('persona.activo = :activo', {
        activo,
      });
    }
    //-----------------------------------------
    // Documento
    //-----------------------------------------
    if (numeroDocumento) {
      query.andWhere('persona.numeroDocumento ILIKE :numeroDocumento', {
        numeroDocumento: `%${numeroDocumento}%`,
      });
    }
    //-----------------------------------------
    // Nombre completo
    //-----------------------------------------
    if (busqueda) {
      query.andWhere(
        `(
        persona.nombres ILIKE :busqueda
        OR persona.apellidoPaterno ILIKE :busqueda
        OR persona.apellidoMaterno ILIKE :busqueda
      )`,
        {
          busqueda: `%${busqueda}%`,
        },
      );
    }
    //-----------------------------------------
    // Tipo Persona
    //-----------------------------------------
    if (idTipoPersona) {
      query.andWhere('personaTipo.idPersonaTipo = :idTipoPersona', {
        idTipoPersona,
      });
    }
    //-----------------------------------------
    // Paginación
    //-----------------------------------------
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

  // async findAll(filtros: FiltrosPersonaDto): Promise<PersonasPaginadas> {
  //   const { page = 1, limit = 10, busqueda, numeroDocumento, idTipoPersona, activo } = filtros;
  //   const idsQuery = this.personaCiRepository
  //     .createQueryBuilder('persona')
  //     .select('persona.id', 'id')
  //     .orderBy('persona.id', 'ASC');

  //   if (activo !== undefined) {
  //     idsQuery.andWhere('persona.activo = :activo', { activo });
  //   }
  //   if (numeroDocumento) {
  //     idsQuery.andWhere('persona.numeroDocumento ILIKE :numeroDocumento', {
  //       numeroDocumento: `%${numeroDocumento}%`,
  //     });
  //   }
  //   if (busqueda) {
  //     idsQuery.andWhere(
  //       `(persona.nombres ILIKE :busqueda OR persona.apellidoPaterno ILIKE :busqueda OR persona.apellidoMaterno ILIKE :busqueda)`,
  //       { busqueda: `%${busqueda}%` },
  //     );
  //   }
  //   if (idTipoPersona) {
  //     idsQuery.andWhere((qb) => {
  //       const sub = qb
  //         .subQuery()
  //         .select('1')
  //         .from(PersonaPersonaTipo, 'pt')
  //         .where('pt.idPersona = persona.id')
  //         .andWhere('pt.idPersonaTipo = :idTipoPersona')
  //         .getQuery();
  //       return `EXISTS (${sub})`;
  //     }, { idTipoPersona });
  //   }

  //   const total = await idsQuery.getCount();
  //   const rows = await idsQuery.skip((page - 1) * limit).take(limit).getRawMany<{ id: string }>();
  //   const ids = rows.map((r) => r.id);

  //   if (ids.length === 0) {
  //     return { data: [], total, page, limit, totalPages: Math.ceil(total / limit) };
  //   }

  //   const data = await this.personaCiRepository.find({
  //     where: { id: In(ids) },
  //     relations: {
  //       personaTipos: {
  //         personaTipo: true,
  //       },
  //       tipoDocumento: true,
  //     },
  //   });

  //   const ordenado = ids.map((id) => data.find((p) => p.id === id)!);

  //   return { data: ordenado, total, page, limit, totalPages: Math.ceil(total / limit) };
  // }
}
