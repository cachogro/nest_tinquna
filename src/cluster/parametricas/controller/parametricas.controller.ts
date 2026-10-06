import {
  BadRequestException,
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
import { Cliente } from '../entities/cliente.entity';
import { ClienteService } from '../services/cliente.service';
import { CreateClienteDto } from '../dto/cliente/create-cliente.dto';
import { UpdateClienteDto } from '../dto/cliente/update-cliente.dto';
import { FiltrosClienteDto } from '../dto/cliente/filtros-cliente.dto';
import { ClientesPaginadosDto } from '../dto/cliente/cliente-paginacion.dto';
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
import { GuardarEscalaPrecioMineralDto } from '../dto/escala-precio-mineral/guardar-escala-precio-mineral.dto';
import { EscalaPrecioMineralService } from '../services/escala-precio-mineral.service';
import { TipoCalculoValorizacion } from '../entities/tipo-calculo-valorizacion.entity';
import { UpdateTipoCalculoValorizacionDto } from '../dto/tipo-calculo-valorizacion/update-tipo-calculo-valorizacion.dto';
import { TipoCalculoValorizacionService } from '../services/tipo-calculo-valorizacion.service';
import { TipoCalculoValorizacionAgrupadoDto } from '../dto/tipo-calculo-valorizacion/tipo-calculo-valorizacion-agrupado.dto';
import { Municipio } from '../entities/municipio.entity';
import { MunicipioService } from '../services/municipio.service';
import { PersonaTipoService } from '../services/persona-tipo.service';
import { UpdatePersonaTipoDto } from '../dto/persona-tipo/update-persona-tipo.dto';
import { EntidadFinancieraService } from '../services/entidad-financiera.service';
import { UpdateEntidadFinancieraDto } from '../dto/entidad-financiera/update-entidad-financiera.dto';
import { EntidadFinanciera } from '../entities/entidad-financiera.entity';
import { CuentaBancaria } from '../entities/cuenta-bancaria.entity';
import { FormaPago } from '../entities/forma-pago.entity';
import { KardexSubcuenta } from '../entities/kardex-subcuenta.entity';
import { DestinoGasto } from '../entities/destino-gasto.entity';
import { LugarAcopio } from '../entities/lugar-acopio.entity';
import { CreateLugarAcopioDto } from '../dto/lugar-acopio/create-lugar-acopio.dto';
import { UpdateLugarAcopioDto } from '../dto/lugar-acopio/update-lugar-acopio.dto';
import { LugarAcopioService } from '../services/lugar-acopio.service';
import { CreateFormaPagoDto } from '../dto/forma-pago/create-forma-pago.dto';
import { UpdateFormaPagoDto } from '../dto/forma-pago/update-forma-pago.dto';
import { FormaPagoService } from '../services/forma-pago.service';
import { CodificacionLote } from '../entities/codificacion-lote.entity';
import { CreateDestinoGastoDto } from '../dto/destino-gasto/create-destino-gasto.dto';
import { UpdateDestinoGastoDto } from '../dto/destino-gasto/update-destino-gasto.dto';
import { DestinoGastoService } from '../services/destino-gasto.service';
import { CreateCodificacionLoteDto } from '../dto/codificacion-lote/create-codificacion-lote.dto';
import { UpdateCodificacionLoteDto } from '../dto/codificacion-lote/update-codificacion-lote.dto';
import { CodificacionLoteService } from '../services/codificacion-lote.service';
import { CajaService } from '../services/caja.service';
import { UpdateCajaDto } from '../dto/caja/update-caja.dto';
import { Caja } from '../entities/caja.entity';

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
    private readonly municipioService: MunicipioService,
    private readonly personaTipoService: PersonaTipoService,
    private readonly entidadFinancieraService: EntidadFinancieraService,
    private readonly cajaService: CajaService,
    private readonly clienteService: ClienteService,
    private readonly destinoGastoService: DestinoGastoService,
    private readonly codificacionLoteService: CodificacionLoteService,
    private readonly lugarAcopioService: LugarAcopioService,
    private readonly formaPagoService: FormaPagoService,
  ) {}

  @Post('codificacion')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar una codificación',
    description:
      'Si no se envía el campo id se registra una nueva codificación asociando uno o varios minerales existentes. Si se envía el id, se actualiza la codificación correspondiente.',
  })
  @ApiBody({
    type: CreateCodificacionDto,
    description:
      'Datos para crear (sin "id") o actualizar (con "id") una codificación.',
    examples: {
      crear: {
        summary: 'Registrar codificación',
        value: {
          codigo: 'BZI',
          nombre: 'PLATA Y ZINC',
          minerales: [1, 3],
        },
      },
      actualizar: {
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
  @ApiCreatedResponse({
    description: 'Codificación registrada o actualizada correctamente.',
    type: Codificacion,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, código duplicado, minerales inexistentes o la codificación a actualizar no existe.',
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
    @Body() body: CreateCodificacionDto,
    @GetUser() user: Usuario,
  ): Promise<Codificacion> {
    if (body.id) {
      return await this.codificacionService.update(
        body as UpdateCodificacionDto,
        user,
      );
    }

    return await this.codificacionService.create(body, user);
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

  //------------------ CRUD tipo de persona ----------------------

  @Post('persona-tipo')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un tipo de persona',
    description:
      'Si no se envía el campo id se registra un nuevo tipo de persona (solo si no existe ya uno con el mismo código). Si se envía el id, se actualiza el registro. El código, nombre y descripción se guardan siempre en MAYÚSCULAS.',
  })
  @ApiBody({
    type: UpdatePersonaTipoDto,
    examples: {
      crear: {
        summary: 'Registrar tipo de persona',
        value: {
          codigo: 'INT',
          nombre: 'PERSONAL INTERNO',
          descripcion: 'TRABAJADOR DE LA EMPRESA',
        },
      },
      actualizar: {
        summary: 'Actualizar tipo de persona',
        value: {
          id: 3,
          codigo: 'INT',
          nombre: 'PERSONAL INTERNO',
          descripcion: 'TRABAJADOR DEPENDIENTE DE LA EMPRESA',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Tipo de persona registrado o actualizado correctamente.',
    type: PersonaTipo,
  })
  @ApiConflictResponse({
    description: 'Ya existe un tipo de persona con ese código.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el tipo de persona a actualizar.',
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createPersonaTipo(
    @Body() body: UpdatePersonaTipoDto,
    @GetUser() user: Usuario,
  ): Promise<PersonaTipo> {
    if (body.id) {
      return await this.personaTipoService.update(body, user);
    }

    return await this.personaTipoService.create(body, user);
  }

  @Patch('persona-tipo/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de un tipo de persona',
    description:
      'Permite activar o desactivar un tipo de persona mediante baja lógica.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del tipo de persona.',
    example: '3',
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
    description: 'Nuevo estado del tipo de persona.',
  })
  @ApiOkResponse({
    description: 'Estado del tipo de persona actualizado correctamente.',
    type: PersonaTipo,
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el tipo de persona solicitado.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStatePersonaTipo(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<PersonaTipo> {
    return await this.personaTipoService.cambiarEstado(id, activo, user);
  }

  @Get('persona-tipo')
  @Auth()
  @ApiOperation({
    summary: 'Listar tipos de persona',
    description:
      'Obtiene la lista completa de tipos de persona registrados, ordenados por código.',
  })
  @ApiOkResponse({
    description: 'Listado de tipos de persona obtenido correctamente.',
    type: PersonaTipo,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllPersonaTipoCrud(): Promise<PersonaTipo[]> {
    return await this.personaTipoService.findAll();
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
      '"fechaVigenciaFinal" se envía solo como fecha ("YYYY-MM-DD"); el backend la normaliza internamente al fin de ese día (23:59:59.999, hora de Bolivia UTC-4).',
  })
  @ApiBody({
    type: CreateCotizacionMineralDto,
    description:
      'Datos para crear (sin "id") o actualizar (con "id") una cotización.',
    examples: {
      crear: {
        summary: 'Crear cotización',
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
      'Datos inválidos: ya existe una cotización vigente para el mineral, la fecha de vigencia final es anterior a hoy, o la cotización a actualizar ya no está vigente.',
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
    summary:
      'Cargar en bloque la tabla de precios por ley de un mineral, o actualizar tramos existentes',
    description:
      'Si las filas no incluyen "id", registra todos los tramos de ley de un mineral en una sola inserción. ' +
      '"idMineral", "fechaVigenciaInicial" y "fechaVigenciaFinal" son ' +
      'compartidos por toda la carga; cada fila solo aporta "ley", ' +
      '"precioPunto" y "precioTm" (el front calcula y envía precioTm). Si la ' +
      'nueva vigencia se solapa con tramos activos existentes del mismo ' +
      'mineral, esos tramos quedan reemplazados: se desactivan por completo ' +
      '(activo=false), sin importar si les quedaban días de vigencia propia. ' +
      'No depende de "cotizacion". ' +
      'Si las filas incluyen "id" (el que devolvió la carga inicial), actualiza esos tramos: ' +
      'se puede enviar una sola fila para corregir un solo tramo, o varias a ' +
      'la vez, y lo que se omite no se modifica. No se puede modificar un tramo que ya venció. ' +
      'No se pueden mezclar filas con y sin "id" en la misma petición.',
  })
  @ApiBody({
    type: GuardarEscalaPrecioMineralDto,
    description:
      'Datos para cargar (filas sin "id") o actualizar (filas con "id") tramos de la escala de precio.',
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
  @ApiCreatedResponse({
    description: 'Tramos registrados o actualizados correctamente.',
    type: [EscalaPrecioMineral],
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos: no se envió ningún tramo, hay leyes repetidas en la ' +
      'misma carga, se mezclaron filas con y sin "id", algún tramo a ' +
      'actualizar ya no está vigente, o las fechas de vigencia son incoherentes.',
  })
  @ApiNotFoundResponse({
    description:
      'El mineral seleccionado no existe o se encuentra inactivo (al crear), o alguno de los "id" enviados no corresponde a un tramo existente (al actualizar).',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createEscalaPrecio(
    @Body() body: GuardarEscalaPrecioMineralDto,
    @GetUser() user: Usuario,
  ): Promise<EscalaPrecioMineral[]> {
    const filasConId = body.filas.filter((fila) => fila.id != null).length;

    if (filasConId === 0) {
      return await this.escalaPrecioMineralService.create(
        body as CreateEscalaPrecioMineralDto,
        user,
      );
    }

    if (filasConId !== body.filas.length) {
      throw new BadRequestException(
        'No puede mezclar tramos nuevos (sin id) y tramos a actualizar (con id) en la misma petición.',
      );
    }

    return await this.escalaPrecioMineralService.update(
      body as UpdateEscalaPrecioMineralDto,
      user,
    );
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
          fechaInicioOperaciones: '2026-01-15',
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

  //--------------------------------Cliente (comprador) ------------------------------------
  //---------------------------------------------------------------------------
  // Contraparte del flujo de VENTAS: a quién le vendemos el mineral ya
  // comprado a los actores productivos mineros (comercializadora, ingenio
  // comprador, exportadora, etc.). Separado de actor-productivo-minero
  // (contraparte de COMPRAS) para no mezclar ambos roles de negocio.

  @Post('cliente')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un cliente',
    description:
      'Si no se envía el campo id se registra un nuevo cliente. Si se envía el id, se actualiza el registro correspondiente.',
  })
  @ApiBody({
    type: UpdateClienteDto,
    description: 'Datos del cliente.',
    examples: {
      crear: {
        summary: 'Registrar Cliente',
        description:
          'idTipoActorProductivoMinero es opcional: reutiliza el mismo catálogo de GET /parametricas/actor-productivo-minero/allTipoActor (Empresa, Cooperativa, etc.), solo como etiqueta descriptiva.',
        value: {
          idTipoActorProductivoMinero: 1,
          nombre: 'Comercializadora Minera del Sur',
          direccion: 'Zona Industrial, Potosí',
          telefono: '72460000',
          nit: '1234567890',
          fechaInicioOperaciones: '2026-01-15',
        },
      },
      actualizar: {
        summary: 'Actualizar Cliente',
        value: {
          id: 1,
          nombre: 'Comercializadora Minera del Sur',
          direccion: 'Av. Industrial N° 456',
          telefono: '72460001',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Cliente registrado o actualizado correctamente.',
    type: Cliente,
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el cliente o el municipio seleccionado.',
  })
  @ApiConflictResponse({
    description: 'Ya existe un cliente registrado con ese nombre.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createCliente(
    @Body() body: UpdateClienteDto,
    @GetUser() user: Usuario,
  ): Promise<Cliente> {
    if (body.id) {
      return await this.clienteService.update(body, user);
    }
    return await this.clienteService.create(body, user);
  }

  @Patch('cliente/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de un cliente',
    description: 'Permite activar o desactivar un cliente mediante baja lógica.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del cliente.',
    example: '1',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        activo: { type: 'boolean', example: false },
      },
    },
    description: 'Nuevo estado del cliente.',
  })
  @ApiOkResponse({
    description: 'Estado del cliente actualizado correctamente.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el cliente solicitado.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async cambiarEstadoCliente(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
    return this.clienteService.cambiarEstado(id, activo, user);
  }

  @Get('cliente')
  @Auth()
  @ApiOperation({
    summary: 'Listado paginado de clientes',
    description:
      'Obtiene un listado paginado de clientes con filtros por nombre, estado y ordenamiento.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'busqueda', required: false, type: String })
  @ApiQuery({ name: 'activo', required: false, type: Boolean })
  @ApiQuery({ name: 'idTipoActorProductivoMinero', required: false, type: Number })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['id', 'nombre', 'direccion', 'telefono'],
  })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['ASC', 'DESC'] })
  @ApiOkResponse({
    description: 'Listado paginado obtenido correctamente.',
    type: ClientesPaginadosDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllClientes(@Query() filtros: FiltrosClienteDto) {
    return await this.clienteService.findAll(filtros);
  }

  @Get('cliente/allClientes')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los clientes',
    description: 'Retorna una lista completa de los clientes activos registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes obtenida exitosamente.',
    type: [Cliente],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllClientesSimple(): Promise<Cliente[]> {
    return await this.clienteService.findAllClientes();
  }

  //---------------------------------------------------------------------------
  //                        Municipios (solo lectura)
  //---------------------------------------------------------------------------

  @Get('municipio')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los municipios activos',
    description:
      'Retorna todos los municipios activos. Es una tabla de referencia ya poblada ' +
      '(sin CRUD): la búsqueda/filtrado la realiza el front sobre este listado.',
  })
  @ApiOkResponse({
    description: 'Listado de municipios activos obtenido correctamente.',
    type: [Municipio],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllMunicipios(): Promise<Municipio[]> {
    return await this.municipioService.findAll();
  }

  //---------------------------------------------------------------------------
  //          Catálogos del módulo de kardex / caja (solo lectura)
  //---------------------------------------------------------------------------

  @Get('forma-pago')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todas las formas de pago',
    description:
      'Catálogo usado en la libreta de bancos y en el kardex de anticipos (EFECTIVO, QR, TRANSFERENCIA, CHEQUE, DEPOSITO, TRANZADO, DSCT_LEY, DSCT_ANTICIPO). Solo devuelve las activas; el panel de paramétricas usa GET forma-pago/todos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de formas de pago obtenida exitosamente.',
    type: [FormaPago],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllFormaPago(): Promise<FormaPago[]> {
    return await this.parametricaService.findAllFormaPago();
  }

  @Get('forma-pago/todos')
  @Auth()
  @ApiOperation({
    summary: 'Listar formas de pago (activas e inactivas)',
    description:
      'Listado completo para el panel de paramétricas, ordenado por id.',
  })
  @ApiOkResponse({
    description: 'Listado de formas de pago obtenido correctamente.',
    type: FormaPago,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllFormaPagoTodos(): Promise<FormaPago[]> {
    return await this.formaPagoService.findAllFormaPago();
  }

  @Post('forma-pago')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar una forma de pago',
    description:
      'Si no se envía el campo id se registra una nueva forma de pago. Si se envía el id, se actualizan nombre y afectaFondo; el código no cambia una vez registrado.',
  })
  @ApiBody({
    description: 'Datos de la forma de pago.',
    examples: {
      crear: {
        summary: 'Registrar forma de pago',
        value: {
          codigo: 'TARJETA',
          nombre: 'TARJETA DE DEBITO',
          afectaFondo: true,
        },
      },
      actualizar: {
        summary: 'Actualizar forma de pago',
        value: {
          id: 9,
          codigo: 'TARJETA',
          nombre: 'TARJETA',
          afectaFondo: true,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Forma de pago registrada o actualizada correctamente.',
    type: FormaPago,
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la forma de pago solicitada.',
  })
  @ApiConflictResponse({
    description: 'Ya existe una forma de pago con ese código.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createFormaPago(
    @Body()
    body: CreateFormaPagoDto | UpdateFormaPagoDto,
    @GetUser() user: Usuario,
  ): Promise<FormaPago> {
    if ('id' in body && body.id) {
      return await this.formaPagoService.update(body, user);
    }

    return await this.formaPagoService.create(body, user);
  }

  @Patch('forma-pago/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de una forma de pago',
    description:
      'Permite activar o desactivar una forma de pago mediante baja lógica. Las inactivas dejan de ofrecerse en recibos, kardex y pagos.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la forma de pago.',
    example: 1,
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
    description: 'Nuevo estado de la forma de pago.',
  })
  @ApiOkResponse({
    description: 'Estado de la forma de pago actualizado correctamente.',
    type: FormaPago,
  })
  @ApiBadRequestResponse({
    description: 'El valor del estado es inválido.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la forma de pago solicitada.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStateFormaPago(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<FormaPago> {
    return await this.formaPagoService.cambiarEstado(id, activo, user);
  }

  @Get('lugar-acopio')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los lugares de acopio',
    description:
      'Catálogo de lugares donde se recibe el mineral (GALPON, INGENIO VILLA...). Solo lectura de los valores activos, ordenados por descripción. En la recepción de mineral se guarda como texto (campo lugarAcopio), no como relación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de lugares de acopio obtenida exitosamente.',
    type: [LugarAcopio],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllLugarAcopio(): Promise<LugarAcopio[]> {
    return await this.parametricaService.findAllLugarAcopio();
  }

  @Get('lugar-acopio/todos')
  @Auth()
  @ApiOperation({
    summary: 'Listar lugares de acopio (activos e inactivos)',
    description:
      'Listado completo para el panel de paramétricas, ordenado por descripción. Para llenar el selector de la recepción de mineral se usa GET lugar-acopio, que solo devuelve los activos.',
  })
  @ApiOkResponse({
    description: 'Listado de lugares de acopio obtenido correctamente.',
    type: LugarAcopio,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllLugarAcopioTodos(): Promise<LugarAcopio[]> {
    return await this.lugarAcopioService.findAllLugarAcopio();
  }

  @Post('lugar-acopio')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un lugar de acopio',
    description:
      'Si no se envía el campo id se registra un nuevo lugar de acopio. Si se envía el id, se actualiza el correspondiente. La descripción se guarda en mayúsculas y no puede repetirse.',
  })
  @ApiBody({
    description: 'Datos del lugar de acopio.',
    examples: {
      crear: {
        summary: 'Registrar lugar de acopio',
        value: {
          descripcion: 'GALPON',
        },
      },
      actualizar: {
        summary: 'Actualizar lugar de acopio',
        value: {
          id: 1,
          descripcion: 'INGENIO VILLA',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Lugar de acopio registrado o actualizado correctamente.',
    type: LugarAcopio,
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el lugar de acopio solicitado.',
  })
  @ApiConflictResponse({
    description: 'Ya existe un lugar de acopio con esa descripción.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createLugarAcopio(
    @Body()
    body: CreateLugarAcopioDto | UpdateLugarAcopioDto,
    @GetUser() user: Usuario,
  ): Promise<LugarAcopio> {
    if ('id' in body && body.id) {
      return await this.lugarAcopioService.update(body, user);
    }

    return await this.lugarAcopioService.create(body, user);
  }

  @Patch('lugar-acopio/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de un lugar de acopio',
    description:
      'Permite activar o desactivar un lugar de acopio mediante baja lógica. Los inactivos dejan de ofrecerse en la recepción de mineral.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador del lugar de acopio.',
    example: 1,
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
    description: 'Nuevo estado del lugar de acopio.',
  })
  @ApiOkResponse({
    description: 'Estado del lugar de acopio actualizado correctamente.',
    type: LugarAcopio,
  })
  @ApiBadRequestResponse({
    description: 'El valor del estado es inválido.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el lugar de acopio solicitado.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStateLugarAcopio(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<LugarAcopio> {
    return await this.lugarAcopioService.cambiarEstado(id, activo, user);
  }

  @Get('kardex-subcuenta')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todas las subcuentas de kardex',
    description:
      'Catálogo de subcuentas del kardex de anticipos por actor ("PRINCIPAL", "COMPRESORA"...). Sin CRUD por ahora: solo lectura de los valores activos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de subcuentas obtenida exitosamente.',
    type: [KardexSubcuenta],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllKardexSubcuenta(): Promise<KardexSubcuenta[]> {
    return await this.parametricaService.findAllKardexSubcuenta();
  }

  //---------------------------------------------------------------------------
  //                        Destinos de gasto
  //---------------------------------------------------------------------------

  @Post('destino-gasto')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un destino de gasto',
    description:
      'Si no se envía el campo id se registra uno nuevo. Si se envía el id, se actualiza. `esEgreso`: TRUE = egreso, FALSE = ingreso.',
  })
  @ApiBody({
    description: 'Datos del destino de gasto.',
    examples: {
      crear: {
        summary: 'Registrar',
        value: { nombre: 'COMBUSTIBLE GASOLINA', esEgreso: true },
      },
      actualizar: {
        summary: 'Actualizar',
        value: { id: 1, nombre: 'COMBUSTIBLE GASOLINA', esEgreso: true },
      },
    },
  })
  @ApiCreatedResponse({ type: DestinoGasto })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiConflictResponse({ description: 'Ya existe un destino de gasto con ese nombre.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async createDestinoGasto(
    @Body() body: CreateDestinoGastoDto | UpdateDestinoGastoDto,
    @GetUser() user: Usuario,
  ): Promise<DestinoGasto> {
    if ('id' in body && body.id) {
      return await this.destinoGastoService.update(body, user);
    }
    return await this.destinoGastoService.create(body, user);
  }

  @Patch('destino-gasto/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de un destino de gasto',
    description: 'Activa o desactiva (baja lógica) un destino de gasto.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiBody({
    schema: { type: 'object', properties: { activo: { type: 'boolean', example: false } } },
  })
  @ApiOkResponse({ type: DestinoGasto })
  @ApiNotFoundResponse({ description: 'No se encontró el destino de gasto.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async changeStateDestinoGasto(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<DestinoGasto> {
    return await this.destinoGastoService.cambiarEstado(id, activo, user);
  }

  @Get('destino-gasto')
  @Auth()
  @ApiOperation({
    summary: 'Obtener los destinos de gasto',
    description:
      'Catálogo de categorías de ingreso/egreso de la caja de flujo ("DESTINO DEL GASTO" del Excel), cada una marcada como ingreso o egreso (`esEgreso`). Por defecto solo los activos; con `todos=true` incluye los inactivos (para la pantalla de administración).',
  })
  @ApiQuery({ name: 'todos', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [DestinoGasto] })
  @ApiUnauthorizedResponse({ description: 'No autorizado. Token no proporcionado o inválido.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async findAllDestinoGasto(
    @Query('todos') todos?: string,
  ): Promise<DestinoGasto[]> {
    return await this.destinoGastoService.findAll(todos === 'true');
  }

  //---------------------------------------------------------------------------
  //                        Codificaciones de lote
  //---------------------------------------------------------------------------

  @Post('codificacion-lote')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar una codificación de lote',
    description:
      'Si no se envía el campo id se registra una nueva (su correlativo arranca en 0). Si se envía el id, se actualiza código y nombre; el correlativo no se modifica.',
  })
  @ApiBody({
    description: 'Datos de la codificación de lote.',
    examples: {
      crear: { summary: 'Registrar', value: { codigo: 'MC', nombre: 'EXPORTACION' } },
      actualizar: { summary: 'Actualizar', value: { id: 1, codigo: 'MC', nombre: 'EXPORTACION' } },
    },
  })
  @ApiCreatedResponse({ type: CodificacionLote })
  @ApiBadRequestResponse({ description: 'Los datos enviados no son válidos.' })
  @ApiConflictResponse({ description: 'Ya existe una codificación de lote con ese código.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async createCodificacionLote(
    @Body() body: CreateCodificacionLoteDto | UpdateCodificacionLoteDto,
    @GetUser() user: Usuario,
  ): Promise<CodificacionLote> {
    if ('id' in body && body.id) {
      return await this.codificacionLoteService.update(body, user);
    }
    return await this.codificacionLoteService.create(body, user);
  }

  @Patch('codificacion-lote/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de una codificación de lote',
    description: 'Activa o desactiva (baja lógica). Una codificación inactiva no puede elegirse en nuevos promedios.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiBody({
    schema: { type: 'object', properties: { activo: { type: 'boolean', example: false } } },
  })
  @ApiOkResponse({ type: CodificacionLote })
  @ApiNotFoundResponse({ description: 'No se encontró la codificación de lote.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async changeStateCodificacionLote(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<CodificacionLote> {
    return await this.codificacionLoteService.cambiarEstado(id, activo, user);
  }

  @Get('codificacion-lote')
  @Auth()
  @ApiOperation({
    summary: 'Listar codificaciones de lote (MC, TM, C, RV...)',
    description:
      'Por defecto solo las activas; con `todos=true` incluye las inactivas. Incluye el último correlativo usado de cada una.',
  })
  @ApiQuery({ name: 'todos', required: false, type: Boolean })
  @ApiOkResponse({ type: CodificacionLote, isArray: true })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async findAllCodificacionLote(
    @Query('todos') todos?: string,
  ): Promise<CodificacionLote[]> {
    return await this.codificacionLoteService.findAll(todos === 'true');
  }

  //---------------------------------------------------------------------------
  //                        Caja (fondo de efectivo)
  //---------------------------------------------------------------------------

  @Post('caja')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar una caja',
    description:
      'Si no se envía el campo id se registra una nueva caja (solo si no existe ya una con el mismo nombre). Si se envía el id, se actualiza. Una caja opera en Bs. y $us. a la vez, por eso lleva un saldo inicial separado por moneda. El nombre se guarda en MAYÚSCULAS.',
  })
  @ApiBody({
    type: UpdateCajaDto,
    examples: {
      crear: {
        summary: 'Registrar caja',
        value: {
          nombre: 'CAJA PRINCIPAL',
          saldoInicialBs: 1587523,
          fechaSaldoInicialBs: '2025-06-30',
          saldoInicialUsd: 0,
        },
      },
      actualizar: {
        summary: 'Actualizar caja',
        value: {
          id: 1,
          nombre: 'CAJA PRINCIPAL',
          saldoInicialBs: 1587523,
          fechaSaldoInicialBs: '2025-06-30',
          saldoInicialUsd: 0,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Caja registrada o actualizada correctamente.',
    type: Caja,
  })
  @ApiConflictResponse({
    description: 'Ya existe una caja con ese nombre.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la caja a actualizar.',
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createCaja(
    @Body() body: UpdateCajaDto,
    @GetUser() user: Usuario,
  ): Promise<Caja> {
    if (body.id) {
      return await this.cajaService.update(body, user);
    }

    return await this.cajaService.create(body, user);
  }

  @Patch('caja/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de una caja',
    description: 'Permite activar o desactivar una caja mediante baja lógica.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la caja.',
    example: '1',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { activo: { type: 'boolean', example: false } },
    },
    description: 'Nuevo estado de la caja.',
  })
  @ApiOkResponse({
    description: 'Estado de la caja actualizado correctamente.',
    type: Caja,
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la caja solicitada.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStateCaja(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<Caja> {
    return await this.cajaService.cambiarEstado(id, activo, user);
  }

  @Get('caja')
  @Auth()
  @ApiOperation({
    summary: 'Listar cajas',
    description:
      'Obtiene la lista completa de cajas registradas, ordenadas por nombre.',
  })
  @ApiOkResponse({
    description: 'Listado de cajas obtenido correctamente.',
    type: Caja,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllCaja(): Promise<Caja[]> {
    return await this.cajaService.findAll();
  }

  //---------------------------------------------------------------------------
  //                        Entidades financieras y cuentas
  //---------------------------------------------------------------------------

  @Post('entidad-financiera')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar una entidad financiera',
    description:
      'Si no se envía el campo id se registra una nueva entidad (solo si no existe ya una con el mismo nombre). Si se envía el id, se actualiza. Las cuentas se pueden asignar desde la creación: al actualizar, cada cuenta con id se modifica y sin id se agrega (las que no vengan no se tocan; para darlas de baja usar el endpoint de estado de cuenta). Nombre y sigla se guardan en MAYÚSCULAS.',
  })
  @ApiBody({
    type: UpdateEntidadFinancieraDto,
    examples: {
      crear: {
        summary: 'Registrar entidad con dos cuentas',
        value: {
          nombre: 'BANCO MERCANTIL SANTA CRUZ',
          sigla: 'BMSC',
          cuentas: [
            { numeroCuenta: '4010123456', moneda: 'BS', alias: 'Operativa Bs' },
            { numeroCuenta: '4020987654', moneda: 'USD', alias: 'Dólares' },
          ],
        },
      },
      actualizar: {
        summary: 'Actualizar y agregar una cuenta',
        value: {
          id: 6,
          nombre: 'BANCO MERCANTIL SANTA CRUZ',
          sigla: 'BMSC',
          cuentas: [
            { id: 3, numeroCuenta: '4010123456', moneda: 'BS', alias: 'Caja operativa' },
            { numeroCuenta: '4030555555', moneda: 'BS' },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Entidad financiera registrada o actualizada correctamente.',
    type: EntidadFinanciera,
  })
  @ApiConflictResponse({
    description:
      'Ya existe una entidad financiera con ese nombre, o una cuenta con ese número dentro de la entidad.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró la entidad a actualizar, o una cuenta indicada por id no le pertenece.',
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o números de cuenta repetidos en la solicitud.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createEntidadFinanciera(
    @Body() body: UpdateEntidadFinancieraDto,
    @GetUser() user: Usuario,
  ): Promise<EntidadFinanciera> {
    if (body.id) {
      return await this.entidadFinancieraService.update(body, user);
    }

    return await this.entidadFinancieraService.create(body, user);
  }

  @Patch('entidad-financiera/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de una entidad financiera',
    description:
      'Activa o desactiva una entidad financiera mediante baja lógica. No afecta el estado de sus cuentas.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la entidad financiera.',
    example: '3',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { activo: { type: 'boolean', example: false } },
    },
    description: 'Nuevo estado de la entidad financiera.',
  })
  @ApiOkResponse({
    description: 'Estado de la entidad financiera actualizado correctamente.',
    type: EntidadFinanciera,
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la entidad financiera solicitada.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStateEntidadFinanciera(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<EntidadFinanciera> {
    return await this.entidadFinancieraService.cambiarEstado(id, activo, user);
  }

  @Patch('entidad-financiera/cuenta/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de una cuenta bancaria',
    description:
      'Activa o desactiva una sola cuenta sin afectar a la entidad financiera ni a las demás cuentas.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la cuenta bancaria.',
    example: '5',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { activo: { type: 'boolean', example: false } },
    },
    description: 'Nuevo estado de la cuenta.',
  })
  @ApiOkResponse({
    description: 'Estado de la cuenta actualizado correctamente.',
    type: CuentaBancaria,
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la cuenta solicitada.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async changeStateCuentaBancaria(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<CuentaBancaria> {
    return await this.entidadFinancieraService.cambiarEstadoCuenta(
      id,
      activo,
      user,
    );
  }

  @Get('entidad-financiera')
  @Auth()
  @ApiOperation({
    summary: 'Listar entidades financieras',
    description:
      'Devuelve todas las entidades financieras con sus cuentas, ordenadas por nombre. Sin paginación.',
  })
  @ApiOkResponse({
    description: 'Listado de entidades financieras obtenido correctamente.',
    type: EntidadFinanciera,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllEntidadFinanciera(): Promise<EntidadFinanciera[]> {
    return await this.entidadFinancieraService.findAll();
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
      'Si no se envía el campo id se registra un nuevo mineral. Si se envía el id, se actualiza el mineral correspondiente. ' +
      '"alicuotaExterna" y "alicuotaInterna" son opcionales.',
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
          alicuotaExterna: 4.5,
          alicuotaInterna: 3.2,
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
          alicuotaExterna: 4.5,
          alicuotaInterna: 3.2,
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
    summary: 'Registrar o actualizar un tipo de cálculo de valorización',
    description:
      'Si no se envía el campo id se registra un tipo de cálculo (maquila, ajuste de maquila, penalidad por elemento, etc) usado al ' +
      'itemizar los descuentos de una valorización. Si se envía el id, se actualiza el registro (se reenvía el body completo). ' +
      '"idTipoCalculo" agrupa el cálculo: 1 = gastos de ' +
      'tratamiento, 2 = penalidades. "extras" guarda la configuración de referencia (base/unidad/escalador ' +
      'para gastos de tratamiento, o cada/cargo/leyLibre para penalidades).',
  })
  @ApiBody({
    type: UpdateTipoCalculoValorizacionDto,
    examples: {
      crear: {
        summary: 'Registrar tipo de cálculo',
        value: {
          descripcion: 'AS',
          idTipoCalculo: 2,
          extras: {
            cada: 0.1,
            cargo: 2.5,
            leyLibre: 0.4,
            unidadLey: '%',
            unidadCargo: 'USD/TMS',
          },
        },
      },
      actualizar: {
        summary: 'Actualizar tipo de cálculo',
        value: {
          id: 3,
          descripcion: 'AS',
          idTipoCalculo: 2,
          extras: {
            cada: 0.1,
            cargo: 3,
            leyLibre: 0.4,
            unidadLey: '%',
            unidadCargo: 'USD/TMS',
          },
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Tipo de cálculo registrado o actualizado correctamente.',
    type: TipoCalculoValorizacion,
  })
  @ApiConflictResponse({
    description: 'Ya existe un tipo de cálculo con la misma descripción.',
  })
  @ApiNotFoundResponse({
    description: 'No existe el tipo de cálculo a actualizar.',
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
    @Body() body: UpdateTipoCalculoValorizacionDto,
    @GetUser() user: Usuario,
  ): Promise<TipoCalculoValorizacion> {
    if (body.id) {
      return await this.tipoCalculoValorizacionService.update(body, user);
    }

    return await this.tipoCalculoValorizacionService.create(body, user);
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
