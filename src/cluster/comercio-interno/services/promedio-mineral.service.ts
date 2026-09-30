import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { ValorizacionMineral } from '../entities/valorizacion/valorizacion-mineral.entity';
import {
  LeyPromedioMineral,
  PromedioMineral,
} from '../entities/promedio/promedio-mineral.entity';
import { CodificacionLote } from 'src/cluster/parametricas/entities/codificacion-lote.entity';
import { PromedioMineralDetalle } from '../entities/promedio/promedio-mineral-detalle.entity';
import {
  CreatePromedioMineralDto,
  DisponiblesPromedioPaginadoDto,
  FiltrosDisponiblesPromedioDto,
  FiltrosPromedioMineralDto,
  PromediosMineralPaginadosDto,
  UpdatePromedioMineralDto,
} from '../dto/promedio/promedio-mineral.dto';

// Estados de la valorización (parametrica.estado_valorizacion)
const ESTADO_PRE_VALORIZADO = 2;
const ESTADO_VALORIZADO = 3;
const ESTADOS_PROMEDIABLES = [ESTADO_PRE_VALORIZADO, ESTADO_VALORIZADO];

@Injectable()
export class PromedioMineralService {
  constructor(
    @InjectRepository(PromedioMineral, 'ci')
    private readonly promedioRepository: Repository<PromedioMineral>,

    @InjectRepository(CodificacionLote, 'ci')
    private readonly codificacionLoteRepository: Repository<CodificacionLote>,

    @InjectRepository(ValorizacionMineral, 'ci')
    private readonly valorizacionRepository: Repository<ValorizacionMineral>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,

    private readonly configService: ConfigService,
  ) {}

  // ============================
  // Valorizaciones disponibles para seleccionar
  // ============================

  /**
   * Lista las valorizaciones PRE-VALORIZADO / VALORIZADO que todavía no
   * pertenecen a ningún promedio, con su peso y la ley de cada mineral, para
   * que el usuario elija cuáles conformarán el promedio.
   */
  async disponibles(
    filtros: FiltrosDisponiblesPromedioDto,
  ): Promise<DisponiblesPromedioPaginadoDto> {
    const {
      page = 1,
      limit = 10,
      busqueda,
      idCodificacion,
      codificacion,
      estado = 'ambas',
      orderBy = 'codigoOperacion',
      orderDirection = 'DESC',
    } = filtros;

    const estados =
      estado === 'pre_valorizadas'
        ? [ESTADO_PRE_VALORIZADO]
        : estado === 'valorizadas'
          ? [ESTADO_VALORIZADO]
          : ESTADOS_PROMEDIABLES;

    const query = this.valorizacionRepository
      .createQueryBuilder('valorizacion')
      .leftJoinAndSelect('valorizacion.recepcionMineral', 'recepcion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')
      .leftJoinAndSelect(
        'valorizacion.codificacionValorizacion',
        'codificacionValorizacion',
      )
      .leftJoinAndSelect('valorizacion.estadoValorizacion', 'estadoValorizacion')
      .leftJoinAndSelect(
        'valorizacion.detalles',
        'detalle',
        'detalle.activo = true',
      )
      .leftJoinAndSelect('detalle.mineral', 'mineral')
      .where('valorizacion.activo = true')
      .andWhere('valorizacion.idPromedioMineral IS NULL')
      .andWhere('valorizacion.idEstadoValorizacion IN (:...estados)', {
        estados,
      });

    // Se filtra por la codificación con la que se valorizó, no por la de la
    // recepción: una recepción ICC valorizada como BCL se promedia con BCL.
    if (idCodificacion) {
      query.andWhere(
        'COALESCE(valorizacion.idCodificacionValorizacion, recepcion.idCodificacion) = :idCodificacion',
        { idCodificacion },
      );
    }

    if (codificacion) {
      query.andWhere(
        'UPPER(COALESCE(codificacionValorizacion.codigo, codificacion.codigo)) = UPPER(:codificacion)',
        { codificacion },
      );
    }

    if (busqueda) {
      query.andWhere(
        `(persona.nombres ILIKE :busqueda
          OR persona.apellidoPaterno ILIKE :busqueda
          OR persona.apellidoMaterno ILIKE :busqueda
          OR recepcion.codigoOperacion ILIKE :busqueda)`,
        { busqueda: `%${busqueda}%` },
      );
    }

    const columnaOrden =
      orderBy === 'codigoOperacion'
        ? 'recepcion.codigoOperacion'
        : orderBy === 'peso'
          ? 'valorizacion.pesoNetoSecoKilogramos'
          : 'valorizacion.id';
    query.orderBy(columnaOrden, orderDirection === 'ASC' ? 'ASC' : 'DESC');

    // skip/take con joins one-to-many: TypeORM pagina por valorización.
    query.skip((page - 1) * limit).take(limit);

    const [valorizaciones, total] = await query.getManyAndCount();

    return {
      data: valorizaciones.map((v) => ({
        idValorizacion: v.id,
        codigoOperacion: v.recepcionMineral?.codigoOperacion ?? null,
        codificacion: v.codificacionEfectiva()?.codigo ?? null,
        codificacionRecepcion: v.recepcionMineral?.codificacion?.codigo ?? null,
        proveedor: this.nombreCompleto(v.recepcionMineral?.persona),
        numeroSacos: v.recepcionMineral?.numeroSacos ?? null,
        pesoKg: this.pesoDe(v),
        humedadPorcentaje: this.humedadDe(v),
        valorNetoVentaBolivianos: this.redondear(
          Number(v.totalValorNetoVentaBolivianos ?? 0),
        ),
        leyes: (v.detalles ?? []).map((d) => ({
          idMineral: d.idMineral,
          mineral: d.mineral?.simbolo ?? d.mineral?.descripcion ?? null,
          ley: Number(d.ley),
          unidad: d.leyUnidad ?? null,
        })),
        idEstadoValorizacion: v.idEstadoValorizacion ?? null,
        estadoValorizacion: v.estadoValorizacion?.nombre ?? null,
        entregado: v.entregado,
        fechaValorizacion: v.fechaValorizacion ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================
  // Crear
  // ============================

  async crear(
    dto: CreatePromedioMineralDto,
    user: Usuario,
  ): Promise<PromedioMineral> {
    const correlativo = await this.obtenerSiguienteCorrelativo();
    const codigo = this.generarCodigo(correlativo);

    const id = await this.dataSource.transaction(async (manager) => {
      const lote = await this.siguienteCodigoLote(
        manager,
        dto.idCodificacionLote,
        user,
      );

      const promedio = await manager.save(
        manager.create(PromedioMineral, {
          correlativo: correlativo.toString(),
          codigo,
          idCodificacionLote: dto.idCodificacionLote,
          correlativoLote: lote.correlativo.toString(),
          codigoLote: lote.codigo,
          descripcion: dto.descripcion,
          fecha: dto.fecha ?? this.hoy(),
          observaciones: dto.observaciones,
          usuarioRegistro: user.usuario,
        } as any),
      );

      await this.reclamarValorizaciones(
        manager,
        promedio.id,
        dto.idsValorizacion,
      );
      await this.recalcular(manager, promedio.id, dto.idsValorizacion, user);

      return promedio.id;
    });

    return this.buscarPorId(id);
  }

  // ============================
  // Codificaciones de lote
  // ============================

  async listarCodificacionesLote(): Promise<CodificacionLote[]> {
    return this.codificacionLoteRepository.find({
      where: { activo: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Toma el siguiente correlativo de la codificación indicada. El UPDATE ...
   * RETURNING bloquea la fila hasta el fin de la transacción, así dos promedios
   * simultáneos de la misma codificación nunca obtienen el mismo número.
   * Cada codificación (por id) lleva su propia cuenta.
   */
  private async siguienteCodigoLote(
    manager: EntityManager,
    idCodificacionLote: string,
    user: Usuario,
  ): Promise<{ correlativo: number; codigo: string }> {
    const filas: { codigo: string; ultimo_correlativo: string }[] =
      (
        await manager.query(
          `UPDATE parametrica.codificacion_lote
              SET ultimo_correlativo = ultimo_correlativo + 1,
                  usuario_ultima_modificacion = $2,
                  fecha_ultima_modificacion = NOW()
            WHERE id = $1 AND activo = true
        RETURNING codigo, ultimo_correlativo`,
          [idCodificacionLote, user.usuario],
        )
      )[0] ?? [];

    if (!filas.length) {
      throw new BadRequestException(
        `La codificación de lote ${idCodificacionLote} no existe o no está activa.`,
      );
    }

    const correlativo = Number(filas[0].ultimo_correlativo);
    const longitud = Number(this.configService.get('CORRELATIVO_LONGITUD', 4));
    return {
      correlativo,
      codigo: `${filas[0].codigo}-${correlativo.toString().padStart(longitud, '0')}`,
    };
  }

  // ============================
  // Actualizar
  // ============================

  async actualizar(
    id: string,
    dto: UpdatePromedioMineralDto,
    user: Usuario,
  ): Promise<PromedioMineral> {
    const promedio = await this.obtenerActivo(id);
    const cambiaLote =
      dto.idCodificacionLote !== undefined &&
      dto.idCodificacionLote !== promedio.idCodificacionLote;
    if (dto.idsValorizacion || cambiaLote) {
      await this.validarSinVentaVigente(promedio);
    }

    await this.dataSource.transaction(async (manager) => {
      const cambios: Partial<PromedioMineral> = {
        usuarioUltimaModificacion: user.usuario,
      };
      if (dto.descripcion !== undefined) cambios.descripcion = dto.descripcion;
      if (dto.fecha !== undefined) cambios.fecha = dto.fecha;
      if (dto.observaciones !== undefined) {
        cambios.observaciones = dto.observaciones;
      }
      if (
        dto.idCodificacionLote !== undefined &&
        dto.idCodificacionLote !== promedio.idCodificacionLote
      ) {
        const lote = await this.siguienteCodigoLote(
          manager,
          dto.idCodificacionLote,
          user,
        );
        cambios.idCodificacionLote = dto.idCodificacionLote;
        cambios.correlativoLote = lote.correlativo.toString();
        cambios.codigoLote = lote.codigo;
      }
      await manager.update(PromedioMineral, promedio.id, cambios as any);

      if (dto.idsValorizacion) {
        const actuales = (
          await manager.find(ValorizacionMineral, {
            where: { idPromedioMineral: promedio.id },
            select: { id: true },
          })
        ).map((v) => v.id);

        const nuevos = dto.idsValorizacion;
        const quitar = actuales.filter((x) => !nuevos.includes(x));
        const agregar = nuevos.filter((x) => !actuales.includes(x));

        if (quitar.length) {
          await this.liberarValorizaciones(manager, quitar, user);
        }
        if (agregar.length) {
          await this.reclamarValorizaciones(manager, promedio.id, agregar);
        }
        await this.recalcular(manager, promedio.id, nuevos, user);
      }
    });

    return this.buscarPorId(id);
  }

  // ============================
  // Anular
  // ============================

  /**
   * Anula el promedio y libera sus valorizaciones (bandera en null) para que
   * vuelvan a estar disponibles.
   */
  async anular(id: string, user: Usuario): Promise<PromedioMineral> {
    const promedio = await this.obtenerActivo(id);
    await this.validarSinVentaVigente(promedio);

    await this.dataSource.transaction(async (manager) => {
      const miembros = await manager.find(ValorizacionMineral, {
        where: { idPromedioMineral: promedio.id },
        select: { id: true },
      });
      if (miembros.length) {
        await this.liberarValorizaciones(
          manager,
          miembros.map((m) => m.id),
          user,
        );
      }
      await manager.update(PromedioMineral, promedio.id, {
        activo: false,
        usuarioUltimaModificacion: user.usuario,
      } as any);
    });

    return this.promedioRepository.findOneOrFail({ where: { id } });
  }

  // ============================
  // Consultas
  // ============================

  async buscarPorId(id: string): Promise<PromedioMineral> {
    const promedio = await this.promedioRepository
      .createQueryBuilder('promedio')
      .leftJoinAndSelect('promedio.codificacionLote', 'codificacionLote')
      .leftJoinAndSelect(
        'promedio.detalles',
        'detalle',
        'detalle.activo = true',
      )
      .leftJoinAndSelect('detalle.valorizacion', 'valorizacion')
      .leftJoinAndSelect('valorizacion.recepcionMineral', 'recepcion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')
      .leftJoinAndSelect(
        'valorizacion.codificacionValorizacion',
        'codificacionValorizacion',
      )
      .where('promedio.id = :id', { id })
      .getOne();

    if (!promedio) {
      throw new NotFoundException(`No existe un promedio con el id ${id}.`);
    }

    return promedio;
  }

  async findAll(
    filtros: FiltrosPromedioMineralDto,
  ): Promise<PromediosMineralPaginadosDto> {
    const {
      page = 1,
      limit = 10,
      busqueda,
      codigo,
      orderBy = 'id',
      orderDirection = 'DESC',
    } = filtros;

    const query = this.promedioRepository
      .createQueryBuilder('promedio')
      .leftJoinAndSelect('promedio.codificacionLote', 'codificacionLote')
      .where('promedio.activo = true');

    const texto = codigo ?? busqueda;
    if (texto) {
      query.andWhere(
        '(promedio.codigo ILIKE :texto OR promedio.codigoLote ILIKE :texto OR promedio.descripcion ILIKE :texto)',
        { texto: `%${texto}%` },
      );
    }

    query
      .orderBy(`promedio.${orderBy}`, orderDirection === 'ASC' ? 'ASC' : 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ============================
  // Internos
  // ============================

  /**
   * Marca las valorizaciones como parte del promedio. El UPDATE condicionado
   * a `id_promedio_mineral IS NULL` evita que dos promedios tomen la misma
   * valorización aunque se creen al mismo tiempo.
   */
  private async reclamarValorizaciones(
    manager: EntityManager,
    idPromedio: string,
    ids: string[],
  ): Promise<void> {
    const resultado = await manager
      .createQueryBuilder()
      .update(ValorizacionMineral)
      .set({ idPromedioMineral: idPromedio })
      .where('id IN (:...ids)', { ids })
      .andWhere('activo = true')
      .andWhere('id_promedio_mineral IS NULL')
      .andWhere('id_estado_valorizacion IN (:...estados)', {
        estados: ESTADOS_PROMEDIABLES,
      })
      .execute();

    if ((resultado.affected ?? 0) !== ids.length) {
      // Se revierte todo; se informa cuáles fallaron para que el front lo muestre.
      const ok = await manager.find(ValorizacionMineral, {
        where: { id: In(ids), idPromedioMineral: idPromedio },
        select: { id: true },
      });
      const okIds = new Set(ok.map((v) => v.id));
      const fallidas = ids.filter((x) => !okIds.has(x));
      throw new BadRequestException(
        `Las valorizaciones [${fallidas.join(', ')}] no existen, no están activas, ` +
          'no están en PRE-VALORIZADO/VALORIZADO o ya forman parte de otro promedio.',
      );
    }
  }

  private async liberarValorizaciones(
    manager: EntityManager,
    ids: string[],
    user: Usuario,
  ): Promise<void> {
    await manager.update(ValorizacionMineral, { id: In(ids) }, {
      idPromedioMineral: null,
      usuarioUltimaModificacion: user.usuario,
    } as any);
  }

  /**
   * Reconstruye detalle, leyes y totales del promedio a partir del estado
   * actual de las valorizaciones. La ley de cada mineral es la ponderada por
   * peso, SUM(ley*peso)/SUM(peso), tomando solo las valorizaciones que tienen
   * ese mineral.
   */
  private async recalcular(
    manager: EntityManager,
    idPromedio: string,
    idsValorizacion: string[],
    user: Usuario,
  ): Promise<void> {
    const valorizaciones = await manager
      .createQueryBuilder(ValorizacionMineral, 'valorizacion')
      .leftJoinAndSelect('valorizacion.recepcionMineral', 'recepcion')
      .leftJoinAndSelect(
        'valorizacion.detalles',
        'detalle',
        'detalle.activo = true',
      )
      .leftJoinAndSelect('detalle.mineral', 'mineral')
      .where('valorizacion.id IN (:...ids)', { ids: idsValorizacion })
      .getMany();

    await manager.delete(PromedioMineralDetalle, {
      idPromedioMineral: idPromedio,
    });

    let pesoTotal = 0;
    let efectivoInvertido = 0;
    let sacosTotal = 0;
    let sumaHumedadPeso = 0;
    let pesoConHumedad = 0;
    const acumulado = new Map<
      string,
      {
        sumaLeyPeso: number;
        sumaPeso: number;
        unidad?: string;
        mineral: string | null;
      }
    >();

    for (const v of valorizaciones) {
      const peso = this.pesoDe(v);
      const sacos = v.recepcionMineral?.numeroSacos ?? 0;
      const valorNeto = this.redondear(
        Number(v.totalValorNetoVentaBolivianos ?? 0),
      );
      pesoTotal += peso;
      efectivoInvertido += valorNeto;
      sacosTotal += sacos;

      const humedad = this.humedadDe(v);
      if (humedad !== null) {
        sumaHumedadPeso += humedad * peso;
        pesoConHumedad += peso;
      }

      await manager.save(
        manager.create(PromedioMineralDetalle, {
          idPromedioMineral: idPromedio,
          idValorizacion: v.id,
          numeroSacos: sacos,
          pesoKilogramos: peso,
          humedadPorcentaje: humedad,
          valorNetoVentaBolivianos: valorNeto,
          usuarioRegistro: user.usuario,
        } as any),
      );

      for (const d of v.detalles ?? []) {
        const a = acumulado.get(d.idMineral) ?? {
          sumaLeyPeso: 0,
          sumaPeso: 0,
          unidad: d.leyUnidad,
          mineral: d.mineral?.simbolo ?? d.mineral?.descripcion ?? null,
        };
        a.sumaLeyPeso += Number(d.ley) * peso;
        a.sumaPeso += peso;
        acumulado.set(d.idMineral, a);
      }
    }

    const leyes: LeyPromedioMineral[] = [...acumulado].map(([idMineral, a]) => ({
      idMineral,
      mineral: a.mineral,
      leyPromedio: a.sumaPeso > 0 ? a.sumaLeyPeso / a.sumaPeso : 0,
      leyUnidad: a.unidad ?? null,
      pesoBaseKilogramos: a.sumaPeso,
    }));

    await manager.update(PromedioMineral, idPromedio, {
      leyes,
      cantidadValorizaciones: valorizaciones.length,
      numeroSacosTotal: sacosTotal,
      pesoTotalKilogramos: pesoTotal,
      humedadPromedioPorcentaje:
        pesoConHumedad > 0 ? sumaHumedadPeso / pesoConHumedad : null,
      totalEfectivoInvertido: this.redondear(efectivoInvertido),
      usuarioUltimaModificacion: user.usuario,
    } as any);
  }

  private async obtenerActivo(id: string): Promise<PromedioMineral> {
    const promedio = await this.promedioRepository.findOne({ where: { id } });
    if (!promedio) {
      throw new NotFoundException(`No existe un promedio con el id ${id}.`);
    }
    if (!promedio.activo) {
      throw new BadRequestException('El promedio está anulado.');
    }
    return promedio;
  }

  /**
   * Un lote vendido (contabilidad.venta_lote no ANULADA) ya no puede cambiar
   * su composición, su código de lote ni anularse: la venta guardó el
   * efectivo invertido y el código con los que se negoció.
   */
  private async validarSinVentaVigente(promedio: PromedioMineral): Promise<void> {
    const filas: Array<{ id: string; estado: string }> = await this.dataSource.query(
      `SELECT id, estado FROM contabilidad.venta_lote
        WHERE id_promedio_mineral = $1 AND estado <> 'ANULADA' AND activo = true
        LIMIT 1`,
      [promedio.id],
    );
    if (filas.length) {
      throw new BadRequestException(
        `El lote ${promedio.codigoLote ?? promedio.codigo} ya está vendido (venta #${filas[0].id}, ${filas[0].estado}). Anulá la venta antes de modificar o anular el promedio.`,
      );
    }
  }

  private pesoDe(v: ValorizacionMineral): number {
    return Number(
      v.pesoNetoSecoKilogramos ??
        v.pesoBrutoSecoKilogramos ??
        v.pesoBrutoHumedoKilogramos ??
        0,
    );
  }

  /** Humedad (%) de la valorización; si no la tiene, la de la recepción. */
  private humedadDe(v: ValorizacionMineral): number | null {
    const h = v.humedadPorcentaje ?? v.recepcionMineral?.humedad ?? null;
    return h === null ? null : Number(h);
  }

  private nombreCompleto(persona?: {
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  }): string {
    return [persona?.nombres, persona?.apellidoPaterno, persona?.apellidoMaterno]
      .filter(Boolean)
      .join(' ');
  }

  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  private hoy(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async obtenerSiguienteCorrelativo(): Promise<number> {
    const secuencia = this.configService.get<string>(
      'SECUENCIA_PROMEDIO_MINERAL',
      'comercio_interno.seq_promedio_mineral',
    );
    const resultado = await this.dataSource.query(
      `SELECT nextval('${secuencia}') AS correlativo`,
    );
    return Number(resultado[0].correlativo);
  }

  private generarCodigo(correlativo: number): string {
    const longitud = Number(this.configService.get('CORRELATIVO_LONGITUD', 4));
    return `PRM-${correlativo.toString().padStart(longitud, '0')}`;
  }
}
