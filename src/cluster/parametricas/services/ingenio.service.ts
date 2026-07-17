import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ingenio } from '../entities/ingenio.entity';
import { Repository } from 'typeorm';
import { CreateIngenioDto } from '../dto/ingenios/create-ingenio.dto';
import { UpdateIngenioDto } from '../dto/ingenios/update-ingenio.dto';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltrosIngenioDto } from '../dto/ingenios/filtros-ingenio.dto';
import { IngeniosPaginadosDto } from '../dto/ingenios/ingenio-paginacion.dto';

@Injectable()
export class IngenioService {
  constructor(
    @InjectRepository(Ingenio, 'ci')
    private readonly ingenioRepository: Repository<Ingenio>,
  ) {}

  async create(
    createIngenioDto: CreateIngenioDto,
    user: Usuario,
  ): Promise<Ingenio> {
    const existe = await this.ingenioRepository
      .createQueryBuilder('ingenio')
      .where('LOWER(ingenio.nombre) = LOWER(:nombre)', {
        nombre: createIngenioDto.nombre.trim(),
      })
      .getOne();

    if (existe) {
      throw new ConflictException(
        `Ya existe un ingenio registrado con el nombre "${createIngenioDto.nombre}".`,
      );
    }

    const ingenio = this.ingenioRepository.create({
      nombre: createIngenioDto.nombre.trim(),
      direccion: createIngenioDto.direccion.trim(),
      telefono: createIngenioDto.telefono?.trim(),
      usuarioRegistro: user.usuario,
    });

    return await this.ingenioRepository.save(ingenio);
  }

  async update(
    updateIngenioDto: UpdateIngenioDto,
    user: Usuario,
  ): Promise<Ingenio> {
    const ingenio = await this.ingenioRepository.findOne({
      where: {
        id: updateIngenioDto.id.toLocaleString(),
        activo: true,
      },
    });

    if (!ingenio) {
      throw new NotFoundException('No se encontró el ingenio solicitado.');
    }

    const duplicado = await this.ingenioRepository
      .createQueryBuilder('ingenio')
      .where('LOWER(ingenio.nombre) = LOWER(:nombre)', {
        nombre: updateIngenioDto.nombre.trim(),
      })
      .andWhere('ingenio.id <> :id', {
        id: updateIngenioDto.id,
      })
      .getOne();

    if (duplicado) {
      throw new ConflictException(
        `Ya existe un ingenio registrado con el nombre "${updateIngenioDto.nombre}".`,
      );
    }

    ingenio.nombre = updateIngenioDto.nombre.trim();
    ingenio.direccion = updateIngenioDto.direccion.trim();
    ingenio.telefono = updateIngenioDto.telefono?.trim();
    ingenio.usuarioUltimaModificacion = user.usuario;

    return await this.ingenioRepository.save(ingenio);
  }

  // ACTIVAR O DESACTIVAR
  async cambiarEstadoIngenio(id: string, activo: boolean, user: Usuario) {
    const updateResult = await this.ingenioRepository.update(id, {
      usuarioUltimaModificacion: user.usuario,
      activo,
    });
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Ingenio con ID ${id} no fue encontrado`);
    }
    const ingenioActualizado = await this.ingenioRepository.findOne({
      where: { id },
    });

    if (!ingenioActualizado) {
      throw new NotFoundException(`Error al recuperar el usuario actualizado`);
    }
    return ingenioActualizado;
  }

  //-------------------------FILTROS-------------------------------

  async findAll(filtros: FiltrosIngenioDto): Promise<IngeniosPaginadosDto> {
    const {
      page = 1,
      limit = 10,
      busqueda,
      activo,
      orderBy = 'nombre',
      orderDirection = 'ASC',
    } = filtros;

    const query = this.ingenioRepository.createQueryBuilder('ingenio');
    //.orderBy('ingenio.nombre', 'ASC');

    //---------------------------------------------------------
    // Activo
    //---------------------------------------------------------

    if (activo !== undefined) {
      query.andWhere('ingenio.activo = :activo', { activo });
    }

    //---------------------------------------------------------
    // Búsqueda
    //---------------------------------------------------------

    if (busqueda) {
      query.andWhere(
        `(
        ingenio.nombre ILIKE :busqueda
        OR ingenio.direccion ILIKE :busqueda
        OR ingenio.telefono ILIKE :busqueda
      )`,
        {
          busqueda: `%${busqueda}%`,
        },
      );
    }
    //---------------------------------------------------------
    // Ordenamiento
    //---------------------------------------------------------

    query.orderBy(`ingenio.${orderBy}`, orderDirection);

    //---------------------------------------------------------
    // Paginación
    //---------------------------------------------------------
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
}
