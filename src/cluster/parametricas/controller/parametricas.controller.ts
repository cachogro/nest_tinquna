import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateCodificacionDto } from '../dto/create-codificacion.dto';
import { Codificacion } from '../entities/codificacion.entity';
import { CodificacionService } from '../services/codificacion.service';
import { Auth, GetUser } from 'src/security/decorators';
import { UpdateCodificacionDto } from '../dto/update-codificacion.dto';
import {
  EmisionDocumentoResponseDto,
  TipoDocumentoResponseDto,
} from '../dto/parametrica-response.dto';
import { ParametricasService } from '../services/parametricas.service';
import { Mineral } from '../entities/mineral.entity';
import { PersonaTipo } from '../entities/persona-tipo.entity';
import { CotizacionMineral } from '../entities/cotizacion-mineral.entity';
import { CreateCotizacionMineralDto } from '../dto/cotizacion-mineral/create-cotizacion-mineral.dto';
import { CotizacionMineralService } from '../services/cotizacion-mineral.service';
import { UpdateCotizacionMineralDto } from '../dto/cotizacion-mineral/update-cotizacion-mineral.dto';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltrosCotizacionDto } from '../dto/cotizacion-mineral/filtros-cotizacion.dto';
import { CotizacionesPaginadasDto } from '../dto/cotizacion-mineral/cotizacion-paginacion.dto';

import { FiltrosActorProductivoMineroDto } from '../dto/ingenios/filtros-actor-productivo-minero.dto';
import { ActoresProductivosMinerosPaginadosDto } from '../dto/ingenios/actor-productivo-minero-paginacion.dto';
import { ActorProdMineroService } from '../services/actor-productivo-minero.service';
import { ActorProductivoMinero } from '../entities/actor-productivo-minero.entity';
import { UpdateActorProductivoMineroDto } from '../dto/ingenios/update-actor-productivo-minero.dto';
import { TipoActorProductivoMinero } from '../entities/tipo-actor-productivo-minero.entity';
import { Laboratorio } from '../entities/laboratorio.entity';
import { CreateLaboratorioDto } from '../dto/laboratorio/create-laboratorio.dto';
import { UpdateLaboratorioDto } from '../dto/laboratorio/update-laboratorio.dto';
import { LaboratorioService } from '../services/laboratorio.service';
import { CambiarEstadoLaboratorioDto } from '../dto/laboratorio/cambiar-estado-laboratorio.dto';

@ApiTags('Paramétrica - Codificación')
@Controller('parametricas')
export class ParametricasController {
  constructor(
    private readonly codificacionService: CodificacionService,
    private readonly parametricaService: ParametricasService,

    private readonly cotizacionMineralService: CotizacionMineralService,
    private readonly actorProdMineroService: ActorProdMineroService,
    private readonly laboratorioService: LaboratorioService,
  ) {}

  @Post('codificacion')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar una nueva codificación',
    description:
      'Permite registrar una nueva codificación asociando uno o varios minerales existentes.',
  })
  @ApiBody({
    type: CreateCodificacionDto,
    description: 'Datos necesarios para registrar una codificación.',
    examples: {
      ejemplo: {
        summary: 'Nueva codificación',
        value: {
          codigo: 'BZI',
          nombre: 'PLATA Y ZINC',
          minerales: [1, 3],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Codificación registrada correctamente.',
    type: Codificacion,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, código duplicado o minerales inexistentes.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiConflictResponse({
    description: 'Ya existe una codificación con ese código.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async create(
    @Body() createCodificacionDto: CreateCodificacionDto,
    @GetUser() user: Usuario,
  ): Promise<Codificacion> {
    return await this.codificacionService.create(createCodificacionDto, user);
  }

  @Put('codificacion')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar una codificación',
    description:
      'Actualiza una codificación existente utilizando el identificador enviado en el cuerpo de la petición.',
  })
  @ApiBody({
    type: UpdateCodificacionDto,
    description: 'Datos de la codificación a actualizar.',
    examples: {
      ejemplo: {
        summary: 'Actualizar codificación',
        value: {
          id: '1',
          codigo: 'BZI',
          nombre: 'PLATA Y ZINC',
          minerales: [1, 3],
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Codificación actualizada correctamente.',
    type: Codificacion,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, código duplicado o minerales inexistentes.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async update(
    @Body() updateCodificacionDto: UpdateCodificacionDto,
    @GetUser() user: Usuario,
  ): Promise<Codificacion> {
    return await this.codificacionService.update(updateCodificacionDto, user);
  }

  @Get('allCodificacion')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todas las codificaciones',
    description:
      'Retorna una lista completa de las codificaciones registradas en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de codificaciones obtenida exitosamente.',
    type: [Codificacion],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllCodificaciones(): Promise<Codificacion[]> {
    return await this.codificacionService.findAllCodificaciones();
  }

  @Get('tiposDocumento')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los tipos de documento',
    description:
      'Retorna una lista completa de los tipos de documento registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de documento obtenida exitosamente.',
    type: [TipoDocumentoResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllTipoDocumentos(): Promise<TipoDocumentoResponseDto[]> {
    return await this.parametricaService.findAllTipoDocumentos();
  }

  @Get('lugaresEmision')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los lugares de emisión',
    description:
      'Retorna una lista completa de los lugares de emisión registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de lugares de emisión obtenida exitosamente.',
    type: [EmisionDocumentoResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllLugaresEmision(): Promise<EmisionDocumentoResponseDto[]> {
    return await this.parametricaService.findAllLugaresEmision();
  }

  @Get('allMinerales')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los minerales',
    description:
      'Retorna una lista completa de los minerales registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de lugares de emisión obtenida exitosamente.',
    type: [Mineral],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllMinerales(): Promise<Mineral[]> {
    return await this.parametricaService.findAllMinerales();
  }

  @Get('allPersonaTipo')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los minerales',
    description:
      'Retorna una lista completa de los minerales registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de lugares de emisión obtenida exitosamente.',
    type: [PersonaTipo],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllPersinaTipo(): Promise<PersonaTipo[]> {
    return await this.parametricaService.findAllPersonaTipo();
  }

  //------------------ crear cotizacion ----------------------

  @Post('cotizacion')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar una nueva cotización de mineral',
    description:
      'Permite registrar una nueva cotización para un mineral. Solo puede existir una cotización vigente por mineral.',
  })
  @ApiBody({
    type: CreateCotizacionMineralDto,
    description: 'Datos necesarios para registrar una cotización.',
    examples: {
      ejemplo: {
        summary: 'Nueva cotización',
        value: {
          idMineral: 1,
          cotizacionMineralDolares: 3125.45896,
          alicuotaExterna: 4.5,
          alicuotaInterna: 3.2,
          fechaVigenciaFinal: '2026-07-31',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Cotización registrada correctamente.',
    type: CotizacionMineral,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, existe una cotización vigente o la fecha de vigencia es incorrecta.',
  })
  @ApiNotFoundResponse({
    description: 'El mineral seleccionado no existe o se encuentra inactivo.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiConflictResponse({
    description:
      'Conflicto al registrar la cotización debido a reglas de negocio.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createCotizacion(
    @Body() body: CreateCotizacionMineralDto | UpdateCotizacionMineralDto,
    @GetUser() user: Usuario,
  ): Promise<CotizacionMineral> {
    if ('id' in body && body.id) {
      return await this.cotizacionMineralService.update(
        body as UpdateCotizacionMineralDto,
        user,
      );
    } else {
      return await this.cotizacionMineralService.create(
        body as CreateCotizacionMineralDto,
        user,
      );
    }
  }
  // -------filtrado y paginado---------------
  @Get('cotizacion')
  @Auth()
  @ApiOperation({
    summary: 'Listar cotizaciones',
    description:
      'Obtiene el listado completo de cotizaciones registradas de todos los minerales.',
  })
  @ApiOkResponse({
    description: 'Listado obtenido correctamente.',
    type: [CotizacionMineral],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAll(): Promise<CotizacionMineral[]> {
    return await this.cotizacionMineralService.findAll();
  }

  @Get('cotizacionPag')
  @Auth()
  @ApiOperation({
    summary: 'Listado paginado de cotizaciones de minerales',
    description:
      'Obtiene un listado paginado de cotizaciones de minerales con filtros por mineral, búsqueda, vigencia y estado.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'idMineral',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'vigente',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiQuery({
    name: 'activo',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiOkResponse({
    description: 'Listado paginado obtenido correctamente.',
    type: CotizacionesPaginadasDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllCotizaciones(@Query() filtros: FiltrosCotizacionDto) {
    return await this.cotizacionMineralService.findAllCotizacion(filtros);
  }

  //--------------------------------Actor productivo minero ------------------------------------
  //---------------------------------------------------------------------------

  @Post('actor-productivo-minero')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un actor productivo minero',
    description:
      'Si no se envía el campo id se registra un nuevo actor productivo minero. Si se envía el id, se actualiza el registro correspondiente.',
  })
  @ApiBody({
    type: UpdateActorProductivoMineroDto,
    description: 'Datos del actor productivo minero.',
    examples: {
      crearIngenio: {
        summary: 'Registrar Ingenio',
        value: {
          idTipoActorProductivoMinero: 1,
          nombre: 'Ingenio Minero San Cristóbal',
          direccion: 'Carretera Uyuni - Atocha Km. 35',
          telefono: '72451234',
        },
      },
      crearCooperativa: {
        summary: 'Registrar Cooperativa',
        value: {
          idTipoActorProductivoMinero: 2,
          nombre: 'Cooperativa Minera Chorolque',
          direccion: 'Atocha - Potosí',
          telefono: '72459876',
        },
      },
      actualizar: {
        summary: 'Actualizar Actor Productivo Minero',
        value: {
          id: 1,
          idTipoActorProductivoMinero: 1,
          nombre: 'Ingenio Minero San Cristóbal',
          direccion: 'Av. Industrial N° 123',
          telefono: '72450000',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Actor productivo minero registrado o actualizado correctamente.',
    type: ActorProductivoMinero,
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró el actor productivo minero o el tipo de actor productivo minero seleccionado.',
  })
  @ApiConflictResponse({
    description:
      'Ya existe un actor productivo minero registrado con ese nombre.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createActorProductivoMinero(
    @Body() body: UpdateActorProductivoMineroDto,
    @GetUser() user: Usuario,
  ): Promise<ActorProductivoMinero> {
    if (body.id) {
      return await this.actorProdMineroService.update(body, user);
    }

    return await this.actorProdMineroService.create(body, user);
  }

  //cambiar de estado

  @Patch('actor-productivo-minero/cambiar_estado/:id')
  @Auth()
  @ApiResponse({
    status: 201,
    description: 'Servicio para cambiar de estado de una persona',
  })
  async changeStateUser(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
    // console.log('entraaaaaaaaaaa  id', id);
    return this.actorProdMineroService.cambiarEstadoIngenio(id, activo, user);
  }
  //----------filtros y busqueda:

  @Get('actor-productivo-minero')
  @Auth()
  @ApiOperation({
    summary: 'Listado paginado de actores productivos mineros',
    description:
      'Obtiene un listado paginado de actores productivos mineros con filtros por nombre, tipo de actor, estado y ordenamiento.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'idTipoActorProductivoMinero',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'activo',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: [
      'id',
      'nombre',
      'direccion',
      'telefono',
      'tipoActorProductivoMinero',
    ],
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    enum: ['ASC', 'DESC'],
  })
  @ApiOkResponse({
    description: 'Listado paginado obtenido correctamente.',
    type: ActoresProductivosMinerosPaginadosDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllAPM(@Query() filtros: FiltrosActorProductivoMineroDto) {
    return await this.actorProdMineroService.findAll(filtros);
  }

  @Get('actor-productivo-minero/allTipoActor')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los minerales',
    description:
      'Retorna una lista completa de los minerales registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de lugares de emisión obtenida exitosamente.',
    type: [PersonaTipo],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAlltipoActorPrdcMinero(): Promise<TipoActorProductivoMinero[]> {
    return await this.parametricaService.findAlltipoActorPrdcMinero();
  }

  @Get('actor-productivo-minero/allActorMineros')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los minerales',
    description:
      'Retorna una lista completa de los minerales registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de lugares de emisión obtenida exitosamente.',
    type: [ActorProductivoMinero],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllActorPrdcMinero(): Promise<ActorProductivoMinero[]> {
    return await this.actorProdMineroService.findAllActorPrdcMinero();
  }

  //---------------------------------------------------------------------------
  //                        Laboratorios
  //---------------------------------------------------------------------------

  @Post('laboratorio')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un laboratorio',
    description:
      'Si no se envía el campo id se registra un nuevo laboratorio. Si se envía el id, se actualiza el laboratorio correspondiente.',
  })
  @ApiBody({
    description: 'Datos del laboratorio.',
    examples: {
      crear: {
        summary: 'Registrar laboratorio',
        value: {
          nombre: 'Laboratorio Químico Potosí',
          direccion: 'Av. Universitaria N° 123',
          telefono: '62451234',
        },
      },
      actualizar: {
        summary: 'Actualizar laboratorio',
        value: {
          id: 1,
          nombre: 'Laboratorio Químico Potosí',
          direccion: 'Zona Central',
          telefono: '62459999',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Laboratorio registrado o actualizado correctamente.',
    type: Laboratorio,
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiConflictResponse({
    description: 'Ya existe un laboratorio registrado con ese nombre.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createLaboratorio(
    @Body()
    body: CreateLaboratorioDto | UpdateLaboratorioDto,
    @GetUser() user: Usuario,
  ): Promise<Laboratorio> {
    if ('id' in body && body.id) {
      return await this.laboratorioService.update(
        body as UpdateLaboratorioDto,
        user,
      );
    }

    return await this.laboratorioService.create(
      body as CreateLaboratorioDto,
      user,
    );
  }

  @Patch('laboratorio/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de un laboratorio',
    description:
      'Permite activar o desactivar un laboratorio mediante baja lógica.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del laboratorio.',
    example: '1',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        activo: {
          type: 'boolean',
          example: false,
        },
      },
    },
    description: 'Nuevo estado del laboratorio.',
  })
  @ApiOkResponse({
    description: 'Estado del laboratorio actualizado correctamente.',
    type: Laboratorio,
  })
  @ApiBadRequestResponse({
    description: 'El valor del estado es inválido.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el laboratorio solicitado.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStateLaboratorio(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<Laboratorio> {
    return await this.laboratorioService.cambiarEstado(id, activo, user);
  }

  @Get('laboratorio')
  @Auth()
  @ApiOperation({
    summary: 'Listar laboratorios',
    description:
      'Obtiene la lista de todos los laboratorios activos registrados en el sistema.',
  })
  @ApiOkResponse({
    description: 'Listado de laboratorios obtenido correctamente.',
    type: Laboratorio,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllLaboratorio(): Promise<Laboratorio[]> {
    return await this.laboratorioService.findAllLaboratorio();
  }
}
