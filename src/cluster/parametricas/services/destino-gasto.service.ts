import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DestinoGasto } from '../entities/destino-gasto.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreateDestinoGastoDto } from '../dto/destino-gasto/create-destino-gasto.dto';
import { UpdateDestinoGastoDto } from '../dto/destino-gasto/update-destino-gasto.dto';

@Injectable()
export class DestinoGastoService {
  constructor(
    @InjectRepository(DestinoGasto, 'ci')
    private readonly destinoGastoRepository: Repository<DestinoGasto>,
  ) {}

  private async obtener(id: number): Promise<DestinoGasto> {
    const destino = await this.destinoGastoRepository.findOne({ where: { id } });
    if (!destino) {
      throw new NotFoundException('No se encontró el destino de gasto solicitado.');
    }
    return destino;
  }

  private async validarNombreUnico(nombre: string, excluirId?: number) {
    const query = this.destinoGastoRepository
      .createQueryBuilder('destino')
      .where('UPPER(destino.nombre) = UPPER(:nombre)', { nombre });
    if (excluirId) query.andWhere('destino.id <> :id', { id: excluirId });

    if (await query.getOne()) {
      throw new ConflictException(
        `Ya existe un destino de gasto con el nombre "${nombre}".`,
      );
    }
  }

  async create(dto: CreateDestinoGastoDto, user: Usuario): Promise<DestinoGasto> {
    const nombre = dto.nombre.trim();
    await this.validarNombreUnico(nombre);

    return await this.destinoGastoRepository.save(
      this.destinoGastoRepository.create({
        nombre,
        esEgreso: dto.esEgreso,
        usuarioRegistro: user.usuario,
      }),
    );
  }

  async update(dto: UpdateDestinoGastoDto, user: Usuario): Promise<DestinoGasto> {
    const destino = await this.obtener(dto.id);
    const nombre = dto.nombre.trim();
    await this.validarNombreUnico(nombre, destino.id);

    destino.nombre = nombre;
    destino.esEgreso = dto.esEgreso;
    destino.usuarioUltimaModificacion = user.usuario;
    return await this.destinoGastoRepository.save(destino);
  }

  async cambiarEstado(
    id: number,
    activo: boolean,
    user: Usuario,
  ): Promise<DestinoGasto> {
    const destino = await this.obtener(id);
    destino.activo = activo;
    destino.usuarioUltimaModificacion = user.usuario;
    return await this.destinoGastoRepository.save(destino);
  }

  /** Por defecto solo los activos (los usa el catálogo de caja/recibos). */
  async findAll(incluirInactivos = false): Promise<DestinoGasto[]> {
    return await this.destinoGastoRepository.find({
      where: incluirInactivos ? {} : { activo: true },
      order: { nombre: 'ASC' },
    });
  }
}
