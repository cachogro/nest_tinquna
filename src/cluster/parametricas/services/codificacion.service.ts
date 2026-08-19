import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Codificacion } from '../entities/codificacion.entity';
import { Mineral } from '../entities/mineral.entity';
import { CreateCodificacionDto } from '../dto/codificacion/create-codificacion.dto';
import { UpdateCodificacionDto } from '../dto/codificacion/update-codificacion.dto';
import { Usuario } from 'src/security/entities/usuario.entity';

@Injectable()
export class CodificacionService {
  constructor(
    @InjectRepository(Codificacion, 'ci')
    private readonly codificacionRepository: Repository<Codificacion>,

    @InjectRepository(Mineral, 'ci')
    private readonly mineralRepository: Repository<Mineral>,
  ) {}

  async create2(
    createCodificacionDto: CreateCodificacionDto,
  ): Promise<Codificacion> {
    const { codigo, nombre, minerales } = createCodificacionDto;
    // Verifica que no exista el código
    const existeCodigo = await this.codificacionRepository.exists({
      where: { codigo },
    });

    if (existeCodigo) {
      throw new BadRequestException(
        `Ya existe una codificación con el código '${codigo}'.`,
      );
    }

    const mineralesEncontrados = await this.mineralRepository.find({
      where: {
        id: In(minerales),
      },
      select: {
        id: true,
        descripcion: true,
      },
    });

    // Valida que todos existan
    if (mineralesEncontrados.length !== minerales.length) {
      throw new BadRequestException(
        'Uno o más minerales seleccionados no existen.',
      );
    }

    const codificacion = this.codificacionRepository.create({
      codigo,
      nombre,
      minerales: mineralesEncontrados.map((mineral) => ({
        id: Number(mineral.id),
        descripcion: mineral.descripcion,
      })),
    });
    return await this.codificacionRepository.save(codificacion);
  }

  private async obtenerMineralesValidos(
    idsMinerales: number[],
  ): Promise<{ id: number; descripcion: string }[]> {
    const mineralesEncontrados = await this.mineralRepository.find({
      where: {
        id: In(idsMinerales),
      },
      select: {
        id: true,
        descripcion: true,
      },
    });

    if (mineralesEncontrados.length !== idsMinerales.length) {
      const idsEncontrados = mineralesEncontrados.map((m) => Number(m.id));

      const idsNoEncontrados = idsMinerales.filter(
        (id) => !idsEncontrados.includes(id),
      );

      throw new BadRequestException(
        `Los siguientes minerales no existen: ${idsNoEncontrados.join(', ')}.`,
      );
    }

    return mineralesEncontrados.map((mineral) => ({
      id: Number(mineral.id),
      descripcion: mineral.descripcion,
    }));
  }

  private async validarCodigo(codigo: string, id?: string): Promise<void> {
    const codificacion = await this.codificacionRepository.findOne({
      where: { codigo },
    });

    if (!codificacion) {
      return;
    }

    if (!id || codificacion.id !== id) {
      throw new BadRequestException(
        `Ya existe una codificación con el código '${codigo}'.`,
      );
    }
  }

  async create(
    createCodificacionDto: CreateCodificacionDto,
    user: Usuario,
  ): Promise<Codificacion> {
    const { codigo, nombre, minerales } = createCodificacionDto;

    await this.validarCodigo(codigo);

    const mineralesJson = await this.obtenerMineralesValidos(minerales);

    const codificacion = this.codificacionRepository.create({
      codigo,
      nombre,
      minerales: mineralesJson,
      usuarioRegistro: user.usuario,
    });

    return await this.codificacionRepository.save(codificacion);
  }

  async update(
    updateCodificacionDto: UpdateCodificacionDto,
    user: Usuario,
  ): Promise<Codificacion> {
    const { id, codigo, nombre, minerales } = updateCodificacionDto;
    const codificacion = await this.codificacionRepository.findOne({
      where: { id },
    });

    if (!codificacion) {
      throw new BadRequestException(
        `No existe una codificación con el ID '${id}'.`,
      );
    }

    await this.validarCodigo(codigo, id);

    codificacion.codigo = codigo;
    codificacion.nombre = nombre;
    codificacion.minerales = await this.obtenerMineralesValidos(minerales);
    codificacion.usuarioUltimaModificacion = user.usuario;

    return await this.codificacionRepository.save(codificacion);
  }

  async findAllCodificaciones(): Promise<Codificacion[]> {
    const codificaciones = await this.codificacionRepository.find({
      order: {
        id: 'ASC',
      },
    });
    return codificaciones;
  }
}
