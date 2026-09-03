import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { Laboratorio } from 'src/cluster/parametricas/entities/laboratorio.entity';
import { EntidadAporte } from 'src/cluster/parametricas/entities/entidad-aporte.entity';
import { EstadoValorizacion } from 'src/cluster/parametricas/entities/estado-valorizacion.entity';
import { TipoCalculoValorizacion } from 'src/cluster/parametricas/entities/tipo-calculo-valorizacion.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { RecepcionMineral } from '../entities/recepcion-mineral/recepcion-mineral.entity';
import { ValorizacionMineral } from '../entities/valorizacion/valorizacion-mineral.entity';
import { CreateValorizacionMineralDetalleDto } from '../dto/valorizacion/create-valorizacion-mineral-detalle.dto';
import { CreateValorizacionCalculoAporteDto } from '../dto/valorizacion/create-valorizacion-calculo-aporte.dto';
import { CreateValorizacionCalculoDto } from '../dto/valorizacion/create-valorizacion-calculo.dto';
import { ValorizacionDetalleMineral } from '../entities/valorizacion/valorizacion-detalle-mineral.entity';
import { ValorizacionCalculoAporte } from '../entities/valorizacion/valorizacion-calculo-aporte.entity';
import { ValorizacionCalculo } from '../entities/valorizacion/valorizacion-calculo.entity';
import { UpdateValorizacionMineralDto } from '../dto/valorizacion/update-valorizacion-mineral.dto';
import { CambiarEstadoValorizacionMineralDto } from '../dto/valorizacion/cambiar-estado-valorizacion-mineral.dto';
import { CreateValorizacionMineralDto } from '../dto/valorizacion/create-valorizacion-mineral.dto';
import { FiltrosValorizacionMineralDto } from '../dto/valorizacion/filtros-valorizacion-mineral.dto';
import { ValorizacionesMineralPaginadasDto } from '../dto/valorizacion/valorizacion-mineral-paginado.dto';
import { aplicarOrden } from 'src/common/utils/query-orden.util';

// ============================
// Estados de recepción habilitados para generar/editar una valorización
// (parametrica.estado_registro): 2 = APROBADO, 6 = REMUESTREO
// ============================
const ESTADOS_RECEPCION_VALORIZABLES = [2, 6];

// Estado al que pasa la recepción una vez que la valorización queda VALORIZADA
const ESTADO_RECEPCION_TRANZADO = 5;

// ============================
// Estados de la valorización (parametrica.estado_valorizacion)
// ============================
const ESTADO_VALORIZACION_BORRADOR = 1;
const ESTADO_VALORIZACION_PRE_VALORIZADO = 2;
const ESTADO_VALORIZACION_VALORIZADO = 3;

@Injectable()
export class ValorizacionMineralService {
  constructor(
    @InjectRepository(ValorizacionMineral, 'ci')
    private readonly valorizacionRepository: Repository<ValorizacionMineral>,

    @InjectRepository(RecepcionMineral, 'ci')
    private readonly recepcionRepository: Repository<RecepcionMineral>,

    @InjectRepository(Laboratorio, 'ci')
    private readonly laboratorioRepository: Repository<Laboratorio>,

    @InjectRepository(EntidadAporte, 'ci')
    private readonly entidadAporteRepository: Repository<EntidadAporte>,

    @InjectRepository(EstadoValorizacion, 'ci')
    private readonly estadoValorizacionRepository: Repository<EstadoValorizacion>,

    @InjectRepository(TipoCalculoValorizacion, 'ci')
    private readonly tipoCalculoValorizacionRepository: Repository<TipoCalculoValorizacion>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ============================
  // Validaciones comunes
  // ============================

  private async obtenerRecepcionParaValorizar(
    idRecepcionMineral: number,
  ): Promise<RecepcionMineral> {
    const recepcion = await this.recepcionRepository
      .createQueryBuilder('recepcion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')
      .leftJoinAndSelect('recepcion.estado', 'estado')
      .leftJoinAndSelect('recepcion.valorizaciones', 'valorizacion')
      .where('recepcion.id = :id', {
        id: idRecepcionMineral,
      })
      .andWhere('recepcion.activo = true')
      .getOne();

    if (!recepcion) {
      throw new NotFoundException(
        `No existe una recepción de mineral con el id ${idRecepcionMineral}.`,
      );
    }

    return recepcion;
  }

  private validarEstadoRecepcion(recepcion: RecepcionMineral): void {
    if (!ESTADOS_RECEPCION_VALORIZABLES.includes(Number(recepcion.idEstado))) {
      throw new BadRequestException(
        'La recepción debe estar en estado APROBADO o REMUESTREO para poder valorizarse.',
      );
    }
  }

  private async validarLaboratorio(idLaboratorio: string): Promise<void> {
    const laboratorio = await this.laboratorioRepository.findOne({
      where: {
        id: idLaboratorio,
        activo: true,
      },
    });

    if (!laboratorio) {
      throw new NotFoundException('El laboratorio seleccionado no existe.');
    }
  }

  /**
   * Valida el detalle de minerales enviado en esta llamada puntual.
   *
   * El detalle se envía de forma incremental (el front puede mandar un
   * mineral a la vez, en llamadas separadas), por lo que aquí solo se
   * valida lo que llega en este request: que no haya minerales repetidos
   * dentro del propio payload. Ya no se exige que estén todos los
   * minerales de la codificación en una misma llamada.
   */
  private validarDetalleValorizacion(
    detalles: CreateValorizacionMineralDetalleDto[],
  ): void {
    const mineralesDetalle = detalles.map((d) => d.idMineral);

    if (new Set(mineralesDetalle).size !== mineralesDetalle.length) {
      throw new BadRequestException(
        'Existen minerales repetidos en el detalle de la valorización.',
      );
    }
  }

  private async validarEstadoValorizacion(
    idEstadoValorizacion: number,
  ): Promise<void> {
    const estado = await this.estadoValorizacionRepository.findOne({
      where: {
        id: idEstadoValorizacion,
        activo: true,
      },
    });

    if (!estado) {
      throw new NotFoundException(
        'El estado de valorización seleccionado no existe.',
      );
    }
  }

  private async validarEntidadesAporte(
    aportes: CreateValorizacionCalculoAporteDto[],
  ): Promise<void> {
    if (!aportes?.length) {
      return;
    }

    const idsEntidad = aportes.map((a) => a.idEntidadAporte);

    if (new Set(idsEntidad).size !== idsEntidad.length) {
      throw new BadRequestException(
        'Existen entidades de aporte repetidas en la lista de aportes.',
      );
    }

    const entidades = await this.entidadAporteRepository.find({
      where: {
        id: In(idsEntidad),
        activo: true,
      },
    });

    if (entidades.length !== idsEntidad.length) {
      throw new NotFoundException(
        'Una o más entidades de aporte seleccionadas no existen o están inactivas.',
      );
    }
  }

  private async validarTiposCalculo(
    calculos: CreateValorizacionCalculoDto[],
  ): Promise<void> {
    if (!calculos?.length) {
      return;
    }

    const idsTipoCalculo = calculos.map((c) => c.idTipoCalculoValorizacion);

    if (new Set(idsTipoCalculo).size !== idsTipoCalculo.length) {
      throw new BadRequestException(
        'Existen tipos de cálculo repetidos en la lista de cálculos.',
      );
    }

    const tipos = await this.tipoCalculoValorizacionRepository.find({
      where: {
        id: In(idsTipoCalculo),
        activo: true,
      },
    });

    if (tipos.length !== idsTipoCalculo.length) {
      throw new NotFoundException(
        'Uno o más tipos de cálculo seleccionados no existen o están inactivos.',
      );
    }
  }

  // ============================
  // Persistencia dentro de la transacción
  // ============================

  /**
   * Aplica un upsert por mineral sobre el detalle de la valorización.
   *
   * El front puede enviar los minerales de a uno por llamada (o varios a la
   * vez), por lo que esto NO reemplaza todo el detalle activo: por cada
   * mineral enviado, si ya existe un detalle activo para ese mineral y
   * cambió algún dato, se da de baja lógica ese registro y se crea uno
   * nuevo; si el mineral es nuevo, simplemente se crea. Los minerales
   * activos que no vengan en este request quedan intactos.
   */
  private async reemplazarDetalleValorizacion(
    queryRunner: QueryRunner,
    idValorizacion: string,
    detalles: CreateValorizacionMineralDetalleDto[],
    user: Usuario,
  ): Promise<void> {
    const idsMineral = detalles.map((d) => d.idMineral.toString());

    const detallesActuales = await queryRunner.manager.find(
      ValorizacionDetalleMineral,
      {
        where: {
          idValorizacion,
          idMineral: In(idsMineral),
          activo: true,
        },
      },
    );

    const actualPorMineral = new Map(
      detallesActuales.map((detalle) => [detalle.idMineral, detalle]),
    );

    const idsADesactivar: string[] = [];
    const aCrear: CreateValorizacionMineralDetalleDto[] = [];

    for (const detalle of detalles) {
      const idMineral = detalle.idMineral.toString();
      const actual = actualPorMineral.get(idMineral);

      const sinCambios =
        !!actual &&
        Number(actual.ley) === Number(detalle.ley) &&
        (actual.leyUnidad ?? '') === (detalle.leyUnidad ?? '') &&
        (actual.leyPagable ?? null) === (detalle.leyPagable ?? null) &&
        (actual.idCotizacionMineral ?? null) ===
          (detalle.idCotizacionMineral ?? null) &&
        (actual.porcentajeCotizacion ?? null) ===
          (detalle.porcentajeCotizacion ?? null) &&
        (actual.cotizacionAplicada ?? null) ===
          (detalle.cotizacionAplicada ?? null) &&
        (actual.precioKilo ?? null) === (detalle.precioKilo ?? null) &&
        (actual.precio ?? null) === (detalle.precio ?? null) &&
        (actual.idEscalaPrecio ?? null) === (detalle.idEscalaPrecio ?? null) &&
        (actual.ajustePuntosLey ?? null) ===
          (detalle.ajustePuntosLey ?? null) &&
        (actual.leyAjustada ?? null) === (detalle.leyAjustada ?? null) &&
        (actual.precioUsdTm ?? null) === (detalle.precioUsdTm ?? null) &&
        (actual.factorPorsentaje ?? null) ===
          (detalle.factorPorsentaje ?? null);

      if (sinCambios) {
        continue;
      }

      if (actual) {
        idsADesactivar.push(actual.id);
      }

      aCrear.push(detalle);
    }

    if (idsADesactivar.length === 0 && aCrear.length === 0) {
      return;
    }

    if (idsADesactivar.length > 0) {
      await queryRunner.manager.update(
        ValorizacionDetalleMineral,
        { id: In(idsADesactivar) },
        {
          activo: false,
          usuarioUltimaModificacion: user.usuario,
        },
      );
    }

    if (aCrear.length > 0) {
      const registros = aCrear.map((detalle) =>
        queryRunner.manager.create(ValorizacionDetalleMineral, {
          idValorizacion,
          idMineral: detalle.idMineral.toString(),
          ley: detalle.ley,
          leyUnidad: detalle.leyUnidad,
          leyPagable: detalle.leyPagable,
          idCotizacionMineral: detalle.idCotizacionMineral,
          porcentajeCotizacion: detalle.porcentajeCotizacion,
          cotizacionAplicada: detalle.cotizacionAplicada,
          precioKilo: detalle.precioKilo,
          precio: detalle.precio,
          idEscalaPrecio: detalle.idEscalaPrecio,
          ajustePuntosLey: detalle.ajustePuntosLey,
          leyAjustada: detalle.leyAjustada,
          precioUsdTm: detalle.precioUsdTm,
          factorPorsentaje: detalle.factorPorsentaje,
          usuarioRegistro: user.usuario,
        }),
      );

      await queryRunner.manager.save(ValorizacionDetalleMineral, registros);
    }
  }

  /**
   * Da de baja lógica los aportes activos anteriores y crea los nuevos aportes enviados.
   */
  private async reemplazarCalculoAportes(
    queryRunner: QueryRunner,
    idValorizacion: string,
    aportes: CreateValorizacionCalculoAporteDto[],
    user: Usuario,
  ): Promise<void> {
    // 1. Obtener los registros que actualmente están activos en la BD
    const actuales = await queryRunner.manager.find(ValorizacionCalculoAporte, {
      where: { idValorizacion, activo: true },
    });

    // 2. Verificar si el tamaño de las listas es el mismo
    let sonIguales = actuales.length === aportes.length;

    if (sonIguales) {
      // 3. Comparar elemento por elemento (ordenando o buscando coincidencia exacta)
      sonIguales = aportes.every((dto) =>
        actuales.some(
          (db) =>
            db.idEntidadAporte === dto.idEntidadAporte.toString() &&
            db.tipoBaseAporte === dto.tipoBaseAporte &&
            Number(db.porcentajeAporte) === Number(dto.porcentajeAporte) &&
            Number(db.baseCalculo) === Number(dto.baseCalculo) &&
            Number(db.importeBolivianos) === Number(dto.importeBolivianos),
        ),
      );
    }

    // 4. Si la data es exactamente igual, salimos de la función sin tocar la BD
    if (sonIguales) {
      return;
    }

    // 5. Si hubo cambios, desactivamos los antiguos
    await queryRunner.manager.update(
      ValorizacionCalculoAporte,
      { idValorizacion, activo: true } as any,
      {
        activo: false,
        usuarioUltimaModificacion: user.usuario,
      },
    );

    // 6. Creamos y guardamos los nuevos registros
    const registros = aportes.map((aporte) =>
      queryRunner.manager.create(ValorizacionCalculoAporte, {
        idValorizacion,
        idEntidadAporte: aporte.idEntidadAporte.toString(),
        tipoBaseAporte: aporte.tipoBaseAporte,
        porcentajeAporte: aporte.porcentajeAporte,
        baseCalculo: aporte.baseCalculo,
        importeBolivianos: aporte.importeBolivianos,
        usuarioRegistro: user.usuario,
      }),
    );

    await queryRunner.manager.save(registros);
  }

  /**
   * Da de baja lógica todos los aportes activos de la valorización.
   *
   * Solo se ejecuta cuando el front manda explícitamente `limpiarAportes:
   * true`; no enviar `aportes` (o mandarlo vacío) sin esta señal NO borra
   * nada, para no desactivar aportes por accidente en un PATCH parcial.
   */
  private async desactivarTodosLosAportes(
    queryRunner: QueryRunner,
    idValorizacion: string,
    user: Usuario,
  ): Promise<void> {
    await queryRunner.manager.update(
      ValorizacionCalculoAporte,
      { idValorizacion, activo: true } as any,
      {
        activo: false,
        usuarioUltimaModificacion: user.usuario,
      },
    );
  }

  /**
   * Da de baja lógica los cálculos activos anteriores y crea los nuevos
   * cálculos enviados. Mismo criterio que los aportes: se envían siempre
   * completos (no es un upsert incremental por tipo).
   */
  private async reemplazarCalculos(
    queryRunner: QueryRunner,
    idValorizacion: string,
    calculos: CreateValorizacionCalculoDto[],
    user: Usuario,
  ): Promise<void> {
    // 1. Obtener los registros que actualmente están activos en la BD
    const actuales = await queryRunner.manager.find(ValorizacionCalculo, {
      where: { idValorizacion, activo: true },
    });

    // 2. Verificar si el tamaño de las listas es el mismo
    let sonIguales = actuales.length === calculos.length;

    if (sonIguales) {
      // 3. Comparar elemento por elemento (buscando coincidencia exacta)
      sonIguales = calculos.every((dto) =>
        actuales.some(
          (db) =>
            db.idTipoCalculoValorizacion === dto.idTipoCalculoValorizacion &&
            (db.baseCalculo ?? null) === (dto.baseCalculo ?? null) &&
            (db.valorAplicado ?? null) === (dto.valorAplicado ?? null) &&
            Number(db.importeBolivianos) === Number(dto.importeBolivianos),
        ),
      );
    }

    // 4. Si la data es exactamente igual, salimos de la función sin tocar la BD
    if (sonIguales) {
      return;
    }

    // 5. Si hubo cambios, desactivamos los antiguos
    await queryRunner.manager.update(
      ValorizacionCalculo,
      { idValorizacion, activo: true } as any,
      {
        activo: false,
        usuarioUltimaModificacion: user.usuario,
      },
    );

    // 6. Creamos y guardamos los nuevos registros
    const registros = calculos.map((calculo) =>
      queryRunner.manager.create(ValorizacionCalculo, {
        idValorizacion,
        idTipoCalculoValorizacion: calculo.idTipoCalculoValorizacion,
        baseCalculo: calculo.baseCalculo,
        valorAplicado: calculo.valorAplicado,
        importeBolivianos: calculo.importeBolivianos,
        extras: calculo.extras,
        usuarioRegistro: user.usuario,
      }),
    );

    await queryRunner.manager.save(registros);
  }

  /**
   * Da de baja lógica todos los cálculos activos de la valorización.
   *
   * Solo se ejecuta cuando el front manda explícitamente `limpiarCalculos:
   * true`; no enviar `calculos` (o mandarlo vacío) sin esta señal NO borra
   * nada, para no desactivar cálculos por accidente en un PATCH parcial.
   */
  private async desactivarTodosLosCalculos(
    queryRunner: QueryRunner,
    idValorizacion: string,
    user: Usuario,
  ): Promise<void> {
    await queryRunner.manager.update(
      ValorizacionCalculo,
      { idValorizacion, activo: true } as any,
      {
        activo: false,
        usuarioUltimaModificacion: user.usuario,
      },
    );
  }

  private async obtenerValorizacionCompleta(
    id: string,
  ): Promise<ValorizacionMineral> {
    return await this.valorizacionRepository
      .createQueryBuilder('valorizacion')
      .leftJoinAndSelect('valorizacion.recepcionMineral', 'recepcion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect(
        'persona.actorProductivoMinero',
        'actorProductivoMinero',
      )
      .leftJoinAndSelect(
        'actorProductivoMinero.tipoActorProductivoMinero',
        'tipoActorProductivoMinero',
      )
      .leftJoinAndSelect('actorProductivoMinero.municipio', 'municipio')
      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')
      .leftJoinAndSelect('recepcion.estado', 'estadoRecepcion')
      .leftJoinAndSelect('valorizacion.laboratorio', 'laboratorio')
      .leftJoinAndSelect(
        'valorizacion.estadoValorizacion',
        'estadoValorizacion',
      )
      .leftJoinAndSelect(
        'valorizacion.detalles',
        'detalle',
        'detalle.activo = true',
      )
      .leftJoinAndSelect('detalle.mineral', 'mineral')
      .leftJoinAndSelect('detalle.cotizacionMineral', 'cotizacionMineral')
      .leftJoinAndSelect(
        'valorizacion.calculoAportes',
        'calculoAporte',
        'calculoAporte.activo = true',
      )
      .leftJoinAndSelect('calculoAporte.entidadAporte', 'entidadAporte')
      .leftJoinAndSelect(
        'valorizacion.calculos',
        'calculo',
        'calculo.activo = true',
      )
      .leftJoinAndSelect(
        'calculo.tipoCalculoValorizacion',
        'tipoCalculoValorizacion',
      )
      .where('valorizacion.id = :id', { id })
      .getOne();
  }

  private async obtenerValorizacionParaEditar(
    id: string,
  ): Promise<ValorizacionMineral> {
    const valorizacion = await this.valorizacionRepository
      .createQueryBuilder('valorizacion')
      .leftJoinAndSelect('valorizacion.recepcionMineral', 'recepcion')
      .leftJoinAndSelect(
        'valorizacion.detalles',
        'detalle',
        'detalle.activo = true',
      )
      .where('valorizacion.id = :id', { id })
      .getOne();

    if (!valorizacion) {
      throw new NotFoundException(
        `No existe una valorización con el id ${id}.`,
      );
    }

    return valorizacion;
  }

  /**
   * La valorización solo puede seguir editándose mientras la recepción
   * asociada esté en APROBADO o REMUESTREO. Una vez TRANZADO, queda bloqueada.
   */
  private validarValorizacionEditable(valorizacion: ValorizacionMineral): void {
    //console.log('dsadas', valorizacion.recepcionMineral.idEstado);
    if (
      !ESTADOS_RECEPCION_VALORIZABLES.includes(
        Number(valorizacion.recepcionMineral.idEstado),
      )
    ) {
      throw new BadRequestException(
        'La valorización ya no puede modificarse: la recepción asociada fue tranzada.',
      );
    }
  }

  /**
   * Verifica que la información mínima esté completa antes de permitir el
   * paso a VALORIZADO. Ajustar aquí la lista de campos obligatorios según
   * las reglas de negocio finales.
   */
  private validarValorizacionCompletaParaFinalizar(
    valorizacion: ValorizacionMineral,
    dto: UpdateValorizacionMineralDto,
    detallesFinales: number,
  ): void {
    const idLaboratorio = dto.idLaboratorio ?? valorizacion.idLaboratorio;
    const fechaValorizacion =
      dto.fechaValorizacion ?? valorizacion.fechaValorizacion;
    const totalValorBrutoBolivianos =
      dto.totalValorBrutoBolivianos ?? valorizacion.totalValorBrutoBolivianos;

    const faltantes: string[] = [];

    if (!idLaboratorio) faltantes.push('idLaboratorio');
    if (!fechaValorizacion) faltantes.push('fechaValorizacion');
    if (detallesFinales === 0) faltantes.push('detalles');
    if (
      totalValorBrutoBolivianos === undefined ||
      totalValorBrutoBolivianos === null
    )
      faltantes.push('totalValorBrutoBolivianos');

    if (faltantes.length > 0) {
      throw new BadRequestException(
        `No se puede pasar a VALORIZADO, faltan los siguientes datos: ${faltantes.join(', ')}.`,
      );
    }
  }

  // ============================
  // Creación del borrador
  // ============================

  async crear(
    dto: CreateValorizacionMineralDto,
    user: Usuario,
  ): Promise<ValorizacionMineral> {
    const { idRecepcionMineral } = dto;

    // Validar recepción
    const recepcion =
      await this.obtenerRecepcionParaValorizar(idRecepcionMineral);

    this.validarEstadoRecepcion(recepcion);

    // Validar que no exista una valorización para la recepción
    const valorizacionExistente = await this.valorizacionRepository.findOne({
      where: {
        idRecepcionMineral: idRecepcionMineral.toString(),
      },
    });

    if (valorizacionExistente) {
      throw new BadRequestException(
        'Ya existe una valorización registrada para esta recepción de mineral.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const valorizacion = queryRunner.manager.create(ValorizacionMineral, {
        idRecepcionMineral: idRecepcionMineral.toString(),
        idEstadoValorizacion: ESTADO_VALORIZACION_BORRADOR,
        anticipo: recepcion.anticipo ?? 0,
        pesoBrutoHumedoKilogramos: recepcion.balanzaL,
        totalValorLiquidoVentaBolivianos: 0,
        totalValorNetoVentaBolivianos: 0,
        usuarioRegistro: user.usuario,
      });

      const registro = await queryRunner.manager.save(
        ValorizacionMineral,
        valorizacion,
      );

      // Puebla el puntero inverso en la recepción para poder consultar
      // directamente el id de su valorización, sin necesidad de join.
      await queryRunner.manager.update(RecepcionMineral, idRecepcionMineral, {
        idValorizacion: registro.id,
        usuarioUltimaModificacion: user.usuario,
      });

      await queryRunner.commitTransaction();

      return await this.obtenerValorizacionCompleta(registro.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ============================
  // Actualización parcial (PATCH)
  // ============================

  async actualizar(
    id: string,
    dto: UpdateValorizacionMineralDto,
    user: Usuario,
  ): Promise<ValorizacionMineral> {
    const valorizacion = await this.obtenerValorizacionParaEditar(id);
    // console.log('valorizacion new  ', dto);
    // console.log('valorizacion old ', valorizacion);
    this.validarValorizacionEditable(valorizacion);

    if (dto.idLaboratorio !== undefined) {
      await this.validarLaboratorio(dto.idLaboratorio);
    }

    if (dto.idEstadoValorizacion !== undefined) {
      await this.validarEstadoValorizacion(dto.idEstadoValorizacion);
    }

    if (dto.detalles?.length) {
      this.validarDetalleValorizacion(dto.detalles);
    }

    if (dto.aportes?.length) {
      await this.validarEntidadesAporte(dto.aportes);
    }

    if (dto.calculos?.length) {
      await this.validarTiposCalculo(dto.calculos);
    }

    // El detalle se envía de forma incremental (puede llegar un mineral a la
    // vez), así que el total final es lo que ya estaba activo más los
    // minerales nuevos que traiga este request (los que ya existían solo
    // se actualizan, no suman al conteo).
    const idsDetalleActuales = new Set(
      (valorizacion.detalles ?? []).map((d) => d.idMineral),
    );
    const mineralesNuevos = (dto.detalles ?? []).filter(
      (d) => !idsDetalleActuales.has(d.idMineral.toString()),
    );
    const detallesFinales = idsDetalleActuales.size + mineralesNuevos.length;

    if (dto.idEstadoValorizacion === ESTADO_VALORIZACION_VALORIZADO) {
      this.validarValorizacionCompletaParaFinalizar(
        valorizacion,
        dto,
        detallesFinales,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(ValorizacionMineral, id, {
        idLaboratorio: dto.idLaboratorio,
        // idEstadoValorizacion: dto.idEstadoValorizacion,

        pesoBrutoHumedoKilogramos: dto.pesoBrutoHumedoKilogramos,
        pesoBrutoSecoKilogramos: dto.pesoBrutoSecoKilogramos,
        // pesoNetoHumedoKilogramos: dto.pesoNetoHumedoKilogramos,
        pesoNetoSecoKilogramos: dto.pesoNetoSecoKilogramos,

        taraKilogramos: dto.taraKilogramos,

        humedadPorcentaje: dto.humedadPorcentaje,
        mermaPorcentaje: dto.mermaPorcentaje,
        mermaKilogramos: dto.mermaKilogramos,

        totalValorBrutoBolivianos: dto.totalValorBrutoBolivianos,
        totalAportesBolivianos: dto.totalAportesBolivianos,
        cotizacionDolar: dto.cotizacionDolar,
        ajusteTransporte: dto.ajusteTransporte,

        anticipo: dto.anticipo,
        otrosAnticipo: dto.otrosAnticipo,
        totalValorLiquidoVentaBolivianos: dto.totalValorLiquidoVentaBolivianos,
        totalValorLiquidoVentaUsd: dto.totalValorLiquidoVentaUsd,
        totalValorNetoVentaBolivianos: dto.totalValorNetoVentaBolivianos,

        totalValorToneladaBolivianos: dto.totalValorToneladaBolivianos,
        totalValorToneladaUsd: dto.totalValorToneladaUsd,

        observaciones: dto.observaciones,
        fechaValorizacion: dto.fechaValorizacion,

        usuarioUltimaModificacion: user.usuario,
      });

      if (dto.detalles?.length) {
        await this.reemplazarDetalleValorizacion(
          queryRunner,
          id,
          dto.detalles,
          user,
        );
      }

      if (dto.limpiarAportes) {
        await this.desactivarTodosLosAportes(queryRunner, id, user);
      } else if (dto.aportes?.length) {
        await this.reemplazarCalculoAportes(queryRunner, id, dto.aportes, user);
      }

      if (dto.limpiarCalculos) {
        await this.desactivarTodosLosCalculos(queryRunner, id, user);
      } else if (dto.calculos?.length) {
        await this.reemplazarCalculos(queryRunner, id, dto.calculos, user);
      }

      if (dto.idEstadoValorizacion === ESTADO_VALORIZACION_VALORIZADO) {
        await queryRunner.manager.update(
          RecepcionMineral,
          valorizacion.idRecepcionMineral,
          {
            idEstado: ESTADO_RECEPCION_TRANZADO,
            usuarioUltimaModificacion: user.usuario,
          },
        );
      }

      await queryRunner.commitTransaction();
      // console.log(
      //   'commit transaction',
      //   await this.obtenerValorizacionCompleta(id),
      // );
      return await this.obtenerValorizacionCompleta(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ============================
  // Cambio de estado (PRE-VALORIZADO / VALORIZADO)
  // ============================

  /**
   * Endpoint dedicado exclusivamente al cambio de estado de la valorización.
   * El front indica a qué estado está pasando (PRE-VALORIZADO o VALORIZADO).
   *
   * Al pasar a VALORIZADO (3), la recepción de mineral asociada pasa a
   * TRANZADO (5) y la valorización queda bloqueada para futuras modificaciones.
   */
  async cambiarEstado(
    id: string,
    dto: CambiarEstadoValorizacionMineralDto,
    user: Usuario,
  ): Promise<ValorizacionMineral> {
    const valorizacion = await this.obtenerValorizacionParaEditar(id);

    if (!valorizacion.activo) {
      throw new BadRequestException('La valorización no está activa.');
    }

    this.validarValorizacionEditable(valorizacion);

    await this.validarEstadoValorizacion(dto.idEstadoValorizacion);

    if (
      valorizacion.totalValorLiquidoVentaBolivianos === null ||
      valorizacion.totalValorLiquidoVentaBolivianos === undefined ||
      Number(valorizacion.totalValorLiquidoVentaBolivianos) <= 0
    ) {
      throw new BadRequestException(
        'La valorización aún no tiene registrado el saldo a pagar.',
      );
    }

    if (!(valorizacion.detalles ?? []).length) {
      throw new BadRequestException(
        'La valorización debe tener al menos un detalle de mineral registrado.',
      );
    }

    // Al pasar a PRE-VALORIZADO se guarda una foto completa del objeto
    // (recepción, detalles, cálculos y aportes) tal como queda en ese
    // momento, para dejar registro de con qué datos se pre-valorizó.
    let prevalorizado: Record<string, any> | undefined;

    if (dto.idEstadoValorizacion === ESTADO_VALORIZACION_PRE_VALORIZADO) {
      const valorizacionCompleta = await this.obtenerValorizacionCompleta(id);

      prevalorizado = {
        ...valorizacionCompleta,
        idEstadoValorizacion: dto.idEstadoValorizacion,
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(ValorizacionMineral, id, {
        idEstadoValorizacion: dto.idEstadoValorizacion,
        ...(prevalorizado ? { prevalorizado } : {}),
        usuarioUltimaModificacion: user.usuario,
      });

      if (dto.idEstadoValorizacion === ESTADO_VALORIZACION_VALORIZADO) {
        await queryRunner.manager.update(
          RecepcionMineral,
          valorizacion.idRecepcionMineral,
          {
            idEstado: ESTADO_RECEPCION_TRANZADO,
            usuarioUltimaModificacion: user.usuario,
          },
        );
      }

      await queryRunner.commitTransaction();

      return await this.obtenerValorizacionCompleta(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async buscarPorId(id: string): Promise<ValorizacionMineral> {
    const valorizacion = await this.obtenerValorizacionCompleta(id);

    if (!valorizacion) {
      throw new NotFoundException(
        `No existe una valorización con el id ${id}.`,
      );
    }

    return valorizacion;
  }

  // ============================
  // Listado paginado / filtros
  // ============================

  async findAll(
    filtros: FiltrosValorizacionMineralDto,
  ): Promise<ValorizacionesMineralPaginadasDto> {
    const { page = 1, limit = 10 } = filtros;

    const query = this.buildValorizacionMineralQuery(filtros);

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

  private buildValorizacionMineralQuery(
    filtros: FiltrosValorizacionMineralDto,
  ): SelectQueryBuilder<ValorizacionMineral> {
    const {
      busqueda,
      codigoOperacion,
      numeroDocumento,
      idEstadoValorizacion,
      fechaDesde,
      fechaHasta,
      orderBy = 'fechaValorizacion',
      orderDirection = 'DESC',
    } = filtros;

    const query = this.valorizacionRepository
      .createQueryBuilder('valorizacion')

      .leftJoinAndSelect('valorizacion.recepcionMineral', 'recepcion')

      .leftJoinAndSelect('recepcion.persona', 'persona')

      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')

      .leftJoinAndSelect(
        'valorizacion.estadoValorizacion',
        'estadoValorizacion',
      );

    //---------------------------------------------------------
    // Búsqueda
    //---------------------------------------------------------

    if (busqueda) {
      query.andWhere(
        `(
        persona.nombres ILIKE :busqueda
        OR persona.apellidoPaterno ILIKE :busqueda
        OR persona.apellidoMaterno ILIKE :busqueda
        OR persona.numeroDocumento ILIKE :busqueda
        OR recepcion.codigoOperacion ILIKE :busqueda
      )`,
        {
          busqueda: `%${busqueda}%`,
        },
      );
    }

    //---------------------------------------------------------
    // Código Operación
    //---------------------------------------------------------

    if (codigoOperacion) {
      query.andWhere('recepcion.codigoOperacion ILIKE :codigoOperacion', {
        codigoOperacion: `%${codigoOperacion}%`,
      });
    }

    //---------------------------------------------------------
    // Documento
    //---------------------------------------------------------

    if (numeroDocumento) {
      query.andWhere('persona.numeroDocumento ILIKE :numeroDocumento', {
        numeroDocumento: `%${numeroDocumento}%`,
      });
    }

    //---------------------------------------------------------
    // Estado de Valorización
    //---------------------------------------------------------

    if (idEstadoValorizacion) {
      query.andWhere(
        'valorizacion.idEstadoValorizacion = :idEstadoValorizacion',
        {
          idEstadoValorizacion,
        },
      );
    }

    //---------------------------------------------------------
    // Fecha Desde
    //---------------------------------------------------------

    if (fechaDesde) {
      query.andWhere(
        'valorizacion.fechaValorizacion ::timestamptz >= :fechaDesde',
        {
          fechaDesde,
        },
      );
    }

    //---------------------------------------------------------
    // Fecha Hasta
    //---------------------------------------------------------

    if (fechaHasta) {
      const fechaFin = new Date(fechaHasta);

      fechaFin.setHours(23, 59, 59, 999);

      query.andWhere(
        'valorizacion.fechaValorizacion ::timestamptz <= :fechaHasta',
        {
          fechaHasta: fechaFin,
        },
      );
    }

    //---------------------------------------------------------
    // Ordenamiento
    //---------------------------------------------------------

    aplicarOrden(
      query,
      {
        id: 'valorizacion.id',
        codigoOperacion: 'recepcion.codigoOperacion',
        fechaValorizacion: 'valorizacion.fechaValorizacion',
        numeroDocumento: 'persona.numeroDocumento',
        estado: 'estadoValorizacion.nombre',
      },
      orderBy,
      orderDirection,
    );

    return query;
  }
}
