import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BitacoraAcceso } from '../entities/bitacora-acceso.entity';
import { TipoEventoBitacora } from '../enums/tipo-evento-bitacora';
import { FiltrosBitacoraAccesoDto } from '../dto/bitacora-acceso/filtros-bitacora-acceso.dto';
import { BitacoraAccesoPaginadaDto } from '../dto/bitacora-acceso/bitacora-acceso-paginado.dto';
import { aplicarOrden } from 'src/common/utils/query-orden.util';

export interface RegistrarEventoBitacora {
  idUsuario?: string;
  usuarioIngresado?: string;
  tipoEvento: TipoEventoBitacora;
  descripcion?: string;
  exitoso: boolean;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class BitacoraAccesoService {
  constructor(
    @InjectRepository(BitacoraAcceso, 'ci')
    private readonly bitacoraRepository: Repository<BitacoraAcceso>,
  ) {}

  /**
   * Registra un evento de autenticación (login, bloqueo, logout, etc.). No
   * lanza si falla: un problema al escribir la bitácora nunca debe tumbar el
   * login/logout real, solo se registra en el logger del proceso.
   */
  async registrar(evento: RegistrarEventoBitacora): Promise<void> {
    try {
      const registro = this.bitacoraRepository.create({
        idUsuario: evento.idUsuario,
        usuarioIngresado: evento.usuarioIngresado,
        tipoEvento: evento.tipoEvento,
        descripcion: evento.descripcion,
        exitoso: evento.exitoso,
        ip: evento.ip,
        userAgent: evento.userAgent,
      });
      await this.bitacoraRepository.save(registro);
    } catch {
      // Best-effort: no interrumpir el flujo de autenticación por un
      // problema al escribir la bitácora.
    }
  }

  async listarPaginado(
    filtros: FiltrosBitacoraAccesoDto,
  ): Promise<BitacoraAccesoPaginadaDto> {
    const {
      page = 1,
      limit = 10,
      busqueda,
      idUsuario,
      tipoEvento,
      exitoso,
      fechaDesde,
      fechaHasta,
      orderBy = 'fechaRegistro',
      orderDirection = 'DESC',
    } = filtros;

    const query = this.bitacoraRepository.createQueryBuilder('bitacora');

    if (busqueda) {
      query.andWhere('bitacora.usuarioIngresado ILIKE :busqueda', {
        busqueda: `%${busqueda}%`,
      });
    }

    if (idUsuario) {
      query.andWhere('bitacora.idUsuario = :idUsuario', { idUsuario });
    }

    if (tipoEvento) {
      query.andWhere('bitacora.tipoEvento = :tipoEvento', { tipoEvento });
    }

    if (exitoso !== undefined) {
      query.andWhere('bitacora.exitoso = :exitoso', { exitoso });
    }

    if (fechaDesde) {
      query.andWhere('bitacora.fechaRegistro >= :fechaDesde', { fechaDesde });
    }

    if (fechaHasta) {
      const fechaFin = new Date(fechaHasta);
      fechaFin.setHours(23, 59, 59, 999);
      query.andWhere('bitacora.fechaRegistro <= :fechaHasta', {
        fechaHasta: fechaFin,
      });
    }

    aplicarOrden(
      query,
      {
        fechaRegistro: 'bitacora.fechaRegistro',
        tipoEvento: 'bitacora.tipoEvento',
        usuarioIngresado: 'bitacora.usuarioIngresado',
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
}
