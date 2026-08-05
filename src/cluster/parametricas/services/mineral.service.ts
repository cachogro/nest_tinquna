import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mineral } from '../entities/mineral.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreateMineralDto } from '../dto/mineral/create-mineral.dto';
import { UpdateMineralDto } from '../dto/mineral/update-mineral.dto';

@Injectable()
export class MineralService {
  constructor(
    @InjectRepository(Mineral, 'ci')
    private readonly mineralRepository: Repository<Mineral>,
  ) {}

  private async obtenerMineral(id: string): Promise<Mineral> {
    const mineral = await this.mineralRepository.findOne({
      where: {
        id,
      },
    });

    if (!mineral) {
      throw new NotFoundException('No se encontró el mineral solicitado.');
    }

    return mineral;
  }

  async create(
    createMineralDto: CreateMineralDto,
    user: Usuario,
  ): Promise<Mineral> {
    const existe = await this.mineralRepository
      .createQueryBuilder('mineral')
      .where('LOWER(mineral.descripcion) = LOWER(:descripcion)', {
        descripcion: createMineralDto.descripcion.trim(),
      })
      .getOne();

    if (existe) {
      throw new ConflictException(
        `Ya existe un mineral registrado con la descripción "${createMineralDto.descripcion}".`,
      );
    }

    const mineral = this.mineralRepository.create({
      descripcion: createMineralDto.descripcion.trim(),
      simbolo: createMineralDto.simbolo.trim(),
      unidadCotizacion: createMineralDto.unidadCotizacion.trim(),
      detalleMineral: createMineralDto.detalleMineral.trim(),
      factorConversion: createMineralDto.factorConversion,
      tipo: createMineralDto.tipo.trim(),
      usuarioRegistro: user.usuario,
    });

    return await this.mineralRepository.save(mineral);
  }

  async update(
    updateMineralDto: UpdateMineralDto,
    user: Usuario,
  ): Promise<Mineral> {
    const mineral = await this.obtenerMineral(
      updateMineralDto.id.toString(),
    );

    const duplicado = await this.mineralRepository
      .createQueryBuilder('mineral')
      .where('LOWER(mineral.descripcion) = LOWER(:descripcion)', {
        descripcion: updateMineralDto.descripcion.trim(),
      })
      .andWhere('mineral.id <> :id', {
        id: updateMineralDto.id,
      })
      .getOne();

    if (duplicado) {
      throw new ConflictException(
        `Ya existe un mineral registrado con la descripción "${updateMineralDto.descripcion}".`,
      );
    }
    mineral.descripcion = updateMineralDto.descripcion.trim();
    mineral.simbolo = updateMineralDto.simbolo.trim();
    mineral.unidadCotizacion = updateMineralDto.unidadCotizacion.trim();
    mineral.detalleMineral = updateMineralDto.detalleMineral.trim();
    mineral.factorConversion = updateMineralDto.factorConversion;
    mineral.tipo = updateMineralDto.tipo.trim();
    mineral.usuarioUltimaModificacion = user.usuario;
    return await this.mineralRepository.save(mineral);
  }

  async cambiarEstado(
    id: string,
    estado: boolean,
    user: Usuario,
  ): Promise<Mineral> {
    const mineral = await this.obtenerMineral(id);

    mineral.activo = estado;
    mineral.usuarioUltimaModificacion = user.usuario;

    return await this.mineralRepository.save(mineral);
  }

  async findAllMineral(): Promise<Mineral[]> {
    return await this.mineralRepository.find({
      order: {
        descripcion: 'ASC',
      },
    });
  }

  async findOneMineral(id: string): Promise<Mineral> {
    const mineral = await this.mineralRepository.findOne({
      where: {
        id,
        activo: true,
      },
    });

    if (!mineral) {
      throw new NotFoundException('No se encontró el mineral solicitado, o está desactivado, revice su configuracion.');
    }

    return mineral;
  }
}
