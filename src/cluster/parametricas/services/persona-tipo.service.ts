import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PersonaTipo } from '../entities/persona-tipo.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreatePersonaTipoDto } from '../dto/persona-tipo/create-persona-tipo.dto';
import { UpdatePersonaTipoDto } from '../dto/persona-tipo/update-persona-tipo.dto';

@Injectable()
export class PersonaTipoService {
  constructor(
    @InjectRepository(PersonaTipo, 'ci')
    private readonly personaTipoRepository: Repository<PersonaTipo>,
  ) {}

  /** El tipo de persona se guarda siempre en MAYÚSCULAS y sin espacios sobrantes. */
  private normalizar(valor?: string): string | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    const limpio = valor.trim().toUpperCase();
    return limpio.length > 0 ? limpio : undefined;
  }

  private async obtenerPersonaTipo(id: string | number): Promise<PersonaTipo> {
    const personaTipo = await this.personaTipoRepository.findOne({
      where: { id: Number(id) },
    });

    if (!personaTipo) {
      throw new NotFoundException(
        'No se encontró el tipo de persona solicitado.',
      );
    }

    return personaTipo;
  }

  /** Rechaza el nombre si ya lo usa otro tipo (sin contar `excluirId`). */
  private async validarNombreUnico(
    nombre: string,
    excluirId?: number,
  ): Promise<void> {
    const qb = this.personaTipoRepository
      .createQueryBuilder('personaTipo')
      .where('personaTipo.nombre = :nombre', { nombre });
    if (excluirId) {
      qb.andWhere('personaTipo.id <> :id', { id: excluirId });
    }
    if (await qb.getOne()) {
      throw new ConflictException(
        `Ya existe un tipo de persona con el nombre "${nombre}".`,
      );
    }
  }

  async create(
    createDto: CreatePersonaTipoDto,
    user: Usuario,
  ): Promise<PersonaTipo> {
    const nombre = this.normalizar(createDto.nombre);
    await this.validarNombreUnico(nombre);

    const personaTipo = this.personaTipoRepository.create({
      nombre,
      usuarioRegistro: user.usuario,
    });

    return await this.personaTipoRepository.save(personaTipo);
  }

  async update(
    updateDto: UpdatePersonaTipoDto,
    user: Usuario,
  ): Promise<PersonaTipo> {
    const id = Number(updateDto.id);
    const personaTipo = await this.obtenerPersonaTipo(id);

    const nombre = this.normalizar(updateDto.nombre);
    await this.validarNombreUnico(nombre, id);

    personaTipo.nombre = nombre;
    personaTipo.usuarioUltimaModificacion = user.usuario;

    return await this.personaTipoRepository.save(personaTipo);
  }

  async cambiarEstado(
    id: string,
    estado: boolean,
    user: Usuario,
  ): Promise<PersonaTipo> {
    const personaTipo = await this.obtenerPersonaTipo(id);

    personaTipo.activo = estado;
    personaTipo.usuarioUltimaModificacion = user.usuario;

    return await this.personaTipoRepository.save(personaTipo);
  }

  async findAll(): Promise<PersonaTipo[]> {
    return await this.personaTipoRepository.find({
      order: { nombre: 'ASC' },
    });
  }
}
