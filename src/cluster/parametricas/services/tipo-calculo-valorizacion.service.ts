import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoCalculoValorizacion } from '../entities/tipo-calculo-valorizacion.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreateTipoCalculoValorizacionDto } from '../dto/tipo-calculo-valorizacion/create-tipo-calculo-valorizacion.dto';
import { UpdateTipoCalculoValorizacionDto } from '../dto/tipo-calculo-valorizacion/update-tipo-calculo-valorizacion.dto';
import { TipoCalculoValorizacionAgrupadoDto } from '../dto/tipo-calculo-valorizacion/tipo-calculo-valorizacion-agrupado.dto';

@Injectable()
export class TipoCalculoValorizacionService {
  constructor(
    @InjectRepository(TipoCalculoValorizacion, 'ci')
    private readonly tipoCalculoRepository: Repository<TipoCalculoValorizacion>,
  ) {}

  private async obtenerTipoCalculo(
    id: number,
  ): Promise<TipoCalculoValorizacion> {
    const tipoCalculo = await this.tipoCalculoRepository.findOne({
      where: { id },
    });

    if (!tipoCalculo) {
      throw new NotFoundException(
        'No se encontró el tipo de cálculo solicitado.',
      );
    }

    return tipoCalculo;
  }

  async create(
    createDto: CreateTipoCalculoValorizacionDto,
    user: Usuario,
  ): Promise<TipoCalculoValorizacion> {
    const existe = await this.tipoCalculoRepository
      .createQueryBuilder('tipoCalculo')
      .where('LOWER(tipoCalculo.descripcion) = LOWER(:descripcion)', {
        descripcion: createDto.descripcion.trim(),
      })
      .getOne();

    if (existe) {
      throw new ConflictException(
        `Ya existe un tipo de cálculo registrado con la descripción "${createDto.descripcion}".`,
      );
    }

    const tipoCalculo = this.tipoCalculoRepository.create({
      descripcion: createDto.descripcion.trim(),
      idTipoCalculo: createDto.idTipoCalculo,
      extras: createDto.extras,
      usuarioRegistro: user.usuario,
    });

    return await this.tipoCalculoRepository.save(tipoCalculo);
  }

  async update(
    updateDto: UpdateTipoCalculoValorizacionDto,
    user: Usuario,
  ): Promise<TipoCalculoValorizacion> {
    const tipoCalculo = await this.obtenerTipoCalculo(updateDto.id);

    const duplicado = await this.tipoCalculoRepository
      .createQueryBuilder('tipoCalculo')
      .where('LOWER(tipoCalculo.descripcion) = LOWER(:descripcion)', {
        descripcion: updateDto.descripcion.trim(),
      })
      .andWhere('tipoCalculo.id <> :id', { id: updateDto.id })
      .getOne();

    if (duplicado) {
      throw new ConflictException(
        `Ya existe un tipo de cálculo registrado con la descripción "${updateDto.descripcion}".`,
      );
    }

    tipoCalculo.descripcion = updateDto.descripcion.trim();
    tipoCalculo.idTipoCalculo = updateDto.idTipoCalculo;
    tipoCalculo.extras = updateDto.extras;
    tipoCalculo.usuarioUltimaModificacion = user.usuario;

    return await this.tipoCalculoRepository.save(tipoCalculo);
  }

  async cambiarEstado(
    id: number,
    estado: boolean,
    user: Usuario,
  ): Promise<TipoCalculoValorizacion> {
    const tipoCalculo = await this.obtenerTipoCalculo(id);

    tipoCalculo.activo = estado;
    tipoCalculo.usuarioUltimaModificacion = user.usuario;

    return await this.tipoCalculoRepository.save(tipoCalculo);
  }

  /**
   * Lista el catálogo completo, agrupado por id_tipo_calculo
   * (1 = gastos de tratamiento, 2 = penalidades).
   */
  async findAllAgrupado(): Promise<TipoCalculoValorizacionAgrupadoDto> {
    const tipos = await this.tipoCalculoRepository.find({
      order: {
        idTipoCalculo: 'ASC',
        descripcion: 'ASC',
      },
    });

    return {
      gastos: tipos.filter((t) => t.idTipoCalculo === 1),
      penalidades: tipos.filter((t) => t.idTipoCalculo === 2),
      otros: tipos.filter((t) => t.idTipoCalculo === 3),
    };
  }
}
