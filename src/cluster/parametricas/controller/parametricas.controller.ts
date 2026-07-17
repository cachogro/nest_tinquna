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
import { Ingenio } from '../entities/ingenio.entity';
import { CreateIngenioDto } from '../dto/ingenios/create-ingenio.dto';
import { UpdateIngenioDto } from '../dto/ingenios/update-ingenio.dto';
import { IngenioService } from '../services/ingenio.service';
import { FiltrosIngenioDto } from '../dto/ingenios/filtros-ingenio.dto';
import { IngeniosPaginadosDto } from '../dto/ingenios/ingenio-paginacion.dto';

@ApiTags('Paramétrica - Codificación')
@Controller('parametricas')
export class ParametricasController {
  constructor(
    private readonly codificacionService: CodificacionService,
    private readonly parametricaService: ParametricasService,

    private readonly cotizacionMineralService: CotizacionMineralService,
    private readonly ingenioService: IngenioService,
  ) {}

  // @Post('codificacion')
  // @Auth()
  // @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({
  //   summary: 'Registrar una nueva codificación',
  //   description:
  //     'Permite registrar una nueva codificación asociando uno o varios minerales existentes. El sistema valida que el código no exista previamente y que todos los minerales enviados correspondan a registros válidos. La información de los minerales se almacena como un JSON dentro de la codificación.',
  // })
  // @ApiBody({
  //   type: CreateCodificacionDto,
  //   description: 'Datos necesarios para registrar una nueva codificación.',
  //   examples: {
  //     ejemplo: {
  //       summary: 'Registro de una codificación',
  //       value: {
  //         codigo: 'BZI',
  //         nombre: 'PLATA Y ZINC',
  //         minerales: [1, 3],
  //       },
  //     },
  //   },
  // })
  // @ApiCreatedResponse({
  //   description: 'Codificación registrada correctamente.',
  //   type: Codificacion,
  // })
  // @ApiBadRequestResponse({
  //   description:
  //     'Los datos enviados son inválidos, el código ya existe o alguno de los minerales no existe.',
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'No autorizado. Token no proporcionado o inválido.',
  // })
  // @ApiConflictResponse({
  //   description: 'Ya existe una codificación registrada con el mismo código.',
  // })
  // @ApiInternalServerErrorResponse({
  //   description: 'Error interno del servidor.',
  // })
  // async create(
  //   @Body() createCodificacionDto: CreateCodificacionDto,
  // ): Promise<Codificacion> {
  //   return await this.codificacionService.create(createCodificacionDto);
  // }

  @Post('codificacion')
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
  ): Promise<Codificacion> {
    return await this.codificacionService.create(createCodificacionDto);
  }

  @Put('codificacion')
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
  ): Promise<Codificacion> {
    return await this.codificacionService.update(updateCodificacionDto);
  }

  @Get('allCodificacion')
  // @Auth()
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
  // @Auth()
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
  // @Auth()
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
  //@Auth()
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
  //@Auth()
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

  //--------------------------------INGENIO------------------------------------
  //---------------------------------------------------------------------------

  @Post('ingenio')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un ingenio',
    description:
      'Si no se envía el campo id se registra un nuevo ingenio. Si se envía el id, se actualiza el ingenio correspondiente.',
  })
  @ApiBody({
    description: 'Datos del ingenio.',
    examples: {
      crear: {
        summary: 'Registrar ingenio',
        value: {
          nombre: 'Ingenio Minero San Cristóbal',
          direccion: 'Carretera Uyuni - Atocha Km. 35',
          telefono: '72451234',
        },
      },
      actualizar: {
        summary: 'Actualizar ingenio',
        value: {
          id: 1,
          nombre: 'Ingenio Minero San Cristóbal',
          direccion: 'Av. Industrial N° 123',
          telefono: '72451234',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Ingenio registrado o actualizado correctamente.',
    type: Ingenio,
  })
  @ApiBadRequestResponse({
    description: 'Los datos enviados no son válidos.',
  })
  @ApiConflictResponse({
    description: 'Ya existe un ingenio registrado con ese nombre.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createIngenio(
    @Body() body: UpdateIngenioDto,
    @GetUser() user: Usuario,
  ): Promise<Ingenio> {
    if (body.id) {
      return this.ingenioService.update(body, user);
    }

    return this.ingenioService.create(body, user);
  }

  //cambiar de estado

  @Patch('ingenio/cambiar_estado/:id')
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
    console.log('entraaaaaaaaaaa  id', id);
    return this.ingenioService.cambiarEstadoIngenio(id, activo, user);
  }
  //----------filtros y busqueda:

  @Get('ingenio')
  // @Auth()
  @ApiOperation({
    summary: 'Listado paginado de ingenios',
    description:
      'Obtiene un listado paginado de ingenios registrados con búsqueda y filtro por estado.',
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
    description: 'Busca por nombre, dirección o teléfono.',
  })
  @ApiQuery({
    name: 'activo',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiOkResponse({
    description: 'Listado paginado obtenido correctamente.',
    type: IngeniosPaginadosDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllIngenios(@Query() filtros: FiltrosIngenioDto) {
    const xxx = await this.ingenioService.findAll(filtros);
    console.log('xxxx', xxx);
    return xxx;
  }
}
