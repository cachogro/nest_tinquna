import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Laboratorio } from '../entities/laboratorio.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreateLaboratorioDto } from '../dto/laboratorio/create-laboratorio.dto';
import { UpdateLaboratorioDto } from '../dto/laboratorio/update-laboratorio.dto';

@Injectable()
export class LaboratorioService {
  constructor(
    @InjectRepository(Laboratorio, 'ci')
    private readonly laboratorioRepository: Repository<Laboratorio>,
  ) {}

  private async obtenerLaboratorio(id: string): Promise<Laboratorio> {
    const laboratorio = await this.laboratorioRepository.findOne({
      where: {
        id,
      },
    });

    if (!laboratorio) {
      throw new NotFoundException('No se encontró el laboratorio solicitado.');
    }

    return laboratorio;
  }

  async create(
    createLaboratorioDto: CreateLaboratorioDto,
    user: Usuario,
  ): Promise<Laboratorio> {
    const existe = await this.laboratorioRepository
      .createQueryBuilder('laboratorio')
      .where('LOWER(laboratorio.nombre) = LOWER(:nombre)', {
        nombre: createLaboratorioDto.nombre.trim(),
      })
      .getOne();

    if (existe) {
      throw new ConflictException(
        `Ya existe un laboratorio registrado con el nombre "${createLaboratorioDto.nombre}".`,
      );
    }

    const laboratorio = this.laboratorioRepository.create({
      nombre: createLaboratorioDto.nombre.trim(),
      direccion: createLaboratorioDto.direccion?.trim(),
      telefono: createLaboratorioDto.telefono?.trim(),
      usuarioRegistro: user.usuario,
    });

    return await this.laboratorioRepository.save(laboratorio);
  }

  async update(
    updateLaboratorioDto: UpdateLaboratorioDto,
    user: Usuario,
  ): Promise<Laboratorio> {
    // const laboratorio = await this.laboratorioRepository.findOne({
    //   where: {
    //     id: updateLaboratorioDto.id.toString(),
    //     activo: true,
    //   },
    // });
    const laboratorio = await this.obtenerLaboratorio(
      updateLaboratorioDto.id.toString(),
    );

    if (!laboratorio) {
      throw new NotFoundException('No se encontró el laboratorio solicitado.');
    }

    const duplicado = await this.laboratorioRepository
      .createQueryBuilder('laboratorio')
      .where('LOWER(laboratorio.nombre) = LOWER(:nombre)', {
        nombre: updateLaboratorioDto.nombre.trim(),
      })
      .andWhere('laboratorio.id <> :id', {
        id: updateLaboratorioDto.id,
      })
      .getOne();

    if (duplicado) {
      throw new ConflictException(
        `Ya existe un laboratorio registrado con el nombre "${updateLaboratorioDto.nombre}".`,
      );
    }

    laboratorio.nombre = updateLaboratorioDto.nombre.trim();
    laboratorio.direccion = updateLaboratorioDto.direccion?.trim();
    laboratorio.telefono = updateLaboratorioDto.telefono?.trim();
    laboratorio.usuarioUltimaModificacion = user.usuario;

    return await this.laboratorioRepository.save(laboratorio);
  }

  async cambiarEstado(
    id: string,
    estado: boolean,
    user: Usuario,
  ): Promise<Laboratorio> {
    const laboratorio = await this.obtenerLaboratorio(id);
    if (!laboratorio) {
      throw new NotFoundException('No se encontró el laboratorio solicitado.');
    }

    laboratorio.activo = estado;
    laboratorio.usuarioUltimaModificacion = user.usuario;

    return await this.laboratorioRepository.save(laboratorio);
  }

  async findAllLaboratorio(): Promise<Laboratorio[]> {
    return await this.laboratorioRepository.find({
      // where: {
      //   activo: true,
      // },
      order: {
        nombre: 'ASC',
      },
    });
  }
}
