import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { Kardex } from '../entities/kardex.entity';
import { BienDacionPago } from '../entities/bien-dacion-pago.entity';
import { CreateBienDacionPagoDto } from '../dto/bien-dacion-pago/create-bien-dacion-pago.dto';
import { VenderBienDacionPagoDto } from '../dto/bien-dacion-pago/vender-bien-dacion-pago.dto';
import { DevolverBienDacionPagoDto } from '../dto/bien-dacion-pago/devolver-bien-dacion-pago.dto';
import { FiltroBienDacionPagoDto } from '../dto/bien-dacion-pago/filtro-bien-dacion-pago.dto';
import { KardexActividadService } from './kardex-actividad.service';
import { ReciboService } from './recibo.service';

const RELACIONES = {
  persona: true,
  actorProductivoMinero: true,
  recibo: true,
} as const;

/**
 * Bienes recibidos en dación de pago (ver `BienDacionPago`). Registrar o
 * devolver el bien no mueve kardex ni caja; venderlo sí: el monto amortiza
 * la deuda del dueño (HABER en su kardex) y entra a caja/banco con un recibo
 * de INGRESO.
 */
@Injectable()
export class BienDacionPagoService {
  constructor(
    @InjectRepository(BienDacionPago, 'ci')
    private readonly bienRepository: Repository<BienDacionPago>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(ActorProductivoMinero, 'ci')
    private readonly actorRepository: Repository<ActorProductivoMinero>,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    private readonly kardexActividadService: KardexActividadService,
    private readonly reciboService: ReciboService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private async validarDestinatarioConKardex(dto: {
    idPersona?: string;
    idActorProductivoMinero?: string;
  }): Promise<void> {
    if (!dto.idPersona && !dto.idActorProductivoMinero) {
      throw new BadRequestException(
        'Debe indicar idPersona o idActorProductivoMinero.',
      );
    }
    if (dto.idPersona && dto.idActorProductivoMinero) {
      throw new BadRequestException(
        'idPersona e idActorProductivoMinero son excluyentes.',
      );
    }

    if (dto.idPersona) {
      const persona = await this.personaRepository.findOne({
        where: { id: String(dto.idPersona) },
      });
      if (!persona) {
        throw new NotFoundException('No se encontró la persona.');
      }
      if (!persona.activo) {
        throw new BadRequestException('La persona está inactiva.');
      }
      const kardex = await this.kardexRepository.findOne({
        where: [
          { tipo: 'PERSONAL', idPersona: persona.id, estado: 'ABIERTO' },
          { tipo: 'ASOCIADO', idPersona: persona.id, estado: 'ABIERTO' },
        ],
      });
      if (!kardex) {
        throw new BadRequestException(
          'Esta persona no tiene un kardex ABIERTO. Abrí uno (POST /contabilidad/kardex) antes de registrar el bien.',
        );
      }
      await this.kardexActividadService.validarActivo(kardex);
      return;
    }

    const actor = await this.actorRepository.findOne({
      where: { id: String(dto.idActorProductivoMinero) },
    });
    if (!actor) {
      throw new NotFoundException('No se encontró el actor productivo minero.');
    }
    if (!actor.activo) {
      throw new BadRequestException('El actor productivo minero está inactivo.');
    }
    const kardex = await this.kardexRepository.findOne({
      where: {
        tipo: 'ACTOR',
        idActorProductivoMinero: actor.id,
        estado: 'ABIERTO',
      },
    });
    if (!kardex) {
      throw new BadRequestException(
        'Este actor productivo minero no tiene un kardex ABIERTO. Abrí uno (POST /contabilidad/kardex) antes de registrar el bien.',
      );
    }
    await this.kardexActividadService.validarActivo(kardex);
  }

  private async obtenerEnPosesion(id: string): Promise<BienDacionPago> {
    const bien = await this.bienRepository.findOne({ where: { id } });
    if (!bien) {
      throw new NotFoundException('No se encontró el bien.');
    }
    if (bien.estado !== 'EN_POSESION') {
      throw new BadRequestException(
        `Este bien ya está ${bien.estado === 'VENDIDO' ? 'VENDIDO' : 'DEVUELTO'}: no se puede modificar.`,
      );
    }
    return bien;
  }

  // ------------------------------------------------------------------ CRUD
  async registrar(
    dto: CreateBienDacionPagoDto,
    user: Usuario,
  ): Promise<BienDacionPago> {
    await this.validarDestinatarioConKardex(dto);

    const bien = this.bienRepository.create({
      idPersona: dto.idPersona ?? null,
      idActorProductivoMinero: dto.idActorProductivoMinero ?? null,
      fechaRecepcion: dto.fechaRecepcion,
      descripcion: dto.descripcion.trim(),
      valorReferencial: dto.valorReferencial ?? null,
      estado: 'EN_POSESION',
      observaciones: dto.observaciones?.trim() || null,
      usuarioRegistro: user.usuario,
    });
    const guardado = await this.bienRepository.save(bien);

    return this.buscarPorId(guardado.id);
  }

  /**
   * Vende el bien y con ese monto amortiza la deuda de su dueño original: en
   * una sola transacción genera un recibo de INGRESO (PROCESADO) con una
   * línea PERSONAL/ACTOR — HABER en su kardex abierto y entrada a la caja de
   * flujo (o a la libreta bancaria si se cobró por banco) — y marca el bien
   * VENDIDO con el vínculo al recibo y a la línea del kardex.
   */
  async vender(
    id: string,
    dto: VenderBienDacionPagoDto,
    user: Usuario,
  ): Promise<BienDacionPago> {
    const bien = await this.obtenerEnPosesion(id);
    // El kardex del dueño tiene que seguir abierto para recibir el HABER.
    await this.validarDestinatarioConKardex({
      idPersona: bien.idPersona ?? undefined,
      idActorProductivoMinero: bien.idActorProductivoMinero ?? undefined,
    });

    const monto = Math.round((Number(dto.montoVenta) + Number.EPSILON) * 100) / 100;
    const concepto = `VENTA DE BIEN EN DACIÓN DE PAGO: ${bien.descripcion}`.slice(0, 255);
    const contraparte = bien.idPersona
      ? { idPersona: bien.idPersona }
      : { idActorProductivoMinero: bien.idActorProductivoMinero! };

    await this.dataSource.transaction(async (manager) => {
      const recibo = await this.reciboService.generarEnTransaccion(
        manager,
        {
          tipo: 'INGRESO',
          fecha: dto.fechaVenta,
          montoTotal: monto,
          concepto,
          idFormaPago: dto.idFormaPago,
          idCuentaBancaria: dto.idCuentaBancaria,
          nroComprobante: dto.nroComprobante,
          idPersonaAutorizo: dto.idPersonaAutorizo,
          ...contraparte,
          detalles: [
            {
              destino: bien.idPersona ? 'PERSONAL' : 'ACTOR',
              ...contraparte,
              monto,
              idDestinoGasto: dto.idDestinoGasto,
            },
          ],
        },
        user,
      );

      await manager.update(BienDacionPago, bien.id, {
        estado: 'VENDIDO',
        fechaVenta: dto.fechaVenta,
        montoVenta: monto,
        idRecibo: recibo.id,
        idMovimientoKardex: recibo.detalles?.[0]?.idMovimientoKardex ?? null,
        observaciones: dto.observaciones?.trim() || bien.observaciones,
        usuarioUltimaModificacion: user.usuario,
      });
    });

    return this.buscarPorId(bien.id);
  }

  async devolver(
    id: string,
    dto: DevolverBienDacionPagoDto,
    user: Usuario,
  ): Promise<BienDacionPago> {
    const bien = await this.obtenerEnPosesion(id);

    await this.bienRepository.update(bien.id, {
      estado: 'DEVUELTO',
      fechaDevolucion: dto.fechaDevolucion,
      observaciones: dto.observaciones.trim(),
      usuarioUltimaModificacion: user.usuario,
    });

    return this.buscarPorId(bien.id);
  }

  async buscarPorId(id: string): Promise<BienDacionPago> {
    const bien = await this.bienRepository.findOne({
      where: { id },
      relations: RELACIONES,
    });
    if (!bien) {
      throw new NotFoundException('No se encontró el bien.');
    }
    return bien;
  }

  async listar(filtro: FiltroBienDacionPagoDto) {
    const page = filtro.page ?? 1;
    const limit = filtro.limit ?? 10;

    const qb = this.bienRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.persona', 'persona')
      .leftJoinAndSelect('b.actorProductivoMinero', 'actor')
      .leftJoinAndSelect('b.recibo', 'recibo');

    if (filtro.idPersona) {
      qb.andWhere('b.idPersona = :idPersona', { idPersona: filtro.idPersona });
    }
    if (filtro.idActorProductivoMinero) {
      qb.andWhere('b.idActorProductivoMinero = :idActor', {
        idActor: filtro.idActorProductivoMinero,
      });
    }
    if (filtro.estado) {
      qb.andWhere('b.estado = :estado', { estado: filtro.estado });
    }
    if (filtro.fechaDesde) {
      qb.andWhere('b.fechaRecepcion >= :desde', { desde: filtro.fechaDesde });
    }
    if (filtro.fechaHasta) {
      qb.andWhere('b.fechaRecepcion <= :hasta', { hasta: filtro.fechaHasta });
    }

    qb.orderBy('b.fechaRecepcion', 'DESC').addOrderBy('b.id', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
