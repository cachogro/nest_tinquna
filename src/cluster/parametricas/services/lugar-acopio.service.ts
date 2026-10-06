import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LugarAcopio } from '../entities/lugar-acopio.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreateLugarAcopioDto } from '../dto/lugar-acopio/create-lugar-acopio.dto';
import { UpdateLugarAcopioDto } from '../dto/lugar-acopio/update-lugar-acopio.dto';

@Injectable()
export class LugarAcopioService {
  constructor(
    @InjectRepository(LugarAcopio, 'ci')
    private readonly lugarAcopioRepository: Repository<LugarAcopio>,
  ) {}

  private async obtenerLugarAcopio(id: number): Promise<LugarAcopio> {
    const lugarAcopio = await this.lugarAcopioRepository.findOne({
      where: {
        id,
      },
    });

    if (!lugarAcopio) {
      throw new NotFoundException(
        'No se encontró el lugar de acopio solicitado.',
      );
    }

    return lugarAcopio;
  }

  // El POST recibe "crear o actualizar" en un mismo body, así que el
  // ValidationPipe no aplica los decoradores del DTO: se valida aquí.
  private normalizarDescripcion(valor: unknown): string {
    const descripcion =
      typeof valor === 'string' ? valor.trim().toUpperCase() : '';

    if (descripcion.length < 2 || descripcion.length > 100) {
      throw new BadRequestException(
        'La descripción es obligatoria y debe tener entre 2 y 100 caracteres.',
      );
    }

    return descripcion;
  }

  // La recepción de mineral guarda la descripción como texto, por eso se
  // normaliza a mayúsculas y no se permiten descripciones repetidas.
  private async validarDuplicado(
    descripcion: string,
    idExcluido?: number,
  ): Promise<void> {
    const query = this.lugarAcopioRepository
      .createQueryBuilder('lugarAcopio')
      .where('LOWER(lugarAcopio.descripcion) = LOWER(:descripcion)', {
        descripcion,
      });

    if (idExcluido) {
      query.andWhere('lugarAcopio.id <> :id', { id: idExcluido });
    }

    if (await query.getOne()) {
      throw new ConflictException(
        `Ya existe un lugar de acopio registrado con la descripción "${descripcion}".`,
      );
    }
  }

  async create(
    createLugarAcopioDto: CreateLugarAcopioDto,
    user: Usuario,
  ): Promise<LugarAcopio> {
    const descripcion = this.normalizarDescripcion(
      createLugarAcopioDto.descripcion,
    );
    await this.validarDuplicado(descripcion);

    const lugarAcopio = this.lugarAcopioRepository.create({
      descripcion,
      usuarioRegistro: user.usuario,
    });

    return await this.lugarAcopioRepository.save(lugarAcopio);
  }

  async update(
    updateLugarAcopioDto: UpdateLugarAcopioDto,
    user: Usuario,
  ): Promise<LugarAcopio> {
    const descripcion = this.normalizarDescripcion(
      updateLugarAcopioDto.descripcion,
    );
    const lugarAcopio = await this.obtenerLugarAcopio(
      Number(updateLugarAcopioDto.id),
    );

    await this.validarDuplicado(descripcion, lugarAcopio.id);

    lugarAcopio.descripcion = descripcion;
    lugarAcopio.usuarioUltimaModificacion = user.usuario;

    return await this.lugarAcopioRepository.save(lugarAcopio);
  }

  async cambiarEstado(
    id: number,
    estado: boolean,
    user: Usuario,
  ): Promise<LugarAcopio> {
    const lugarAcopio = await this.obtenerLugarAcopio(id);

    lugarAcopio.activo = estado;
    lugarAcopio.usuarioUltimaModificacion = user.usuario;

    return await this.lugarAcopioRepository.save(lugarAcopio);
  }

  /** Activos e inactivos: es el listado del panel de paramétricas. */
  async findAllLugarAcopio(): Promise<LugarAcopio[]> {
    return await this.lugarAcopioRepository.find({
      order: {
        descripcion: 'ASC',
      },
    });
  }
}
