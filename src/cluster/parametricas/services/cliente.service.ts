import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { Cliente } from '../entities/cliente.entity';
import { Municipio } from '../entities/municipio.entity';
import { TipoActorProductivoMinero } from '../entities/tipo-actor-productivo-minero.entity';
import { CreateClienteDto } from '../dto/cliente/create-cliente.dto';
import { UpdateClienteDto } from '../dto/cliente/update-cliente.dto';
import { FiltrosClienteDto } from '../dto/cliente/filtros-cliente.dto';
import { ClientesPaginadosDto } from '../dto/cliente/cliente-paginacion.dto';
import { aplicarOrden } from 'src/common/utils/query-orden.util';

@Injectable()
export class ClienteService {
  constructor(
    @InjectRepository(Cliente, 'ci')
    private readonly clienteRepository: Repository<Cliente>,

    @InjectRepository(Municipio, 'ci')
    private readonly municipioRepository: Repository<Municipio>,

    @InjectRepository(TipoActorProductivoMinero, 'ci')
    private readonly tipoActorRepository: Repository<TipoActorProductivoMinero>,
  ) {}

  /**
   * El "tipo" del cliente reutiliza el mismo catálogo que ActorProductivoMinero
   * (parametrica.tipo_actor_productivo_minero): es solo una etiqueta
   * (Empresa, Cooperativa, Comercializadora...), no implica que el cliente
   * sea también un proveedor.
   */
  private async validarTipoActor(idTipoActorProductivoMinero?: number): Promise<void> {
    if (!idTipoActorProductivoMinero) {
      return;
    }
    const tipo = await this.tipoActorRepository.findOne({
      where: { id: String(idTipoActorProductivoMinero), activo: true },
    });
    if (!tipo) {
      throw new NotFoundException(
        'El tipo de cliente seleccionado no existe o no está activo.',
      );
    }
  }

  async create(createClienteDto: CreateClienteDto, user: Usuario): Promise<Cliente> {
    const clienteExistente = await this.clienteRepository
      .createQueryBuilder('cliente')
      .where('LOWER(cliente.nombre) = LOWER(:nombre)', {
        nombre: createClienteDto.nombre.trim(),
      })
      .getOne();

    if (clienteExistente) {
      throw new ConflictException(
        `Ya existe un cliente registrado con el nombre "${createClienteDto.nombre}".`,
      );
    }

    if (createClienteDto.idMunicipio) {
      const municipio = await this.municipioRepository.findOne({
        where: { id: createClienteDto.idMunicipio, activo: true },
      });
      if (!municipio) {
        throw new NotFoundException(
          'El municipio seleccionado no existe o no está activo.',
        );
      }
    }

    await this.validarTipoActor(createClienteDto.idTipoActorProductivoMinero);

    const cliente = this.clienteRepository.create({
      nombre: createClienteDto.nombre.trim(),
      direccion: createClienteDto.direccion.trim(),
      telefono: createClienteDto.telefono?.trim(),
      idMunicipio: createClienteDto.idMunicipio,
      idTipoActorProductivoMinero: createClienteDto.idTipoActorProductivoMinero
        ? String(createClienteDto.idTipoActorProductivoMinero)
        : undefined,
      modalidadVenta: createClienteDto.modalidadVenta ?? 'COMERCIO_INTERNO',
      nit: createClienteDto.nit?.trim(),
      observaciones: createClienteDto.observaciones?.trim(),
      // Si el front no envía la fecha de inicio de operaciones, se toma la
      // fecha actual en hora de Bolivia (UTC-4 fijo, sin horario de verano).
      // Al migrar datos del Excel, mandar acá la fecha real.
      fechaInicioOperaciones:
        createClienteDto.fechaInicioOperaciones ??
        new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10),
      usuarioRegistro: user.usuario,
    });

    return await this.clienteRepository.save(cliente);
  }

  async update(updateClienteDto: UpdateClienteDto, user: Usuario): Promise<Cliente> {
    const cliente = await this.clienteRepository.findOne({
      where: { id: updateClienteDto.id.toString(), activo: true },
    });
    if (!cliente) {
      throw new NotFoundException('No se encontró el cliente solicitado.');
    }

    const clienteDuplicado = await this.clienteRepository
      .createQueryBuilder('cliente')
      .where('LOWER(cliente.nombre) = LOWER(:nombre)', {
        nombre: updateClienteDto.nombre.trim(),
      })
      .andWhere('cliente.id <> :id', { id: updateClienteDto.id })
      .getOne();

    if (clienteDuplicado) {
      throw new ConflictException(
        `Ya existe un cliente registrado con el nombre "${updateClienteDto.nombre}".`,
      );
    }

    if (updateClienteDto.idMunicipio) {
      const municipio = await this.municipioRepository.findOne({
        where: { id: updateClienteDto.idMunicipio, activo: true },
      });
      if (!municipio) {
        throw new NotFoundException(
          'El municipio seleccionado no existe o no está activo.',
        );
      }
    }

    await this.validarTipoActor(updateClienteDto.idTipoActorProductivoMinero);

    cliente.nombre = updateClienteDto.nombre.trim();
    cliente.direccion = updateClienteDto.direccion.trim();
    cliente.telefono = updateClienteDto.telefono?.trim();
    cliente.idMunicipio = updateClienteDto.idMunicipio;
    cliente.idTipoActorProductivoMinero = updateClienteDto.idTipoActorProductivoMinero
      ? String(updateClienteDto.idTipoActorProductivoMinero)
      : undefined;
    // Solo cambia si el front la envía; si no, se conserva la registrada.
    if (updateClienteDto.modalidadVenta) {
      cliente.modalidadVenta = updateClienteDto.modalidadVenta;
    }
    cliente.nit = updateClienteDto.nit?.trim();
    cliente.observaciones = updateClienteDto.observaciones?.trim();
    // Solo se actualiza si el front la envía; si llega vacía se conserva la
    // registrada al crear el cliente.
    if (updateClienteDto.fechaInicioOperaciones) {
      cliente.fechaInicioOperaciones = updateClienteDto.fechaInicioOperaciones;
    }
    cliente.usuarioUltimaModificacion = user.usuario;

    return await this.clienteRepository.save(cliente);
  }

  async cambiarEstado(id: string, activo: boolean, user: Usuario): Promise<Cliente> {
    const updateResult = await this.clienteRepository.update(id, {
      usuarioUltimaModificacion: user.usuario,
      activo,
    });
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Cliente con ID ${id} no fue encontrado.`);
    }
    const clienteActualizado = await this.clienteRepository.findOne({ where: { id } });
    if (!clienteActualizado) {
      throw new NotFoundException('Error al recuperar el cliente actualizado.');
    }
    return clienteActualizado;
  }

  async findAll(filtros: FiltrosClienteDto): Promise<ClientesPaginadosDto> {
    const {
      page = 1,
      limit = 10,
      busqueda,
      activo,
      idTipoActorProductivoMinero,
      orderBy = 'nombre',
      orderDirection = 'ASC',
    } = filtros;

    const query = this.clienteRepository
      .createQueryBuilder('cliente')
      .leftJoinAndSelect('cliente.tipoActorProductivoMinero', 'tipoActor');

    if (activo !== undefined) {
      query.andWhere('cliente.activo = :activo', { activo });
    }

    if (idTipoActorProductivoMinero) {
      query.andWhere(
        'cliente.idTipoActorProductivoMinero = :idTipoActorProductivoMinero',
        { idTipoActorProductivoMinero },
      );
    }

    if (busqueda) {
      query.andWhere(
        `(
          cliente.nombre ILIKE :busqueda
          OR cliente.direccion ILIKE :busqueda
          OR cliente.telefono ILIKE :busqueda
          OR cliente.nit ILIKE :busqueda
      )`,
        { busqueda: `%${busqueda}%` },
      );
    }

    aplicarOrden(
      query,
      {
        id: 'cliente.id',
        nombre: 'cliente.nombre',
        direccion: 'cliente.direccion',
        telefono: 'cliente.telefono',
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

  async findAllClientes(): Promise<Cliente[]> {
    return await this.clienteRepository.find({
      where: { activo: true },
      order: { id: 'ASC' },
    });
  }
}
