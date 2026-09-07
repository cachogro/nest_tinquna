import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { aplicarOrden } from 'src/common/utils/query-orden.util';
import { Kardex } from '../entities/kardex.entity';
import { AbrirKardexDto } from '../dto/kardex/abrir-kardex.dto';
import { FiltrosKardexDto } from '../dto/kardex/filtros-kardex.dto';
import { KardexPaginadoDto } from '../dto/kardex/kardex-paginado.dto';

@Injectable()
export class KardexService {
  constructor(
    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    @InjectRepository(ActorProductivoMinero, 'ci')
    private readonly actorRepository: Repository<ActorProductivoMinero>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private hoy(): string {
    return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private gestionActual(): number {
    return new Date(Date.now() - 4 * 60 * 60 * 1000).getUTCFullYear();
  }

  private normalizar(valor?: string): string | null {
    if (!valor) return null;
    const limpio = valor.trim().toUpperCase();
    return limpio.length > 0 ? limpio : null;
  }

  private relaciones = {
    actorProductivoMinero: true,
    persona: true,
    kardexAnterior: true,
  } as const;

  /** Filtro base por destinatario (actor o persona) según el tipo del DTO. */
  private wherePorDestinatario(dto: {
    tipo: 'ACTOR' | 'PERSONAL';
    idActorProductivoMinero?: string;
    idPersona?: string;
  }): FindOptionsWhere<Kardex> {
    return dto.tipo === 'ACTOR'
      ? { tipo: 'ACTOR', idActorProductivoMinero: dto.idActorProductivoMinero }
      : { tipo: 'PERSONAL', idPersona: dto.idPersona };
  }

  private async validarDestinatario(dto: AbrirKardexDto): Promise<void> {
    if (dto.tipo === 'ACTOR') {
      if (!dto.idActorProductivoMinero) {
        throw new BadRequestException(
          'Para un kardex de ACTOR se requiere idActorProductivoMinero.',
        );
      }
      if (dto.idPersona) {
        throw new BadRequestException(
          'Un kardex de ACTOR no lleva idPersona.',
        );
      }
      const actor = await this.actorRepository.findOne({
        where: { id: String(dto.idActorProductivoMinero) },
      });
      if (!actor) {
        throw new NotFoundException(
          'No se encontró el actor productivo minero.',
        );
      }
      if (!actor.activo) {
        throw new BadRequestException(
          'El actor productivo minero está inactivo.',
        );
      }
    } else {
      if (!dto.idPersona) {
        throw new BadRequestException(
          'Para un kardex PERSONAL se requiere idPersona.',
        );
      }
      if (dto.idActorProductivoMinero) {
        throw new BadRequestException(
          'Un kardex PERSONAL no lleva idActorProductivoMinero.',
        );
      }
      const persona = await this.personaRepository.findOne({
        where: { id: String(dto.idPersona) },
      });
      if (!persona) {
        throw new NotFoundException('No se encontró la persona.');
      }
      if (!persona.activo) {
        throw new BadRequestException('La persona está inactiva.');
      }
    }
  }

  // ------------------------------------------------------------------ CRUD
  async abrir(dto: AbrirKardexDto, user: Usuario): Promise<Kardex> {
    await this.validarDestinatario(dto);

    // El primer kardex se abre por acá; los siguientes se generan al cerrar.
    const yaExiste = await this.kardexRepository.findOne({
      where: this.wherePorDestinatario(dto),
    });
    if (yaExiste) {
      throw new ConflictException(
        dto.tipo === 'ACTOR'
          ? 'Este actor ya tiene un kardex. El siguiente (N° 2, N° 3...) se genera al cerrar el actual.'
          : 'Esta persona ya tiene un kardex. El siguiente se genera al cerrar el actual.',
      );
    }

    const saldoInicial = dto.saldoInicial ?? 0;

    const kardex = this.kardexRepository.create({
      tipo: dto.tipo,
      idActorProductivoMinero:
        dto.tipo === 'ACTOR' ? String(dto.idActorProductivoMinero) : null,
      idPersona: dto.tipo === 'PERSONAL' ? String(dto.idPersona) : null,
      numero: 1,
      gestion: dto.gestion ?? this.gestionActual(),
      descripcion: this.normalizar(dto.descripcion),
      estado: 'ABIERTO',
      saldoInicial,
      saldoActual: saldoInicial,
      saldoCierre: null,
      idKardexAnterior: null,
      fechaApertura: this.hoy(),
      usuarioRegistro: user.usuario,
    });

    const guardado = await this.kardexRepository.save(kardex);
    return this.kardexRepository.findOne({
      where: { id: guardado.id },
      relations: this.relaciones,
    });
  }

  async cerrar(
    id: string,
    user: Usuario,
  ): Promise<{ cerrado: Kardex; nuevo: Kardex }> {
    const kardex = await this.kardexRepository.findOne({ where: { id } });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }
    if (kardex.estado === 'CERRADO') {
      throw new BadRequestException(
        `El kardex N° ${kardex.numero} ya está cerrado.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const saldoCierre = kardex.saldoActual;

      await manager.update(Kardex, kardex.id, {
        estado: 'CERRADO',
        saldoCierre,
        fechaCierre: this.hoy(),
        cerradoPor: user.usuario,
        usuarioUltimaModificacion: user.usuario,
      });

      const nuevo = await manager.save(
        manager.create(Kardex, {
          tipo: kardex.tipo,
          idActorProductivoMinero: kardex.idActorProductivoMinero,
          idPersona: kardex.idPersona,
          numero: kardex.numero + 1,
          gestion: this.gestionActual(),
          descripcion: kardex.descripcion,
          estado: 'ABIERTO',
          saldoInicial: saldoCierre,
          saldoActual: saldoCierre,
          saldoCierre: null,
          idKardexAnterior: kardex.id,
          fechaApertura: this.hoy(),
          usuarioRegistro: user.usuario,
        }),
      );

      return {
        cerrado: await manager.findOne(Kardex, {
          where: { id: kardex.id },
          relations: this.relaciones,
        }),
        nuevo: await manager.findOne(Kardex, {
          where: { id: nuevo.id },
          relations: this.relaciones,
        }),
      };
    });
  }

  async reabrir(id: string, user: Usuario): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({ where: { id } });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }
    if (kardex.estado !== 'CERRADO') {
      throw new BadRequestException('El kardex no está cerrado.');
    }

    return this.dataSource.transaction(async (manager) => {
      const siguiente = await manager.findOne(Kardex, {
        where: { idKardexAnterior: kardex.id },
      });

      if (siguiente) {
        // Solo se puede reabrir si el kardex siguiente no tuvo actividad.
        const tuvoActividad =
          Number(siguiente.saldoActual) !== Number(siguiente.saldoInicial) ||
          siguiente.estado === 'CERRADO';
        if (tuvoActividad) {
          throw new BadRequestException(
            `No se puede reabrir: el kardex N° ${siguiente.numero} ya tiene movimientos. Reabrí y regularizá ese primero.`,
          );
        }
        await manager.delete(Kardex, siguiente.id);
      }

      await manager.update(Kardex, kardex.id, {
        estado: 'ABIERTO',
        saldoCierre: null,
        fechaCierre: null,
        cerradoPor: null,
        usuarioUltimaModificacion: user.usuario,
      });

      return manager.findOne(Kardex, {
        where: { id: kardex.id },
        relations: this.relaciones,
      });
    });
  }

  async cambiarEstado(
    id: string,
    activo: boolean,
    user: Usuario,
  ): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({ where: { id } });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }

    if (!activo) {
      if (kardex.idKardexAnterior || kardex.numero > 1) {
        throw new BadRequestException(
          'Solo se puede desactivar el primer kardex (N° 1) de un destinatario.',
        );
      }
      const siguiente = await this.kardexRepository.findOne({
        where: { idKardexAnterior: kardex.id },
      });
      if (siguiente) {
        throw new BadRequestException(
          'No se puede desactivar un kardex que ya tiene kardex posteriores.',
        );
      }
      if (Number(kardex.saldoActual) !== Number(kardex.saldoInicial)) {
        throw new BadRequestException(
          'No se puede desactivar un kardex con movimientos.',
        );
      }
    }

    kardex.activo = activo;
    kardex.usuarioUltimaModificacion = user.usuario;
    await this.kardexRepository.save(kardex);

    return this.kardexRepository.findOne({
      where: { id },
      relations: this.relaciones,
    });
  }

  /**
   * Bandeja paginada de kardex (mismo formato que persona_ci /
   * actor-productivo-minero). `actorProductivoMinero` y `persona` son
   * relaciones *-a-uno, así que el join no duplica filas: no hace falta
   * `paginarConJoinMultiple` acá.
   */
  async findAll(filtros: FiltrosKardexDto): Promise<KardexPaginadoDto> {
    const {
      page = 1,
      limit = 10,
      tipo,
      estado,
      gestion,
      idActorProductivoMinero,
      idPersona,
      busqueda,
      orderBy = 'fechaApertura',
      orderDirection = 'DESC',
    } = filtros;

    const query = this.kardexRepository
      .createQueryBuilder('kardex')
      .leftJoinAndSelect('kardex.actorProductivoMinero', 'actor')
      .leftJoinAndSelect('kardex.persona', 'persona');

    if (tipo) {
      query.andWhere('kardex.tipo = :tipo', { tipo });
    }
    if (estado) {
      query.andWhere('kardex.estado = :estado', { estado });
    }
    if (gestion) {
      query.andWhere('kardex.gestion = :gestion', { gestion });
    }
    if (idActorProductivoMinero) {
      query.andWhere('kardex.idActorProductivoMinero = :idActor', {
        idActor: idActorProductivoMinero,
      });
    }
    if (idPersona) {
      query.andWhere('kardex.idPersona = :idPersona', { idPersona });
    }
    if (busqueda) {
      query.andWhere(
        `(
          actor.nombre ILIKE :busqueda
          OR persona.nombres ILIKE :busqueda
          OR persona.apellidoPaterno ILIKE :busqueda
          OR persona.apellidoMaterno ILIKE :busqueda
          OR kardex.descripcion ILIKE :busqueda
        )`,
        { busqueda: `%${busqueda}%` },
      );
    }

    aplicarOrden(
      query,
      {
        id: 'kardex.id',
        numero: 'kardex.numero',
        gestion: 'kardex.gestion',
        estado: 'kardex.estado',
        fechaApertura: 'kardex.fechaApertura',
      },
      orderBy,
      orderDirection,
    );

    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async buscarPorId(id: string): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({
      where: { id },
      relations: this.relaciones,
    });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }
    return kardex;
  }
}
