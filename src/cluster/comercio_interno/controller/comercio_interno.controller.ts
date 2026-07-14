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

import { ComercioInternoService } from '../services/comercio_interno.service';
import { Auth, GetUser } from 'src/security/decorators';
import { PersonaCiService } from '../services/persona_ci.service';
import { PersonaCi } from '../entities/persona-ci.entity';
import { UpdatePersonaCiDto } from '../dto/update-persona-ci.dto';
import { CreatePersonaCiDto } from '../dto/create-persona-ci.dto';
import { UpdateRecepcionMineralDto } from '../dto/update-recepcion-mineral.dto';
import { RecepcionMineral } from '../entities/recepcion-mineral.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltrosPersonaDto } from '../dto/filtros-persona-ci.dto';
import { PersonasPaginadasDto } from '../dto/persona-paginacion.dto';
import { FiltrosRegistroMineralDto } from '../dto/filtros-registro-mineral.dto';

@ApiTags('Registro de Operaciones')
@Controller('comercio_interno')
export class ComercioInternoController {
  constructor(
    private readonly comercioInternoService: ComercioInternoService,
    private readonly personaCiService: PersonaCiService,
  ) {}

  //--------------------------- filtro personas-------------------

  @Get('persona_ci')
  // @Auth()
  @ApiOperation({
    summary: 'Listado paginado de personas',
    description:
      'Obtiene un listado paginado de personas registradas. Permite realizar búsquedas por nombre completo o documento, además de filtrar por tipo de persona y estado.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Número de página.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Cantidad de registros por página.',
  })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    type: String,
    example: 'Grover',
    description: 'Busca por nombres, apellido paterno o apellido materno.',
  })
  @ApiQuery({
    name: 'numeroDocumento',
    required: false,
    type: String,
    example: '98765432',
    description: 'Filtra por número de documento.',
  })
  @ApiQuery({
    name: 'idTipoPersona',
    required: false,
    type: Number,
    example: 1,
    description: 'Filtra por tipo de persona.',
  })
  @ApiQuery({
    name: 'activo',
    required: false,
    type: Boolean,
    example: true,
    description: 'Filtra por estado del registro.',
  })
  @ApiOkResponse({
    description: 'Listado paginado obtenido correctamente.',
    type: PersonasPaginadasDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAll(@Query() filtros: FiltrosPersonaDto) {
    return await this.personaCiService.findAll(filtros);
  }

  // ---------------persona----------

  @Post('persona_ci')
  //@Auth()
  @ApiOperation({
    summary: 'Registrar una nueva persona',
    description:
      'Registra una nueva persona en el sistema y la asocia a uno o más tipos de persona (Proveedor, Cliente, Chofer, etc.).',
  })
  @ApiBody({
    type: UpdatePersonaCiDto,
    description: 'Datos de la persona a registrar.',
  })
  @ApiCreatedResponse({
    description: 'Persona registrada correctamente.',
    type: PersonaCi,
  })
  @ApiConflictResponse({
    description:
      'Ya existe una persona registrada con el mismo número de documento.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token inválido o no proporcionado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async create(@Body() data: UpdatePersonaCiDto): Promise<PersonaCi> {
    return await this.personaCiService.create(data);
  }

  @Patch('persona_ci/cambiar_estado_persona/:id')
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
    return this.personaCiService.cambiarEstadoUser(id, activo, user);
  }

  @Get('persona_ci/allPersonaCi')
  //@Auth()
  @ApiOperation({
    summary: 'Obtener todos las personas comercio interno',
    description:
      'Retorna una lista completa de los minerales registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de lugares de emisión obtenida exitosamente.',
    type: [PersonaCi],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllPersinaTipo(): Promise<PersonaCi[]> {
    return await this.personaCiService.findAllPersonaCi();
  }

  ////---------------------------registro mineral----------------------------------
  @Post('registro_mineral')
  // @Auth()
  @ApiOperation({
    summary: 'Crear o actualizar una recepción de mineral',
    description:
      'Si el cuerpo de la petición contiene el campo id se actualiza el registro; caso contrario se crea una nueva recepción.',
  })
  @ApiBody({
    type: UpdateRecepcionMineralDto,
    description: 'Datos de la recepción de mineral.',
  })
  @ApiCreatedResponse({
    description: 'Operación realizada correctamente.',
    type: RecepcionMineral,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o la recepción ya fue liquidada.',
  })
  @ApiNotFoundResponse({
    description: 'No existe la codificación, proveedor o recepción.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createRM(
    @Body()
    data: UpdateRecepcionMineralDto,
  ): Promise<RecepcionMineral> {
    return this.comercioInternoService.create(data);
  }

  @Patch('registro_mineral/cambiar_estado/:id')
  // @Auth()
  @ApiOperation({
    summary: 'Cambiar estado de una recepción',
    description:
      'Actualiza únicamente el estado de una recepción de mineral. No se permite modificar registros liquidados.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la recepción.',
    example: '25',
  })
  @ApiParam({
    name: 'idEstado',
    description: 'Nuevo estado de la recepción.',
    example: 4,
  })
  @ApiCreatedResponse({
    description: 'Estado actualizado correctamente.',
    type: RecepcionMineral,
  })
  @ApiBadRequestResponse({
    description: 'La recepción ya fue liquidada.',
  })
  @ApiNotFoundResponse({
    description: 'La recepción o el estado no existen.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async cambiarEstado(
    @Param('id') id: string,
    @Body('idEstado', ParseIntPipe) idEstado: number,
  ): Promise<RecepcionMineral> {
    return this.comercioInternoService.cambiarEstado(id, idEstado);
  }

  //------------------------------FILTROS-----------------------------

  @Get('registro_mineral')
  async findAllRecepcionMineral(@Query() filtros: FiltrosRegistroMineralDto) {
    return this.comercioInternoService.findAllRM(filtros);
  }
}
