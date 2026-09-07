import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Caja } from '../entities/caja.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreateCajaDto } from '../dto/caja/create-caja.dto';
import { UpdateCajaDto } from '../dto/caja/update-caja.dto';

@Injectable()
export class CajaService {
  constructor(
    @InjectRepository(Caja, 'ci')
    private readonly cajaRepository: Repository<Caja>,
  ) {}

  /** El nombre de la caja se guarda siempre en MAYÚSCULAS y sin espacios sobrantes. */
  private normalizar(valor?: string): string | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    const limpio = valor.trim().toUpperCase();
    return limpio.length > 0 ? limpio : undefined;
  }

  private async obtenerCaja(id: string | number): Promise<Caja> {
    const caja = await this.cajaRepository.findOne({
      where: { id: Number(id) },
    });

    if (!caja) {
      throw new NotFoundException('No se encontró la caja solicitada.');
    }

    return caja;
  }

  async create(createDto: CreateCajaDto, user: Usuario): Promise<Caja> {
    const nombre = this.normalizar(createDto.nombre);

    const existe = await this.cajaRepository
      .createQueryBuilder('caja')
      .where('UPPER(caja.nombre) = :nombre', { nombre })
      .getOne();
    if (existe) {
      throw new ConflictException(`Ya existe una caja con el nombre "${nombre}".`);
    }

    const caja = this.cajaRepository.create({
      nombre,
      saldoInicialBob: createDto.saldoInicialBob ?? 0,
      fechaSaldoInicialBob: createDto.fechaSaldoInicialBob,
      saldoInicialUsd: createDto.saldoInicialUsd ?? 0,
      fechaSaldoInicialUsd: createDto.fechaSaldoInicialUsd,
      usuarioRegistro: user.usuario,
    });

    return await this.cajaRepository.save(caja);
  }

  async update(updateDto: UpdateCajaDto, user: Usuario): Promise<Caja> {
    const id = Number(updateDto.id);
    const caja = await this.obtenerCaja(id);

    const nombre = this.normalizar(updateDto.nombre);

    const duplicado = await this.cajaRepository
      .createQueryBuilder('caja')
      .where('UPPER(caja.nombre) = :nombre', { nombre })
      .andWhere('caja.id <> :id', { id })
      .getOne();
    if (duplicado) {
      throw new ConflictException(`Ya existe una caja con el nombre "${nombre}".`);
    }

    caja.nombre = nombre;
    caja.saldoInicialBob = updateDto.saldoInicialBob ?? caja.saldoInicialBob;
    caja.fechaSaldoInicialBob =
      updateDto.fechaSaldoInicialBob ?? caja.fechaSaldoInicialBob;
    caja.saldoInicialUsd = updateDto.saldoInicialUsd ?? caja.saldoInicialUsd;
    caja.fechaSaldoInicialUsd =
      updateDto.fechaSaldoInicialUsd ?? caja.fechaSaldoInicialUsd;
    caja.usuarioUltimaModificacion = user.usuario;

    return await this.cajaRepository.save(caja);
  }

  async cambiarEstado(
    id: string,
    estado: boolean,
    user: Usuario,
  ): Promise<Caja> {
    const caja = await this.obtenerCaja(id);

    caja.activo = estado;
    caja.usuarioUltimaModificacion = user.usuario;

    return await this.cajaRepository.save(caja);
  }

  async findAll(): Promise<Caja[]> {
    return await this.cajaRepository.find({
      order: { nombre: 'ASC' },
    });
  }
}
