import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
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
import { Codificacion } from 'src/cluster/parametricas/entities/codificacion.entity';
import { PersonaCi } from '../entities/persona-ci.entity';
import { PersonaTipo } from '../../parametricas/entities/persona-tipo.entity';
import { RecepcionMineral } from '../entities/recepcion-mineral/recepcion-mineral.entity';
import { EstadoRegistro } from 'src/cluster/parametricas/entities/estado-registro.entity';
import { Laboratorio } from 'src/cluster/parametricas/entities/laboratorio.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { ConfigService } from '@nestjs/config';
import { CreateRecepcionMineralDto } from '../dto/recepcion-mineral/create-recepcion-mineral.dto';
import { UpdateRecepcionMineralDto } from '../dto/recepcion-mineral/update-recepcion-mineral.dto';
import { EstadoRecepcion } from 'src/cluster/enum/estado-recepcion.enum';
import { FiltrosRegistroMineralDto } from '../dto/recepcion-mineral/filtros-registro-mineral.dto';
import { CreateRecepcionMineralDetalleDto } from '../dto/recepcion-mineral/create-recepcion-mineral-detalle.dto';
//import { RecepcionMineralDetalle } from '../entities/recepcion-mineral/recepcion-mineral-detalle.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { RegistrosMineralPaginadosDto } from '../dto/recepcion-mineral/registro-mineral-paginado.dto';
import { ReciboRecepcionMineralPdfService } from './recibo-pdf-recepcion-mineral.service';
import { aplicarOrden } from 'src/common/utils/query-orden.util';
import { resolverRangoFechas } from 'src/common/utils/rango-fechas.util';
import { Recibo } from 'src/cluster/contabilidad/entities/recibo.entity';

@Injectable()
export class ComercioInternoService {
  constructor(
    @InjectRepository(RecepcionMineral, 'ci')
    private readonly recepcionRepository: Repository<RecepcionMineral>,

    @InjectRepository(Codificacion, 'ci')
    private readonly codificacionRepository: Repository<Codificacion>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(PersonaTipo, 'ci')
    private readonly personaTipoRepository: Repository<PersonaTipo>,

    @InjectRepository(EstadoRegistro, 'ci')
    private readonly estadoRepository: Repository<EstadoRegistro>,

    @InjectRepository(Laboratorio, 'ci')
    private readonly laboratorioRepository: Repository<Laboratorio>,

    private readonly reciboPdfService: ReciboRecepcionMineralPdfService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,

    private readonly configService: ConfigService,
  ) {}
  // codificacion
  private async obtenerSiguienteCorrelativo(): Promise<number> {
    const nombreSecuencia = this.configService.get<string>(
      'SECUENCIA_RECEPCION_MINERAL',
    );
    if (!nombreSecuencia) {
      throw new InternalServerErrorException(
        'No se encuentra configurada la secuencia de recepción de minerales.',
      );
    }
    const resultado = await this.dataSource.query(
      `SELECT nextval('${nombreSecuencia}') AS correlativo`,
    );
    return Number(resultado[0].correlativo);
  }
  private generarCodigoOperacion(codigo: string, correlativo: number): string {
    const longitud = Number(this.configService.get('CORRELATIVO_LONGITUD', 4));

    return `${codigo}-${correlativo.toString().padStart(longitud, '0')}`;
  }

  private async validarDetalleRecepcion(
    idCodificacion: string,
    detalles: CreateRecepcionMineralDetalleDto[],
  ): Promise<void> {
    const codificacion = await this.codificacionRepository.findOne({
      where: {
        id: idCodificacion,
        activo: true,
      },
      // relations: {
      //   minerales: true,
      // },
    });

    if (!codificacion) {
      throw new NotFoundException(
        'No se encontró la codificación seleccionada.',
      );
    }

    const mineralesCodificacion = codificacion.minerales.map((m) =>
      Number(m.id),
    );

    const mineralesDetalle = detalles.map((d) => d.idMineral);

    // Minerales repetidos
    if (new Set(mineralesDetalle).size !== mineralesDetalle.length) {
      throw new BadRequestException(
        'Existen minerales repetidos en el detalle de la recepción.',
      );
    }

    // Cantidad distinta
    if (mineralesCodificacion.length !== mineralesDetalle.length) {
      throw new BadRequestException(
        'La lista de minerales no coincide con la codificación seleccionada.',
      );
    }

    // Comparación de conjuntos
    const iguales = mineralesCodificacion.every((idMineral) =>
      mineralesDetalle.includes(idMineral),
    );

    if (!iguales) {
      throw new BadRequestException(
        'La lista de minerales no coincide con la codificación seleccionada.',
      );
    }
  }

  // private async guardarDetalleRecepcion(
  //   queryRunner: QueryRunner,
  //   idRecepcion: string,
  //   detalles: CreateRecepcionMineralDetalleDto[],
  //   user: Usuario,
  // ): Promise<void> {
  //   const registros = detalles.map((detalle) =>
  //     queryRunner.manager.create(RecepcionMineralDetalle, {
  //       idRecepcionMineral: idRecepcion,
  //       idMineral: detalle.idMineral.toString(),
  //       ley: detalle.ley,
  //       leyUnidad: detalle.leyUnidad,
  //       usuarioRegistro: user.usuario,
  //     }),
  //   );

  //   await queryRunner.manager.save(registros);
  // }

  // private async inactivarDetalleRecepcion(
  //   queryRunner: QueryRunner,
  //   idRecepcion: string,
  //   user: Usuario,
  // ): Promise<void> {
  //   await queryRunner.manager.update(
  //     RecepcionMineralDetalle,
  //     {
  //       idRecepcionMineral: idRecepcion,
  //       activo: true,
  //     },
  //     {
  //       activo: false,
  //       usuarioUltimaModificacion: user.usuario,
  //     },
  //   );
  // }

  private async obtenerRecepcionCompleta(
    id: string,
  ): Promise<RecepcionMineral> {
    return await this.recepcionRepository
      .createQueryBuilder('recepcion')
      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect('recepcion.actorProductivoMinero', 'actorProveedor')
      .leftJoinAndSelect('recepcion.personalInterno', 'personalInterno')
      .leftJoinAndSelect('recepcion.estado', 'estado')
      .leftJoinAndSelect('recepcion.laboratorio', 'laboratorio')
      .leftJoinAndSelect('recepcion.recibos', 'recibo', "recibo.estado <> 'ANULADO'")
      // .leftJoinAndSelect(
      //   'recepcion.detalles',
      //   'detalle',
      //   'detalle.activo = :activo',
      //   { activo: true },
      // )
      // .leftJoinAndSelect('detalle.mineral', 'mineral')
      .where('recepcion.id = :id', { id })
      .getOne();
  }

  /// crear regitross

  // private actualizarCodigoOperacion(
  //   recepcion: RecepcionMineral,
  //   codigo: string,
  // ): string {
  //   return this.generarCodigoOperacion(codigo, Number(recepcion.correlativo));
  // }

  private async obtenerRecepcion(id: string): Promise<RecepcionMineral> {
    const recepcion = await this.recepcionRepository.findOne({
      where: { id },
    });

    if (!recepcion) {
      throw new NotFoundException(`No existe una recepción con el id ${id}.`);
    }

    return recepcion;
  }
  private validarRecepcionEditable(recepcion: RecepcionMineral): void {
    if (recepcion.idEstado === EstadoRecepcion.LIQUIDADO) {
      throw new BadRequestException(
        'La recepción ya fue liquidada y no puede ser modificada.',
      );
    }
  }

  private async validarCodificacion(
    idCodificacion: string,
  ): Promise<Codificacion> {
    const codificacion = await this.codificacionRepository.findOne({
      where: {
        id: idCodificacion,
        activo: true,
      },
    });

    if (!codificacion) {
      throw new NotFoundException('La codificación seleccionada no existe.');
    }

    return codificacion;
  }

  private async validarPersona(idPersona: string): Promise<PersonaCi> {
    const persona = await this.personaRepository.findOne({
      where: {
        id: idPersona,
        activo: true,
      },
    });

    if (!persona) {
      throw new NotFoundException('La persona seleccionada no existe.');
    }

    return persona;
  }

  /**
   * Resuelve quién deja el mineral: persona registrada, actor productivo o
   * un externo identificado solo por su nombre. Devuelve los tres campos tal
   * como se guardan (a lo sumo un id; el nombre siempre presente).
   */
  private async resolverProveedor(dto: CreateRecepcionMineralDto): Promise<{
    idPersona: string | null;
    idActorProductivoMinero: string | null;
    nombresApellidos: string;
  }> {
    const idPersona = dto.idPersona ? String(dto.idPersona) : null;
    const idActor = dto.idActorProductivoMinero
      ? String(dto.idActorProductivoMinero)
      : null;

    if (idPersona && idActor) {
      throw new BadRequestException(
        'El proveedor es una persona o un actor productivo, no ambos.',
      );
    }

    if (idPersona) {
      const persona = await this.validarPersona(idPersona);
      return {
        idPersona,
        idActorProductivoMinero: null,
        nombresApellidos: [
          persona.nombres,
          persona.apellidoPaterno,
          persona.apellidoMaterno,
        ]
          .filter(Boolean)
          .join(' ')
          .trim()
          .toUpperCase(),
      };
    }

    if (idActor) {
      const actor = await this.dataSource.manager.findOne(
        ActorProductivoMinero,
        { where: { id: idActor, activo: true } },
      );
      if (!actor) {
        throw new NotFoundException(
          'El actor productivo seleccionado no existe.',
        );
      }
      return {
        idPersona: null,
        idActorProductivoMinero: idActor,
        nombresApellidos: (actor.nombre ?? '').trim().toUpperCase(),
      };
    }

    const nombre = (dto.nombresApellidos ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
    if (!nombre) {
      throw new BadRequestException(
        'Debe indicar el proveedor: una persona, un actor productivo o el nombre de un externo.',
      );
    }
    return {
      idPersona: null,
      idActorProductivoMinero: null,
      nombresApellidos: nombre,
    };
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
   * Si la recepción ya tiene un recibo de anticipo vigente (BORRADOR o
   * PROCESADO), no se puede cambiar el monto ni el proveedor: el recibo se
   * generó con esos datos.
   */
  private async validarAnticipoSinReciboVigente(
    recepcion: RecepcionMineral,
    nuevoAnticipo: number,
    nuevoProveedor: {
      idPersona: string | null;
      idActorProductivoMinero: string | null;
      nombresApellidos: string;
    },
  ): Promise<void> {
    const mismoProveedor =
      String(recepcion.idPersona ?? '') ===
        String(nuevoProveedor.idPersona ?? '') &&
      String(recepcion.idActorProductivoMinero ?? '') ===
        String(nuevoProveedor.idActorProductivoMinero ?? '') &&
      // Entre externos, el proveedor es el nombre.
      (!!recepcion.idPersona ||
        !!recepcion.idActorProductivoMinero ||
        (recepcion.nombresApellidos ?? '') === nuevoProveedor.nombresApellidos);
    const cambio =
      Number(recepcion.anticipo ?? 0) !== nuevoAnticipo || !mismoProveedor;
    if (!cambio) return;

    const recibo = await this.dataSource.manager.findOne(Recibo, {
      where: {
        idRecepcionMineral: recepcion.id,
        estado: In(['BORRADOR', 'PROCESADO']),
      },
    });
    if (recibo) {
      throw new BadRequestException(
        `El anticipo ya tiene el recibo ${recibo.serie}-${recibo.numero} (${recibo.estado}): no se puede modificar el monto ni el proveedor.${recibo.estado === 'BORRADOR' ? ' Anule el recibo primero.' : ''}`,
      );
    }
  }

  async create(
    createDto: CreateRecepcionMineralDto,
    user: Usuario,
  ): Promise<RecepcionMineral> {
    const {
      idCodificacion,
      numeroSacos,
      balanzaL,
      balanzaT,
      anticipo,
      //totalValorBruto,
      idPersonalInterno,
      humedad,
      fechaRecepcion,
      observaciones,
      lugarAcopio,
      idLaboratorio,
      // detalles,
    } = createDto;

    // Validar codificación
    const codificacion = await this.validarCodificacion(idCodificacion);

    // Validar proveedor (persona, actor productivo o externo)
    const proveedor = await this.resolverProveedor(createDto);

    // Validar laboratorio (opcional)
    if (idLaboratorio) {
      await this.validarLaboratorio(idLaboratorio);
    }

    // Validar detalle
    //await this.validarDetalleRecepcion(idCodificacion, detalles);

    // Obtener correlativo
    const correlativo = await this.obtenerSiguienteCorrelativo();

    // Generar código
    const codigoOperacion = this.generarCodigoOperacion(
      codificacion.codigo,
      correlativo,
    );

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const recepcion = queryRunner.manager.create(RecepcionMineral, {
        correlativo: correlativo.toString(),
        codigoOperacion,
        idCodificacion,
        ...proveedor,
        numeroSacos: numeroSacos ?? 0,
        balanzaL,
        balanzaT,
        anticipo,
        idPersonalInterno,
        humedad,
        //totalValorBruto,
        fechaRecepcion,
        lugarAcopio,
        idLaboratorio: idLaboratorio || null,
        observaciones,
        idEstado: 1,
        usuarioRegistro: user.usuario,
      });

      const registro = await queryRunner.manager.save(recepcion);

      // await this.guardarDetalleRecepcion(
      //   queryRunner,
      //   registro.id,
      //   detalles,
      //   user,
      // );

      await queryRunner.commitTransaction();

      return await this.obtenerRecepcionCompleta(registro.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    updateDto: UpdateRecepcionMineralDto,
    user: Usuario,
  ): Promise<RecepcionMineral> {
    const {
      id,
      idCodificacion,
      numeroSacos,
      balanzaL,
      balanzaT,
      anticipo,
      idPersonalInterno,
      humedad,
      // totalValorBruto,
      fechaRecepcion,
      observaciones,
      lugarAcopio,
      idLaboratorio,
      //detalles,
    } = updateDto;

    // Buscar recepción
    const recepcion = await this.obtenerRecepcion(id);

    // Validar que pueda modificarse
    this.validarRecepcionEditable(recepcion);

    // Validar codificación
    const codificacion = await this.validarCodificacion(idCodificacion);

    // Validar proveedor (persona, actor productivo o externo)
    const proveedor = await this.resolverProveedor(updateDto);

    // Validar laboratorio (opcional)
    if (idLaboratorio) {
      await this.validarLaboratorio(idLaboratorio);
    }

    // Anticipo/proveedor bloqueados si ya hay un recibo vigente
    await this.validarAnticipoSinReciboVigente(
      recepcion,
      Number(anticipo ?? recepcion.anticipo ?? 0),
      proveedor,
    );

    // Validar detalle
    // await this.validarDetalleRecepcion(idCodificacion, detalles);

    // Regenerar código manteniendo correlativo
    const codigoOperacion = this.generarCodigoOperacion(
      codificacion.codigo,
      Number(recepcion.correlativo),
    );

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(RecepcionMineral, id, {
        idCodificacion,
        codigoOperacion,

        ...proveedor,
        numeroSacos: numeroSacos ?? 0,
        balanzaL,
        balanzaT,
        anticipo,
        idPersonalInterno,
        humedad,
        // totalValorBruto,
        fechaRecepcion,
        lugarAcopio,
        // undefined = no se toca; null o '' = se quita el laboratorio
        idLaboratorio: idLaboratorio === undefined ? undefined : idLaboratorio || null,
        observaciones,
        usuarioUltimaModificacion: user.usuario,
      });

      // await this.inactivarDetalleRecepcion(queryRunner, id.toString(), user);

      // await this.guardarDetalleRecepcion(
      //   queryRunner,
      //   id.toString(),
      //   detalles,
      //   user,
      // );

      await queryRunner.commitTransaction();

      return await this.obtenerRecepcionCompleta(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cambiarEstado(
    id: string,
    idEstado: number,
    user: Usuario,
  ): Promise<RecepcionMineral> {
    const recepcion = await this.obtenerRecepcion(id);
    this.validarRecepcionEditable(recepcion);
    const estado = await this.estadoRepository.findOne({
      where: {
        id: idEstado,
        activo: true,
      },
    });
    if (!estado) {
      throw new NotFoundException('El estado seleccionado no existe.');
    }
    recepcion.idEstado = idEstado;
    recepcion.usuarioUltimaModificacion = user.usuario;
    await this.recepcionRepository.save(recepcion);

    return await this.obtenerRecepcionCompleta(id);
  }

  ///-------------------------------------FILTROS--------------------------

  async findAllRM(
    filtros: FiltrosRegistroMineralDto,
  ): Promise<RegistrosMineralPaginadosDto> {
    const { page = 1, limit = 10 } = filtros;
    const query = this.buildRecepcionMineralQuery(filtros);
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

  async findAllRMReporte(
    filtros: FiltrosRegistroMineralDto,
  ): Promise<RecepcionMineral[]> {
    const query = this.buildRecepcionMineralQuery(filtros);

    return await query.getMany();
  }

  private buildRecepcionMineralQuery(
    filtros: FiltrosRegistroMineralDto,
  ): SelectQueryBuilder<RecepcionMineral> {
    const {
      busqueda,
      codigoOperacion,
      idCodificacion,
      idEstado,
      orderBy = 'fechaRecepcion',
      orderDirection = 'DESC',
    } = filtros;
    const query = this.recepcionRepository
      .createQueryBuilder('recepcion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect('recepcion.actorProductivoMinero', 'actorProveedor')
      .leftJoinAndSelect('recepcion.personalInterno', 'personalInterno')
      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')
      .leftJoinAndSelect('recepcion.estado', 'estado')
      .leftJoinAndSelect('recepcion.laboratorio', 'laboratorio')
      .leftJoinAndSelect('recepcion.recibos', 'recibo', "recibo.estado <> 'ANULADO'");

    // .leftJoinAndSelect(
    //   'recepcion.detalles',
    //   'detalle',
    //   'detalle.activo = :activoDetalle',
    //   {
    //     activoDetalle: true,
    //   },
    // )

    //.leftJoinAndSelect('detalle.mineral', 'mineral');

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
        OR recepcion.nombresApellidos ILIKE :busqueda
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
    // Codificación (ej. ICC)
    //---------------------------------------------------------

    if (idCodificacion) {
      query.andWhere('recepcion.idCodificacion = :idCodificacion', {
        idCodificacion,
      });
    }

    //---------------------------------------------------------
    // Estado
    //---------------------------------------------------------

    if (idEstado) {
      query.andWhere('recepcion.idEstado = :idEstado', {
        idEstado,
      });
    }

    //---------------------------------------------------------
    // Rango de fechas: explícito (fechaDesde/fechaHasta) o
    // fraccionado por mes/semana ISO (anio + mes | anio + semana).
    //---------------------------------------------------------

    const { desde, hasta } = resolverRangoFechas(filtros);

    if (desde) {
      query.andWhere('recepcion.fechaRecepcion ::timestamptz >= :fechaDesde', {
        fechaDesde: desde,
      });
    }

    if (hasta) {
      query.andWhere('recepcion.fechaRecepcion ::timestamptz <= :fechaHasta', {
        fechaHasta: hasta,
      });
    }

    //---------------------------------------------------------
    // Ordenamiento
    //---------------------------------------------------------

    aplicarOrden(
      query,
      {
        id: 'recepcion.id',
        codigoOperacion: 'recepcion.codigoOperacion',
        fechaRecepcion: 'recepcion.fechaRecepcion',
        numeroDocumento: 'persona.numeroDocumento',
        estado: 'estado.nombre',
      },
      orderBy,
      orderDirection,
    );
    return query;
  }

  async buscarregistroById(id: string): Promise<RecepcionMineral> {
    return await this.recepcionRepository
      .createQueryBuilder('recepcion')
      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect('recepcion.actorProductivoMinero', 'actorProveedor')
      .leftJoinAndSelect('recepcion.personalInterno', 'personalInterno')
      .leftJoinAndSelect('recepcion.estado', 'estado')
      .leftJoinAndSelect('recepcion.laboratorio', 'laboratorio')
      .leftJoinAndSelect('recepcion.recibos', 'recibo', "recibo.estado <> 'ANULADO'")
      // .leftJoinAndSelect('recepcion.estado', 'estado')
      .where('recepcion.id = :id', { id })
      .getOne();
  }

  /**
   * Comprobante RM- de la recepción (constancia de entrega del mineral, sin
   * montos). Se emite para toda recepción, tenga o no anticipo.
   */
  async generarComprobanteRecepcionPdf(
    id: string,
    user: Usuario,
  ): Promise<{ pdf: Buffer; numero: string }> {
    const recepcion = await this.buscarregistroById(id);

    if (!recepcion) {
      throw new NotFoundException('La recepción no existe.');
    }

    return {
      pdf: await this.reciboPdfService.generar(recepcion, user),
      numero: this.reciboPdfService.numeroComprobante(recepcion),
    };
  }
}
