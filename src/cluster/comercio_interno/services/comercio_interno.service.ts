import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Codificacion } from 'src/cluster/parametricas/entities/codificacion.entity';
import { PersonaCi } from '../entities/persona-ci.entity';
import { PersonaTipo } from '../../parametricas/entities/persona-tipo.entity';
import { PersonaPersonaTipo } from '../entities/persona-persona-tipo.entity';
import { RecepcionMineral } from '../entities/recepcion-mineral.entity';
import { EstadoRegistro } from 'src/cluster/parametricas/entities/estado-registro.entity';
import { ConfigService } from '@nestjs/config';
import { CreateRecepcionMineralDto } from '../dto/create-recepcion-mineral.dto';
import { UpdateRecepcionMineralDto } from '../dto/update-recepcion-mineral.dto';
import { EstadoRecepcion } from 'src/cluster/enum/estado-recepcion.enum';
import { FiltrosRegistroMineralDto } from '../dto/filtros-registro-mineral.dto';

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

    @InjectRepository(PersonaPersonaTipo, 'ci')
    private readonly personaPersonaTipoRepository: Repository<PersonaPersonaTipo>,

    @InjectRepository(EstadoRegistro, 'ci')
    private readonly estadoRepository: Repository<EstadoRegistro>,

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
    const longitud = Number(this.configService.get('CORRELATIVO_LONGITUD', 6));

    return `${codigo}-${correlativo.toString().padStart(longitud, '0')}`;
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

  private async validarProveedor(idPersona: string): Promise<PersonaCi> {
    const persona = await this.personaRepository.findOne({
      where: {
        id: idPersona,
        activo: true,
      },
    });

    if (!persona) {
      throw new NotFoundException('La persona seleccionada no existe.');
    }

    const esProveedor = await this.personaPersonaTipoRepository
      .createQueryBuilder('ppt')
      .innerJoin('ppt.personaTipo', 'tipo')
      .where('ppt.idPersona = :idPersona', {
        idPersona,
      })
      .andWhere('tipo.codigo = :codigo', {
        codigo: 'PROV',
      })
      .andWhere('ppt.activo = true')
      .getOne();

    if (!esProveedor) {
      throw new BadRequestException(
        'La persona seleccionada no está registrada como proveedor.',
      );
    }

    return persona;
  }

  async create(
    createDto: CreateRecepcionMineralDto | UpdateRecepcionMineralDto,
  ): Promise<RecepcionMineral> {
    if ((createDto as UpdateRecepcionMineralDto).id) {
      return this.update(createDto as UpdateRecepcionMineralDto);
    }

    const {
      idCodificacion,
      idPersona,
      numeroSacos,
      pesoNeto,
      anticipo,
      ley,
      totalValorBruto,
      fechaOperacion,
      observaciones,
    } = createDto;

    // Validar codificación
    const codificacion = await this.validarCodificacion(idCodificacion);

    // Validar persona
    // Validar que la persona sea proveedor
    await this.validarProveedor(idPersona);

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
        idPersona,
        numeroSacos,
        pesoNeto,
        anticipo,
        ley,
        totalValorBruto,
        fechaOperacion,
        observaciones,
        idEstado: 1,
      });

      const registro = await queryRunner.manager.save(recepcion);

      await queryRunner.commitTransaction();

      return await this.recepcionRepository.findOne({
        where: {
          id: registro.id,
        },
        relations: {
          codificacion: true,
          persona: true,
          estado: true,
        },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    updateDto: UpdateRecepcionMineralDto,
  ): Promise<RecepcionMineral> {
    const {
      id,
      idCodificacion,
      idPersona,
      numeroSacos,
      pesoNeto,
      anticipo,
      ley,
      totalValorBruto,
      fechaOperacion,
      observaciones,
    } = updateDto;

    // Buscar recepción
    const recepcion = await this.obtenerRecepcion(id);

    // Validar que pueda modificarse
    this.validarRecepcionEditable(recepcion);

    // Validar codificación
    const codificacion = await this.validarCodificacion(idCodificacion);

    // Validar proveedor
    await this.validarProveedor(idPersona);

    // Regenerar el código de operación manteniendo el correlativo
    const codigoOperacion = this.generarCodigoOperacion(
      codificacion.codigo,
      //recepcion.correlativo,
      Number(recepcion.correlativo)
    );

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(RecepcionMineral, id, {
        idCodificacion,
        codigoOperacion,
        idPersona,
        numeroSacos,
        pesoNeto,
        anticipo,
        ley,
        totalValorBruto,
        fechaOperacion,
        observaciones,
      });

      await queryRunner.commitTransaction();

      return await this.recepcionRepository.findOne({
        where: {
          id,
        },
        relations: {
          codificacion: true,
          persona: true,
          estado: true,
        },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }











  async cambiarEstado(id: string, idEstado: number): Promise<RecepcionMineral> {
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
    await this.recepcionRepository.save(recepcion);
    return await this.recepcionRepository.findOne({
      where: { id },
      relations: {
        codificacion: true,
        persona: true,
        estado: true,
      },
    });
  }





///-------------------------------------FILTROS--------------------------

  async findAllRM(filtros: FiltrosRegistroMineralDto) {
    const {
      page = 1,
      limit = 10,
      busqueda,
      numeroDocumento,
      idEstado,
      fechaDesde,
      fechaHasta,
    } = filtros;

    // Construir query con relaciones
    const query = this.recepcionRepository
      .createQueryBuilder('recepcion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')
      .leftJoinAndSelect('recepcion.estado', 'estado')
      .orderBy('recepcion.fechaOperacion', 'DESC');

    // -- Filtros --

    // Búsqueda por nombre/apellido/documento de la persona
    if (busqueda) {
      query.andWhere(
        `(
          persona.nombres ILIKE :busqueda OR
          persona.apellidoPaterno ILIKE :busqueda OR
          persona.apellidoMaterno ILIKE :busqueda OR
          persona.numeroDocumento ILIKE :busqueda
        )`,
        { busqueda: `%${busqueda}%` },
      );
    }

    // Documento exacto (o parcial) de la persona
    if (numeroDocumento) {
      query.andWhere('persona.numeroDocumento ILIKE :numeroDocumento', {
        numeroDocumento: `%${numeroDocumento}%`,
      });
    }

    // Estado (por ID)
    if (idEstado !== undefined && idEstado !== null) {
      query.andWhere('recepcion.idEstado = :idEstado', { idEstado });
    }

    // Rango de fechas (fechaOperacion)
    if (fechaDesde) {
      query.andWhere('recepcion.fechaOperacion >= :fechaDesde', { fechaDesde });
    }
    if (fechaHasta) {
      query.andWhere('recepcion.fechaOperacion <= :fechaHasta', { fechaHasta });
    }

    // Paginación
    query.skip((page - 1) * limit);
    query.take(limit);

    // Ejecutar
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
