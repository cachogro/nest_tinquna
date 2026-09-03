import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { ValorizacionMineral } from '../entities/valorizacion/valorizacion-mineral.entity';
import { CambiarEntregadoValorizacionMineralDto } from '../dto/valorizacion/cambiar-entregado-valorizacion-mineral.dto';

// ============================
// Estados de la valorización (parametrica.estado_valorizacion) desde los que
// se permite marcar el material como entregado.
// ============================
const ESTADO_VALORIZACION_PRE_VALORIZADO = 2;
const ESTADO_VALORIZACION_VALORIZADO = 3;
const ESTADOS_VALORIZACION_ENTREGABLES = [
  ESTADO_VALORIZACION_PRE_VALORIZADO,
  ESTADO_VALORIZACION_VALORIZADO,
];

/**
 * Servicio dedicado exclusivamente al campo `entregado` de la valorización,
 * que indica si el material ya salió del ingenio. Se mantiene aparte del
 * `ValorizacionMineralService` porque es una acción puntual (un botón de
 * alternado en el front) con sus propias reglas.
 */
@Injectable()
export class ValorizacionEntregadoService {
  constructor(
    @InjectRepository(ValorizacionMineral, 'ci')
    private readonly valorizacionRepository: Repository<ValorizacionMineral>,
  ) {}

  /**
   * Marca o desmarca si el material de la valorización ya salió del ingenio.
   *
   * Reglas:
   *  - La valorización debe existir y estar activa.
   *  - Solo se puede ACTIVAR (entregado = true) cuando la valorización está
   *    en estado PRE-VALORIZADO (2) o VALORIZADO (3).
   *  - Desactivar (entregado = false) se permite siempre, para poder
   *    revertir una marca hecha por error.
   *  - Al activar se guarda `fechaEntregado`; al desactivar se limpia.
   */
  async cambiarEntregado(
    id: string,
    dto: CambiarEntregadoValorizacionMineralDto,
    user: Usuario,
  ): Promise<ValorizacionMineral> {
    const valorizacion = await this.valorizacionRepository.findOne({
      where: { id },
    });

    if (!valorizacion) {
      throw new NotFoundException(
        `No existe una valorización con el id ${id}.`,
      );
    }

    if (!valorizacion.activo) {
      throw new BadRequestException('La valorización no está activa.');
    }

    if (
      dto.entregado &&
      !ESTADOS_VALORIZACION_ENTREGABLES.includes(
        Number(valorizacion.idEstadoValorizacion),
      )
    ) {
      throw new BadRequestException(
        'Solo se puede marcar como entregado cuando la valorización está en estado PRE-VALORIZADO o VALORIZADO.',
      );
    }

    // Sin cambios: se devuelve el estado actual sin tocar la BD.
    if (valorizacion.entregado === dto.entregado) {
      return this.obtenerValorizacion(id);
    }

    await this.valorizacionRepository.update(id, {
      entregado: dto.entregado,
      fechaEntregado: dto.entregado ? new Date() : null,
      usuarioUltimaModificacion: user.usuario,
    } as any);

    return this.obtenerValorizacion(id);
  }

  private async obtenerValorizacion(id: string): Promise<ValorizacionMineral> {
    return this.valorizacionRepository
      .createQueryBuilder('valorizacion')
      .leftJoinAndSelect('valorizacion.recepcionMineral', 'recepcion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')
      .leftJoinAndSelect(
        'valorizacion.estadoValorizacion',
        'estadoValorizacion',
      )
      .where('valorizacion.id = :id', { id })
      .getOne();
  }
}
