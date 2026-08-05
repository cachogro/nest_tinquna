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
import { PersonasPaginadasDto } from '../dto/persona-paginacion.dto';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { aplicarOrden } from 'src/common/utils/query-orden.util';
import { paginarConJoinMultiple } from 'src/common/utils/paginar-relacion-multiple.util';

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

  /**
   * `personaTipos` es una relación *-a-muchos (OneToMany): hacer
   * `leftJoinAndSelect` a `personaTipos` antes del `LIMIT/OFFSET` duplica la
   * fila de cualquier persona con más de un tipo asignado, descuadrando la
   * página y el orden. Se usa `paginarConJoinMultiple` (mismo fix aplicado a
   * `UsuarioService.listarPaginado`), que solo usa el join a `personaTipo`
   * para filtrar y luego hidrata las entidades completas por id.
   */
  async findAll(filtros: FiltrosPersonaDto): Promise<PersonasPaginadasDto> {
    const {
      page = 1,
      limit = 10,
      busqueda,
      numeroDocumento,
      idTipoPersona,
      activo,
      orderBy = 'id',
      orderDirection = 'DESC',
    } = filtros;

    const query = this.personaCiRepository
      .createQueryBuilder('persona')
      .leftJoin('persona.personaTipos', 'personaTipo');

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
    // Ordenamiento (solo columnas de persona, *-a-uno)
    //-----------------------------------------
    aplicarOrden(
      query,
      {
        id: 'persona.id',
        nombres: 'persona.nombres',
        numeroDocumento: 'persona.numeroDocumento',
      },
      orderBy,
      orderDirection,
    );
    //-----------------------------------------
    // Paginación segura (evita duplicados por el join a personaTipos)
    //-----------------------------------------
    const { data, total } = await paginarConJoinMultiple(
      query,
      'persona',
      this.personaCiRepository,
      page,
      limit,
      {
        personaTipos: { personaTipo: true },
        tipoDocumento: true,
        actorProductivoMinero: true,
      },
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
