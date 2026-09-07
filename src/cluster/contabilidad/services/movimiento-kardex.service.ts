import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { KardexSubcuenta } from 'src/cluster/parametricas/entities/kardex-subcuenta.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ValorizacionMineral } from 'src/cluster/comercio-interno/entities/valorizacion/valorizacion-mineral.entity';
import { Kardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { CreateMovimientoKardexDto } from '../dto/movimiento-kardex/create-movimiento-kardex.dto';

const RELACIONES = {
  subcuenta: true,
  formaPago: true,
  destinoGasto: true,
  cobrador: true,
  valorizacion: true,
} as const;

@Injectable()
export class MovimientoKardexService {
  constructor(
    @InjectRepository(MovimientoKardex, 'ci')
    private readonly movimientoRepository: Repository<MovimientoKardex>,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    @InjectRepository(KardexSubcuenta, 'ci')
    private readonly subcuentaRepository: Repository<KardexSubcuenta>,

    @InjectRepository(FormaPago, 'ci')
    private readonly formaPagoRepository: Repository<FormaPago>,

    @InjectRepository(DestinoGasto, 'ci')
    private readonly destinoGastoRepository: Repository<DestinoGasto>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(ValorizacionMineral, 'ci')
    private readonly valorizacionRepository: Repository<ValorizacionMineral>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private debeHaber(dto: CreateMovimientoKardexDto): { debe: number; haber: number } {
    const monto = this.r2(Number(dto.monto));
    return dto.tipo === 'DEBE'
      ? { debe: monto, haber: 0 }
      : { debe: 0, haber: monto };
  }

  private async obtenerKardexAbierto(idKardex: string): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({
      where: { id: idKardex },
    });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }
    if (kardex.estado === 'CERRADO') {
      throw new BadRequestException(
        `El kardex N° ${kardex.numero} está cerrado. Registrá el movimiento en el kardex abierto.`,
      );
    }
    return kardex;
  }

  private async validarReferenciasOpcionales(
    dto: CreateMovimientoKardexDto,
  ): Promise<void> {
    if (dto.idSubcuenta) {
      const existe = await this.subcuentaRepository.findOne({
        where: { id: dto.idSubcuenta },
      });
      if (!existe) {
        throw new NotFoundException('No existe la subcuenta seleccionada.');
      }
    }
    if (dto.idFormaPago) {
      const existe = await this.formaPagoRepository.findOne({
        where: { id: dto.idFormaPago },
      });
      if (!existe) {
        throw new NotFoundException('No existe la forma de pago seleccionada.');
      }
    }
    if (dto.idDestinoGasto) {
      const existe = await this.destinoGastoRepository.findOne({
        where: { id: dto.idDestinoGasto },
      });
      if (!existe) {
        throw new NotFoundException(
          'No existe el destino del gasto seleccionado.',
        );
      }
    }
    if (dto.idCobrador) {
      const existe = await this.personaRepository.findOne({
        where: { id: String(dto.idCobrador) },
      });
      if (!existe) {
        throw new NotFoundException('No existe la persona indicada como cobrador.');
      }
    }
    if (dto.idValorizacion) {
      const existe = await this.valorizacionRepository.findOne({
        where: { id: String(dto.idValorizacion) },
      });
      if (!existe) {
        throw new NotFoundException('No existe la valorización indicada.');
      }
    }
  }

  private async siguienteNumeroLinea(
    manager: EntityManager,
    idKardex: string,
  ): Promise<number> {
    const { max } = await manager
      .createQueryBuilder(MovimientoKardex, 'm')
      .select('COALESCE(MAX(m.numeroLinea), 0)', 'max')
      .where('m.idKardex = :id', { id: idKardex })
      .getRawOne<{ max: string }>();
    return Number(max ?? 0) + 1;
  }

  /** Recalcula el saldo corriente de todas las líneas activas de un kardex. */
  private async recalcularKardex(
    manager: EntityManager,
    idKardex: string,
  ): Promise<void> {
    const kardex = await manager.findOne(Kardex, { where: { id: idKardex } });
    if (!kardex) return;

    const movs = await manager.find(MovimientoKardex, {
      where: { idKardex, activo: true },
      order: { fecha: 'ASC', id: 'ASC' },
    });

    // A diferencia de la libreta de bancos, en el kardex el DEBE (anticipo
    // entregado) SUBE el saldo (la deuda del destinatario) y el HABER
    // (pago/descuento) lo BAJA: saldo = saldo_anterior + debe - haber
    // (misma fórmula que el Excel: =G_ant + E - F).
    let running = this.r2(Number(kardex.saldoInicial));
    for (const mov of movs) {
      running = this.r2(running + Number(mov.debe) - Number(mov.haber));
      if (this.r2(Number(mov.saldo)) !== running) {
        await manager.update(MovimientoKardex, mov.id, { saldo: running });
      }
    }

    await manager.update(Kardex, kardex.id, { saldoActual: running });
  }

  // ------------------------------------------------------------------ CRUD
  async guardar(
    dto: CreateMovimientoKardexDto,
    user: Usuario,
  ): Promise<MovimientoKardex> {
    return dto.id ? this.actualizar(dto, user) : this.crear(dto, user);
  }

  private async crear(
    dto: CreateMovimientoKardexDto,
    user: Usuario,
  ): Promise<MovimientoKardex> {
    const kardex = await this.obtenerKardexAbierto(dto.idKardex);
    await this.validarReferenciasOpcionales(dto);
    const { debe, haber } = this.debeHaber(dto);

    return this.dataSource.transaction(async (manager) => {
      const numeroLinea = await this.siguienteNumeroLinea(manager, kardex.id);

      const mov = await manager.save(
        manager.create(MovimientoKardex, {
          idKardex: kardex.id,
          numeroLinea,
          fecha: dto.fecha,
          nroComprobante: dto.nroComprobante?.trim() || null,
          detalle: dto.detalle.trim(),
          idSubcuenta: dto.idSubcuenta ?? null,
          idFormaPago: dto.idFormaPago ?? null,
          idDestinoGasto: dto.idDestinoGasto ?? null,
          idCobrador: dto.idCobrador ? String(dto.idCobrador) : null,
          idValorizacion: dto.idValorizacion ? String(dto.idValorizacion) : null,
          debe,
          haber,
          saldo: 0,
          usuarioRegistro: user.usuario,
        }),
      );

      await this.recalcularKardex(manager, kardex.id);

      return manager.findOne(MovimientoKardex, {
        where: { id: mov.id },
        relations: RELACIONES,
      });
    });
  }

  private async actualizar(
    dto: CreateMovimientoKardexDto,
    user: Usuario,
  ): Promise<MovimientoKardex> {
    const mov = await this.movimientoRepository.findOne({
      where: { id: String(dto.id) },
    });
    if (!mov) {
      throw new NotFoundException('No se encontró el movimiento solicitado.');
    }
    if (mov.idKardex !== dto.idKardex) {
      throw new BadRequestException(
        'No se puede cambiar el movimiento de kardex.',
      );
    }

    const kardex = await this.obtenerKardexAbierto(dto.idKardex);
    await this.validarReferenciasOpcionales(dto);
    const { debe, haber } = this.debeHaber(dto);

    return this.dataSource.transaction(async (manager) => {
      await manager.update(MovimientoKardex, mov.id, {
        fecha: dto.fecha,
        nroComprobante: dto.nroComprobante?.trim() || null,
        detalle: dto.detalle.trim(),
        idSubcuenta: dto.idSubcuenta ?? null,
        idFormaPago: dto.idFormaPago ?? null,
        idDestinoGasto: dto.idDestinoGasto ?? null,
        idCobrador: dto.idCobrador ? String(dto.idCobrador) : null,
        idValorizacion: dto.idValorizacion ? String(dto.idValorizacion) : null,
        debe,
        haber,
        usuarioUltimaModificacion: user.usuario,
      });

      await this.recalcularKardex(manager, kardex.id);

      return manager.findOne(MovimientoKardex, {
        where: { id: mov.id },
        relations: RELACIONES,
      });
    });
  }

  async cambiarEstado(
    id: string,
    activo: boolean,
    user: Usuario,
  ): Promise<MovimientoKardex> {
    const mov = await this.movimientoRepository.findOne({ where: { id } });
    if (!mov) {
      throw new NotFoundException('No se encontró el movimiento solicitado.');
    }
    await this.obtenerKardexAbierto(mov.idKardex);

    return this.dataSource.transaction(async (manager) => {
      await manager.update(MovimientoKardex, mov.id, {
        activo,
        usuarioUltimaModificacion: user.usuario,
      });
      await this.recalcularKardex(manager, mov.idKardex);
      return manager.findOne(MovimientoKardex, {
        where: { id: mov.id },
        relations: RELACIONES,
      });
    });
  }

  async listar(idKardex: string) {
    const kardex = await this.kardexRepository.findOne({
      where: { id: idKardex },
    });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }

    const movimientos = await this.movimientoRepository.find({
      where: { idKardex },
      relations: RELACIONES,
      order: { fecha: 'ASC', id: 'ASC' },
    });

    return { kardex, movimientos };
  }
}
