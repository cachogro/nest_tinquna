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
  ApiBearerAuth,
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
import { CreateCodificacionDto } from '../dto/codificacion/create-codificacion.dto';
import { Codificacion } from '../entities/codificacion.entity';
import { CodificacionService } from '../services/codificacion.service';
import { Auth, GetUser } from 'src/security/decorators';
import { UpdateCodificacionDto } from '../dto/codificacion/update-codificacion.dto';
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

import { FiltrosActorProductivoMineroDto } from '../dto/actor-productivo-minero/filtros-actor-productivo-minero.dto';
import { ActoresProductivosMinerosPaginadosDto } from '../dto/actor-productivo-minero/actor-productivo-minero-paginacion.dto';
import { ActorProdMineroService } from '../services/actor-productivo-minero.service';
import { ActorProductivoMinero } from '../entities/actor-productivo-minero.entity';
import { UpdateActorProductivoMineroDto } from '../dto/actor-productivo-minero/update-actor-productivo-minero.dto';
import { TipoActorProductivoMinero } from '../entities/tipo-actor-productivo-minero.entity';
import { Laboratorio } from '../entities/laboratorio.entity';
import { CreateLaboratorioDto } from '../dto/laboratorio/create-laboratorio.dto';
import { UpdateLaboratorioDto } from '../dto/laboratorio/update-laboratorio.dto';
import { LaboratorioService } from '../services/laboratorio.service';
import { CambiarEstadoLaboratorioDto } from '../dto/laboratorio/cambiar-estado-laboratorio.dto';
import { EstadoValorizacion } from '../entities/estado-valorizacion.entity';
import { EstadoRegistro } from '../entities/estado-registro.entity';
import { EntidadAporte } from '../entities/entidad-aporte.entity';
import { TipoEntidadAporte } from '../entities/tipo-entidad-aporte.entity';
import { CreateEntidadAporteDto } from '../dto/entidad-aporte/create-entidad-aporte.dto';
import { UpdateEntidadAporteDto } from '../dto/entidad-aporte/update-entidad-aporte.dto';
import { EntidadAporteService } from '../services/entidad-aporte.service';
import { CreateMineralDto } from '../dto/mineral/create-mineral.dto';
import { UpdateMineralDto } from '../dto/mineral/update-mineral.dto';
import { MineralService } from '../services/mineral.service';
import { EscalaPrecioMineral } from '../entities/escala-precio-mineral.entity';
import { CreateEscalaPrecioMineralDto } from '../dto/escala-precio-mineral/create-escala-precio-mineral.dto';
import { UpdateEscalaPrecioMineralDto } from '../dto/escala-precio-mineral/update-escala-precio-mineral.dto';
import { EscalaPrecioMineralService } from '../services/escala-precio-mineral.service';
import { TipoCalculoValorizacion } from '../entities/tipo-calculo-valorizacion.entity';
import { CreateTipoCalculoValorizacionDto } from '../dto/tipo-calculo-valorizacion/create-tipo-calculo-valorizacion.dto';
import { UpdateTipoCalculoValorizacionDto } from '../dto/tipo-calculo-valorizacion/update-tipo-calculo-valorizacion.dto';
import { TipoCalculoValorizacionService } from '../services/tipo-calculo-valorizacion.service';
import { TipoCalculoValorizacionAgrupadoDto } from '../dto/tipo-calculo-valorizacion/tipo-calculo-valorizacion-agrupado.dto';

@ApiTags('Paramétricas')
@Controller('parametricas')
@ApiBearerAuth()
export class ParametricasController {
  constructor(
    private readonly codificacionService: CodificacionService,
    private readonly parametricaService: ParametricasService,

    private readonly cotizacionMineralService: CotizacionMineralService,
    private readonly actorProdMineroService: ActorProdMineroService,
    private readonly laboratorioService: LaboratorioService,
    private readonly entidadAporteService: EntidadAporteService,
    private readonly mineralService: MineralService,
    private readonly escalaPrecioMineralService: EscalaPrecioMineralService,
    private readonly tipoCalculoValorizacionService: TipoCalculoValorizacionService,
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
    description: 'Lista de minerales obtenida exitosamente.',
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
    summary: 'Obtener todos los tipos de persona',
    description:
      'Retorna una lista completa de los tipos de persona registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de persona obtenida exitosamente.',
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
    summary: 'Registrar o actualizar una cotización de mineral',
    description:
      'Si el body no incluye "id", registra una nueva cotización para el mineral indicado (solo puede existir una cotización vigente por mineral). ' +
      'Si el body incluye "id", actualiza la cotización correspondiente (no se puede modificar una cotización que ya venció). ' +
      '"fechaVigenciaInicial" nunca se envía: el backend la fija automáticamente con el instante exacto del servidor al crear. ' +
      '"fechaVigenciaFinal" se envía solo como fecha ("YYYY-MM-DD"); el backend la normaliza internamente al fin de ese día (23:59:59.999, hora de Bolivia UTC-4). ' +
      'Si "alicuotaExterna"/"alicuotaInterna" se omiten al crear, se heredan de la última cotización registrada para ese mineral.',
  })
  @ApiBody({
    type: CreateCotizacionMineralDto,
    description:
      'Datos para crear (sin "id") o actualizar (con "id") una cotización.',
    examples: {
      crear: {
        summary: 'Crear cotización con alícuotas explícitas',
        value: {
          idMineral: 1,
          cotizacionMineralDolares: 3125.45896,
          alicuotaExterna: 4.5,
          alicuotaInterna: 3.2,
          fechaVigenciaFinal: '2026-07-31',
        },
      },
      crearHeredandoAlicuotas: {
        summary: 'Crear cotización heredando alícuotas de la última registrada',
        description:
          'Al omitir alicuotaExterna/alicuotaInterna, se copian de la última cotización del mineral. Falla si el mineral nunca tuvo una cotización previa.',
        value: {
          idMineral: 1,
          cotizacionMineralDolares: 3125.45896,
          fechaVigenciaFinal: '2026-07-31',
        },
      },
      actualizar: {
        summary: 'Actualizar cotización existente',
        description:
          'Se envía "id" y solo los campos a modificar. "idMineral" no es editable.',
        value: {
          id: 42,
          cotizacionMineralDolares: 3200,
          alicuotaExterna: 5,
          alicuotaInterna: 3.5,
          fechaVigenciaFinal: '2026-08-15',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Cotización registrada o actualizada correctamente. "fechaVigenciaInicial" y "fechaVigenciaFinal" se devuelven como timestamp con zona horaria (ej: "2026-08-03T15:42:10.123-04:00").',
    type: CotizacionMineral,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos: ya existe una cotización vigente para el mineral, la fecha de vigencia final es anterior a hoy, la cotización a actualizar ya no está vigente, o faltan alícuotas y el mineral no tiene cotización previa de la cual heredarlas.',
  })
  @ApiNotFoundResponse({
    description:
      'El mineral seleccionado no existe o se encuentra inactivo (al crear), o la cotización indicada por "id" no existe (al actualizar).',
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
      return await this.cotizacionMineralService.update(body, user);
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
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['id', 'mineral', 'fechaVigenciaInicial', 'fechaVigenciaFinal'],
    description: 'Columna de ordenamiento (default: id).',
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Dirección de ordenamiento (default: DESC).',
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

  @Get('cotizacion/vigente/:idMineral')
  @Auth()
  @ApiOperation({
    summary: 'Obtener la cotización vigente de un mineral',
    description:
      'Devuelve la cotización actualmente vigente (activa, dentro de su rango de fechas comparado contra el instante exacto de la petición) para el mineral indicado. Se usa para validar antes de operar con un mineral (ej. valorización) que su cotización no haya vencido.',
  })
  @ApiParam({
    name: 'idMineral',
    description: 'Identificador del mineral.',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Cotización vigente obtenida correctamente.',
    type: CotizacionMineral,
  })
  @ApiNotFoundResponse({
    description: 'El mineral no tiene una cotización vigente en este momento.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findCotizacionVigenteByMineral(
    @Param('idMineral', ParseIntPipe) idMineral: number,
  ): Promise<CotizacionMineral> {
    return await this.cotizacionMineralService.findVigenteByMineral(idMineral);
  }

  //------------------ escala de precio por ley (Zn, Ag, Pb...) ----------------------

  @Post('escala-precio')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cargar en bloque la tabla de precios por ley de un mineral',
    description:
      'Registra todos los tramos de ley de un mineral en una sola inserción. ' +
      '"idMineral", "fechaVigenciaInicial" y "fechaVigenciaFinal" son ' +
      'compartidos por toda la carga; cada fila solo aporta "ley", ' +
      '"precioPunto" y "precioTm" (el front calcula y envía precioTm). Si la ' +
      'nueva vigencia se solapa con tramos activos existentes del mismo ' +
      'mineral, esos tramos quedan reemplazados: se desactivan por completo ' +
      '(activo=false), sin importar si les quedaban días de vigencia propia. ' +
      'No depende de "cotizacion".',
  })
  @ApiBody({
    type: CreateEscalaPrecioMineralDto,
    examples: {
      crear: {
        summary: 'Cargar tabla de Zinc (parcial)',
        value: {
          idMineral: 1,
          fechaVigenciaInicial: '2026-08-01T00:00:00.000-04:00',
          fechaVigenciaFinal: '2026-08-30T23:59:59.999-04:00',
          filas: [
            { ley: 6, precioPunto: 16.8, precioTm: 100.8 },
            { ley: 7, precioPunto: 19.3, precioTm: 135.1 },
            { ley: 13, precioPunto: 23.1, precioTm: 300.3 },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Tramos registrados correctamente.',
    type: [EscalaPrecioMineral],
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos: no se envió ningún tramo, hay leyes repetidas en la ' +
      'misma carga, o las fechas de vigencia son incoherentes.',
  })
  @ApiNotFoundResponse({
    description: 'El mineral seleccionado no existe o se encuentra inactivo.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createEscalaPrecio(
    @Body() body: CreateEscalaPrecioMineralDto,
    @GetUser() user: Usuario,
  ): Promise<EscalaPrecioMineral[]> {
    return await this.escalaPrecioMineralService.create(body, user);
  }

  @Patch('escala-precio')
  @Auth()
  @ApiOperation({
    summary: 'Actualizar en bloque uno o varios tramos de la escala de precio',
    description:
      'Cada fila se identifica por "id" (el que devolvió la carga inicial). ' +
      'Se puede enviar una sola fila para corregir un solo tramo, o varias a ' +
      'la vez. No se puede modificar un tramo que ya venció.',
  })
  @ApiBody({
    type: UpdateEscalaPrecioMineralDto,
    examples: {
      actualizarUno: {
        summary: 'Corregir un solo tramo',
        value: {
          filas: [{ id: 9, precioPunto: 21.1, precioTm: 99.88 }],
        },
      },
      actualizarVarios: {
        summary: 'Corregir varios tramos a la vez',
        value: {
          filas: [
            { id: 9, precioPunto: 21.1, precioTm: 99.88 },
            { id: 10, precioPunto: 21.8, precioTm: 109.0 },
          ],
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Tramos actualizados correctamente.',
    type: [EscalaPrecioMineral],
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos: algún tramo ya no está vigente o las fechas de ' +
      'vigencia resultantes son incoherentes.',
  })
  @ApiNotFoundResponse({
    description:
      'Alguno de los "id" enviados no corresponde a un tramo existente.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async updateEscalaPrecio(
    @Body() body: UpdateEscalaPrecioMineralDto,
    @GetUser() user: Usuario,
  ): Promise<EscalaPrecioMineral[]> {
    return await this.escalaPrecioMineralService.update(body, user);
  }

  @Get('escala-precio/vigente/:idMineral')
  @Auth()
  @ApiOperation({
    summary: 'Obtener la tabla de precios por ley vigente de un mineral',
    description:
      'Devuelve todos los tramos de ley cuya vigencia cubre un instante ' +
      'dado, para el mineral indicado, ordenados por ley. Si no se envía ' +
      '"fecha", usa el instante actual (equivale a la tabla vigente hoy). ' +
      'Si se envía "fecha", devuelve la tabla que estaba vigente ese día ' +
      '(útil para consultar la cotización histórica de un rango/mes pasado).',
  })
  @ApiParam({
    name: 'idMineral',
    description: 'Identificador del mineral.',
    example: 1,
  })
  @ApiQuery({
    name: 'fecha',
    required: false,
    description:
      'Fecha (ISO 8601) para consultar la tabla vigente en ese momento. Si se omite, usa el instante actual.',
    example: '2026-08-10',
  })
  @ApiOkResponse({
    description: 'Tabla vigente obtenida correctamente.',
    type: [EscalaPrecioMineral],
  })
  @ApiBadRequestResponse({
    description: 'La fecha indicada no tiene un formato válido.',
  })
  @ApiNotFoundResponse({
    description:
      'El mineral no tiene (o no tenía, en la fecha indicada) una tabla de precios vigente.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findEscalaPrecioVigenteByMineral(
    @Param('idMineral', ParseIntPipe) idMineral: number,
    @Query('fecha') fecha?: string,
  ): Promise<EscalaPrecioMineral[]> {
    return await this.escalaPrecioMineralService.findVigenteByMineral(
      idMineral,
      fecha,
    );
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
  @ApiOperation({
    summary: 'Cambiar estado de un actor productivo minero',
    description:
      'Permite activar o desactivar un actor productivo minero mediante baja lógica.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del actor productivo minero.',
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
    description: 'Nuevo estado del actor productivo minero.',
  })
  @ApiOkResponse({
    description:
      'Estado del actor productivo minero actualizado correctamente.',
  })
  @ApiBadRequestResponse({
    description: 'El valor del estado es inválido.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el actor productivo minero solicitado.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStateUser(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
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
    summary: 'Obtener todos los tipos de actor productivo minero',
    description:
      'Retorna una lista completa de los tipos de actor productivo minero registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista de tipos de actor productivo minero obtenida exitosamente.',
    type: [TipoActorProductivoMinero],
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
    summary: 'Obtener todos los actores productivos mineros',
    description:
      'Retorna una lista completa de los actores productivos mineros registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de actores productivos mineros obtenida exitosamente.',
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
      return await this.laboratorioService.update(body, user);
    }

    return await this.laboratorioService.create(body, user);
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

  //---------------------------------------------------------------------------
  //                        Entidades de aporte
  //---------------------------------------------------------------------------

  @Post('entidad-aporte')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar una entidad de aporte',
    description:
      'Si no se envía el campo id se registra una nueva entidad de aporte. Si se envía el id, se actualiza la entidad correspondiente.',
  })
  @ApiBody({
    description: 'Datos de la entidad de aporte.',
    examples: {
      crear: {
        summary: 'Registrar entidad de aporte',
        value: {
          descripcion: 'FERRECO',
          detalleAporte: [{ alicuota: 0.35, tipoBaseAporte: 'VBV' }],
          idTipoEntidadAporte: 1,
        },
      },
      actualizar: {
        summary: 'Actualizar entidad de aporte',
        value: {
          id: 6,
          descripcion: 'FERRECO',
          detalleAporte: [{ alicuota: 0.4, tipoBaseAporte: 'VNV' }],
          idTipoEntidadAporte: 1,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Entidad de aporte registrada o actualizada correctamente.',
    type: EntidadAporte,
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiConflictResponse({
    description:
      'Ya existe una entidad de aporte registrada con esa descripción.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createEntidadAporte(
    @Body()
    body: CreateEntidadAporteDto | UpdateEntidadAporteDto,
    @GetUser() user: Usuario,
  ): Promise<EntidadAporte> {
    if ('id' in body && body.id) {
      return await this.entidadAporteService.update(body, user);
    }

    return await this.entidadAporteService.create(body, user);
  }

  @Patch('entidad-aporte/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de una entidad de aporte',
    description:
      'Permite activar o desactivar una entidad de aporte mediante baja lógica.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la entidad de aporte.',
    example: '6',
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
    description: 'Nuevo estado de la entidad de aporte.',
  })
  @ApiOkResponse({
    description: 'Estado de la entidad de aporte actualizado correctamente.',
    type: EntidadAporte,
  })
  @ApiBadRequestResponse({
    description: 'El valor del estado es inválido.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la entidad de aporte solicitada.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStateEntidadAporte(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<EntidadAporte> {
    return await this.entidadAporteService.cambiarEstado(id, activo, user);
  }

  @Get('entidad-aporte')
  @Auth()
  @ApiOperation({
    summary: 'Listar entidades de aporte',
    description:
      'Obtiene la lista de entidades de aporte registradas en el sistema, excluyendo la entidad con id 60.',
  })
  @ApiOkResponse({
    description: 'Listado de entidades de aporte obtenido correctamente.',
    type: EntidadAporte,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllEntidadAporte(): Promise<EntidadAporte[]> {
    return await this.entidadAporteService.findAllEntidadAporte();
  }

  @Get('entidad-aporte2')
  @Auth()
  @ApiOperation({
    summary: 'Listar entidades de aporte (incluye la entidad con id 60)',
    description:
      'Obtiene la lista completa de todas las entidades de aporte registradas en el sistema, sin excluir ninguna.',
  })
  @ApiOkResponse({
    description: 'Listado de entidades de aporte obtenido correctamente.',
    type: EntidadAporte,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllEntidadAporte2(): Promise<EntidadAporte[]> {
    return await this.entidadAporteService.findAllEntidadAporte2();
  }

  @Get('entidad-aporte/allTipoEntidadAporte')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los tipos de entidad de aporte',
    description:
      'Retorna una lista completa de los tipos de entidad de aporte registrados en el sistema.',
  })
  @ApiOkResponse({
    description:
      'Listado de tipos de entidad de aporte obtenido correctamente.',
    type: TipoEntidadAporte,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllTipoEntidadAporte(): Promise<TipoEntidadAporte[]> {
    return await this.entidadAporteService.findAllTipoEntidadAporte();
  }

  //---------------------------------------------------------------------------
  //                        Minerales
  //---------------------------------------------------------------------------

  @Post('mineral')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un mineral',
    description:
      'Si no se envía el campo id se registra un nuevo mineral. Si se envía el id, se actualiza el mineral correspondiente.',
  })
  @ApiBody({
    description: 'Datos del mineral.',
    examples: {
      crear: {
        summary: 'Registrar mineral',
        value: {
          descripcion: 'PLATA',
          simbolo: 'Ag',
          unidadCotizacion: 'Oz.Tr.',
          detalleMineral: 'Mineral de plata',
          factorConversion: 31.1035,
          tipo: 'METALICO',
        },
      },
      actualizar: {
        summary: 'Actualizar mineral',
        value: {
          id: 1,
          descripcion: 'PLATA',
          simbolo: 'Ag',
          unidadCotizacion: 'Oz.Tr.',
          detalleMineral: 'Mineral de plata',
          factorConversion: 31.1035,
          tipo: 'METALICO',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Mineral registrado o actualizado correctamente.',
    type: Mineral,
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiConflictResponse({
    description: 'Ya existe un mineral registrado con esa descripción.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createMineral(
    @Body()
    body: CreateMineralDto | UpdateMineralDto,
    @GetUser() user: Usuario,
  ): Promise<Mineral> {
    if ('id' in body && body.id) {
      return await this.mineralService.update(body, user);
    }

    return await this.mineralService.create(body, user);
  }

  @Patch('mineral/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de un mineral',
    description:
      'Permite activar o desactivar un mineral mediante baja lógica.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del mineral.',
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
    description: 'Nuevo estado del mineral.',
  })
  @ApiOkResponse({
    description: 'Estado del mineral actualizado correctamente.',
    type: Mineral,
  })
  @ApiBadRequestResponse({
    description: 'El valor del estado es inválido.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el mineral solicitado.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStateMineral(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<Mineral> {
    return await this.mineralService.cambiarEstado(id, activo, user);
  }

  @Get('mineral/allMinerales')
  @Auth()
  @ApiOperation({
    summary: 'Listar minerales',
    description:
      'Obtiene la lista de todos los minerales registrados en el sistema.',
  })
  @ApiOkResponse({
    description: 'Listado de minerales obtenido correctamente.',
    type: Mineral,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllMineral(): Promise<Mineral[]> {
    return await this.mineralService.findAllMineral();
  }

  @Get('mineral/:id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener un mineral por id',
    description: 'Obtiene los datos de un mineral a partir de su id.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del mineral.',
    example: '1',
  })
  @ApiOkResponse({
    description: 'Mineral obtenido correctamente.',
    type: Mineral,
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el mineral solicitado.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findOneMineral(@Param('id') id: string): Promise<Mineral> {
    return await this.mineralService.findOneMineral(id);
  }

  //---------------------------------------------------------------------------
  //                        estados de los formularios
  //---------------------------------------------------------------------------

  @Get('valorizacion_mineral/allEstados')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los estados de valorización',
    description:
      'Retorna una lista completa de los estados de valorización registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de estados de valorización obtenida exitosamente.',
    type: [EstadoValorizacion],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAlltipoEstadoValorizacion(): Promise<EstadoValorizacion[]> {
    return await this.parametricaService.findAlltipoEstadoValorizacion();
  }

  @Get('recepcion_mineral/allEstados')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los estados de recepción de mineral',
    description:
      'Retorna una lista completa de los estados de recepción de mineral registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de estados de recepción obtenida exitosamente.',
    type: [EstadoRegistro],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAlltipoEstadoRecepcionMineral(): Promise<EstadoRegistro[]> {
    return await this.parametricaService.findAlltipoEstadoRecepcionMineral();
  }

  //---------------------------------------------------------------------------
  //                        tipo de cálculo de valorización
  //---------------------------------------------------------------------------

  @Post('tipo-calculo-valorizacion')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un tipo de cálculo de valorización',
    description:
      'Registra un tipo de cálculo (maquila, ajuste de maquila, penalidad por elemento, etc) usado al ' +
      'itemizar los descuentos de una valorización. "idTipoCalculo" agrupa el cálculo: 1 = gastos de ' +
      'tratamiento, 2 = penalidades. "extras" guarda la configuración de referencia (base/unidad/escalador ' +
      'para gastos de tratamiento, o cada/cargo/leyLibre para penalidades).',
  })
  @ApiBody({ type: CreateTipoCalculoValorizacionDto })
  @ApiCreatedResponse({
    description: 'Tipo de cálculo registrado correctamente.',
    type: TipoCalculoValorizacion,
  })
  @ApiConflictResponse({
    description: 'Ya existe un tipo de cálculo con la misma descripción.',
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createTipoCalculoValorizacion(
    @Body() body: CreateTipoCalculoValorizacionDto,
    @GetUser() user: Usuario,
  ): Promise<TipoCalculoValorizacion> {
    return await this.tipoCalculoValorizacionService.create(body, user);
  }

  @Patch('tipo-calculo-valorizacion')
  @Auth()
  @ApiOperation({
    summary: 'Actualizar un tipo de cálculo de valorización',
  })
  @ApiBody({ type: UpdateTipoCalculoValorizacionDto })
  @ApiOkResponse({
    description: 'Tipo de cálculo actualizado correctamente.',
    type: TipoCalculoValorizacion,
  })
  @ApiConflictResponse({
    description: 'Ya existe otro tipo de cálculo con la misma descripción.',
  })
  @ApiNotFoundResponse({
    description: 'No existe el tipo de cálculo indicado.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async updateTipoCalculoValorizacion(
    @Body() body: UpdateTipoCalculoValorizacionDto,
    @GetUser() user: Usuario,
  ): Promise<TipoCalculoValorizacion> {
    return await this.tipoCalculoValorizacionService.update(body, user);
  }

  @Patch('tipo-calculo-valorizacion/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de un tipo de cálculo de valorización',
    description:
      'Permite activar o desactivar un tipo de cálculo mediante baja lógica.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del tipo de cálculo.',
    example: '8',
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
    description: 'Nuevo estado del tipo de cálculo.',
  })
  @ApiOkResponse({
    description: 'Estado del tipo de cálculo actualizado correctamente.',
    type: TipoCalculoValorizacion,
  })
  @ApiBadRequestResponse({
    description: 'El valor del estado es inválido.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el tipo de cálculo solicitado.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStateTipoCalculoValorizacion(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<TipoCalculoValorizacion> {
    return await this.tipoCalculoValorizacionService.cambiarEstado(
      id,
      activo,
      user,
    );
  }

  @Get('tipo-calculo-valorizacion')
  @Auth()
  @ApiOperation({
    summary: 'Listar los tipos de cálculo de valorización, agrupados',
    description:
      'Devuelve el catálogo completo agrupado en dos listas: "gastos" (id_tipo_calculo = 1: maquila, ajuste ' +
      'de maquila, gastos de refinación) y "penalidades" (id_tipo_calculo = 2: As, Sb, Bi, Sn, Fe, SiO2, etc). ' +
      'No pagina: es un catálogo acotado que no crece de forma indefinida.',
  })
  @ApiOkResponse({
    description: 'Listado obtenido correctamente.',
    type: TipoCalculoValorizacionAgrupadoDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllTipoCalculoValorizacion(): Promise<TipoCalculoValorizacionAgrupadoDto> {
    return await this.tipoCalculoValorizacionService.findAllAgrupado();
  }
}
