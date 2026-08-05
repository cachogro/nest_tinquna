import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { EntidadAporte } from '../entities/entidad-aporte.entity';
import { TipoEntidadAporte } from '../entities/tipo-entidad-aporte.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreateEntidadAporteDto } from '../dto/entidad-aporte/create-entidad-aporte.dto';
import { UpdateEntidadAporteDto } from '../dto/entidad-aporte/update-entidad-aporte.dto';

@Injectable()
export class EntidadAporteService {
  constructor(
    @InjectRepository(EntidadAporte, 'ci')
    private readonly entidadAporteRepository: Repository<EntidadAporte>,

    @InjectRepository(TipoEntidadAporte, 'ci')
    private readonly tipoEntidadAporteRepository: Repository<TipoEntidadAporte>,
  ) {}

  private async obtenerTipoEntidadAporte(
    idTipoEntidadAporte?: number,
  ): Promise<TipoEntidadAporte | undefined> {
    if (!idTipoEntidadAporte) {
      return undefined;
    }

    const tipoEntidadAporte = await this.tipoEntidadAporteRepository.findOne({
      where: {
        id: idTipoEntidadAporte,
      },
    });

    if (!tipoEntidadAporte) {
      throw new NotFoundException(
        'No existe el tipo de entidad de aporte seleccionado.',
      );
    }

    return tipoEntidadAporte;
  }

  private async obtenerEntidadAporte(id: number): Promise<EntidadAporte> {
    const entidadAporte = await this.entidadAporteRepository.findOne({
      where: {
        id,
      },
    });

    if (!entidadAporte) {
      throw new NotFoundException(
        'No se encontró la entidad de aporte solicitada.',
      );
    }

    return entidadAporte;
  }

  async create(
    createEntidadAporteDto: CreateEntidadAporteDto,
    user: Usuario,
  ): Promise<EntidadAporte> {
    const existe = await this.entidadAporteRepository
      .createQueryBuilder('entidadAporte')
      .where('LOWER(entidadAporte.descripcion) = LOWER(:descripcion)', {
        descripcion: createEntidadAporteDto.descripcion.trim(),
      })
      .getOne();

    if (existe) {
      throw new ConflictException(
        `Ya existe una entidad de aporte registrada con la descripción "${createEntidadAporteDto.descripcion}".`,
      );
    }

    const tipoEntidadAporte = await this.obtenerTipoEntidadAporte(
      createEntidadAporteDto.idTipoEntidadAporte,
    );

    const entidadAporte = this.entidadAporteRepository.create({
      descripcion: createEntidadAporteDto.descripcion.trim(),
      detalleAporte: createEntidadAporteDto.detalleAporte,
      idTipoEntidadAporte: tipoEntidadAporte?.id.toString(),
      usuarioRegistro: user.usuario,
    });

    return await this.entidadAporteRepository.save(entidadAporte);
  }

  async update(
    updateEntidadAporteDto: UpdateEntidadAporteDto,
    user: Usuario,
  ): Promise<EntidadAporte> {
    const entidadAporte = await this.obtenerEntidadAporte(
      updateEntidadAporteDto.id,
    );

    const duplicado = await this.entidadAporteRepository
      .createQueryBuilder('entidadAporte')
      .where('LOWER(entidadAporte.descripcion) = LOWER(:descripcion)', {
        descripcion: updateEntidadAporteDto.descripcion.trim(),
      })
      .andWhere('entidadAporte.id <> :id', {
        id: updateEntidadAporteDto.id,
      })
      .getOne();

    if (duplicado) {
      throw new ConflictException(
        `Ya existe una entidad de aporte registrada con la descripción "${updateEntidadAporteDto.descripcion}".`,
      );
    }

    const tipoEntidadAporte = await this.obtenerTipoEntidadAporte(
      updateEntidadAporteDto.idTipoEntidadAporte,
    );

    entidadAporte.descripcion = updateEntidadAporteDto.descripcion.trim();
    entidadAporte.detalleAporte = updateEntidadAporteDto.detalleAporte;
    entidadAporte.idTipoEntidadAporte = tipoEntidadAporte?.id.toString();
    entidadAporte.usuarioUltimaModificacion = user.usuario;

    return await this.entidadAporteRepository.save(entidadAporte);
  }

  async cambiarEstado(
    id: number,
    estado: boolean,
    user: Usuario,
  ): Promise<EntidadAporte> {
    const entidadAporte = await this.obtenerEntidadAporte(id);

    entidadAporte.activo = estado;
    entidadAporte.usuarioUltimaModificacion = user.usuario;

    return await this.entidadAporteRepository.save(entidadAporte);
  }

  async findAllEntidadAporte(): Promise<EntidadAporte[]> {
    return await this.entidadAporteRepository.find({
      where: {
        id: Not(60),
      },
      order: {
        descripcion: 'ASC',
      },
    });
  }

  
  async findAllEntidadAporte2(): Promise<EntidadAporte[]> {
    return await this.entidadAporteRepository.find({
      order: {
        descripcion: 'ASC',
      },
    });
  }

  async findAllTipoEntidadAporte(): Promise<TipoEntidadAporte[]> {
    return await this.tipoEntidadAporteRepository.find({
      order: {
        id: 'ASC',
      },
    });
  }
}
