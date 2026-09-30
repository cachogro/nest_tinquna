import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CodificacionLote } from '../entities/codificacion-lote.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreateCodificacionLoteDto } from '../dto/codificacion-lote/create-codificacion-lote.dto';
import { UpdateCodificacionLoteDto } from '../dto/codificacion-lote/update-codificacion-lote.dto';

@Injectable()
export class CodificacionLoteService {
  constructor(
    @InjectRepository(CodificacionLote, 'ci')
    private readonly codificacionLoteRepository: Repository<CodificacionLote>,
  ) {}

  private async obtener(id: string): Promise<CodificacionLote> {
    const codificacion = await this.codificacionLoteRepository.findOne({
      where: { id },
    });
    if (!codificacion) {
      throw new NotFoundException(
        'No se encontró la codificación de lote solicitada.',
      );
    }
    return codificacion;
  }

  private async validarCodigoUnico(codigo: string, excluirId?: string) {
    const query = this.codificacionLoteRepository
      .createQueryBuilder('cl')
      .where('UPPER(cl.codigo) = UPPER(:codigo)', { codigo });
    if (excluirId) query.andWhere('cl.id <> :id', { id: excluirId });

    if (await query.getOne()) {
      throw new ConflictException(
        `Ya existe una codificación de lote con el código "${codigo}".`,
      );
    }
  }

  async create(
    dto: CreateCodificacionLoteDto,
    user: Usuario,
  ): Promise<CodificacionLote> {
    const codigo = dto.codigo.trim().toUpperCase();
    await this.validarCodigoUnico(codigo);

    // ultimoCorrelativo arranca en 0: el primer promedio será CODIGO-0001.
    return await this.codificacionLoteRepository.save(
      this.codificacionLoteRepository.create({
        codigo,
        nombre: dto.nombre.trim(),
        usuarioRegistro: user.usuario,
      }),
    );
  }

  /**
   * Solo cambia código y nombre. El correlativo no se toca: lo administra el
   * alta de promedios. Los promedios ya creados conservan su código de lote.
   */
  async update(
    dto: UpdateCodificacionLoteDto,
    user: Usuario,
  ): Promise<CodificacionLote> {
    const codificacion = await this.obtener(dto.id.toString());
    const codigo = dto.codigo.trim().toUpperCase();
    await this.validarCodigoUnico(codigo, codificacion.id);

    codificacion.codigo = codigo;
    codificacion.nombre = dto.nombre.trim();
    codificacion.usuarioUltimaModificacion = user.usuario;
    return await this.codificacionLoteRepository.save(codificacion);
  }

  async cambiarEstado(
    id: string,
    activo: boolean,
    user: Usuario,
  ): Promise<CodificacionLote> {
    const codificacion = await this.obtener(id);
    codificacion.activo = activo;
    codificacion.usuarioUltimaModificacion = user.usuario;
    return await this.codificacionLoteRepository.save(codificacion);
  }

  async findAll(incluirInactivos = false): Promise<CodificacionLote[]> {
    return await this.codificacionLoteRepository.find({
      where: incluirInactivos ? {} : { activo: true },
      order: { id: 'ASC' },
    });
  }
}
