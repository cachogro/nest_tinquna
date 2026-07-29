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
  Res,
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

import { Response } from 'express';

import { ComercioInternoService } from '../services/comercio_interno.service';
import { Auth, GetUser } from 'src/security/decorators';
import { PersonaCiService } from '../services/persona_ci.service';
import { PersonaCi } from '../entities/persona-ci.entity';
import { UpdatePersonaCiDto } from '../dto/update-persona-ci.dto';
import { CreatePersonaCiDto } from '../dto/create-persona-ci.dto';
import { UpdateRecepcionMineralDto } from '../dto/recepcion_mineral/update-recepcion-mineral.dto';
import { RecepcionMineral } from '../entities/recepcion_mineral/recepcion-mineral.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltrosPersonaDto } from '../dto/filtros-persona-ci.dto';
import { PersonasPaginadasDto } from '../dto/persona-paginacion.dto';
import { FiltrosRegistroMineralDto } from '../dto/recepcion_mineral/filtros-registro-mineral.dto';
import { CreateRecepcionMineralDto } from '../dto/recepcion_mineral/create-recepcion-mineral.dto';
import { RegistrosMineralPaginadosDto } from '../dto/recepcion_mineral/registro-mineral-paginado.dto';
import { RecepcionMineralExcelService } from '../reports/recepcion-mineral-excel.service';

@ApiTags('Registro de Operaciones')
@Controller('comercio_interno')
export class ComercioInternoController {
  constructor(
    private readonly comercioInternoService: ComercioInternoService,
    private readonly personaCiService: PersonaCiService,
    private readonly recepcionMineralExcelService: RecepcionMineralExcelService,
  ) {}

  //--------------------------- filtro personas-------------------

  @Get('persona_ci')
  @Auth()
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
  @Auth() // Ajusta roles según necesidad
  @ApiOperation({
    summary: 'Registrar o actualizar una persona (crear si no tiene id)',
    description:
      'Si se envía un id, se actualiza; si no, se crea. También se puede asociar a un actor productivo minero. Los datos de auditoría se toman del usuario autenticado.',
  })
  @ApiBody({
    type: UpdatePersonaCiDto, // Puede contener id opcional
  })
  @ApiCreatedResponse({
    description: 'Persona registrada/actualizada correctamente.',
    type: PersonaCi,
  })
  @ApiConflictResponse({
    description: 'Ya existe una persona con el mismo número de documento.',
  })
  @ApiNotFoundResponse({
    description:
      'Actor productivo minero no encontrado o tipo de persona no existe.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token inválido o no proporcionado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async create(
    @Body() data: UpdatePersonaCiDto, // DTO que puede contener id
    @GetUser() user: Usuario, // Usuario autenticado
  ): Promise<PersonaCi> {
    // Decidir si es create o update por la presencia de id
    if (data.id) {
      // Actualización
      return await this.personaCiService.update(data, user);
    } else {
      // Creación
      return await this.personaCiService.create(data, user);
    }
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
  @Auth()
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
  @Post('recepcion_mineral')
  @Auth()
  @ApiOperation({
    summary: 'Registrar o actualizar una recepción de mineral',
    description:
      'Si no se envía el campo id se registra una nueva recepción de mineral. Si se envía el id, se actualiza la recepción siempre que permanezca en estado PENDIENTE.',
  })
  @ApiBody({
    description: 'Datos de la recepción de mineral.',
    examples: {
      crear: {
        summary: 'Registrar recepción',
        value: {
          idCodificacion: 1,
          idPersona: 1,
          numeroSacos: 80,
          balanzaL: 2450.0,
          balanzaT: 2455.0,
          anticipo: 10000,
          totalValorBruto: 89500.75,
          fechaRecepcion: '2026-07-10',
          observaciones: 'Recepción inicial.',

          detalles: [
            {
              idMineral: 4,
              ley: 58.12,
            },
          ],
        },
      },
      actualizar: {
        summary: 'Actualizar recepción',
        value: {
          id: 3,
          idCodificacion: 2,
          idPersona: 1,
          numeroSacos: 82,
          balanzaL: 2480.75,
          balanzaT: 2455.0,
          anticipo: 12000,
          totalValorBruto: 91250.35,
          fechaRecepcion: '2026-07-10',
          observaciones: 'Se corrigieron los datos de recepción.',

          detalles: [
            {
              idMineral: 4,
              ley: 56.8,
            },
            {
              idMineral: 7,
              ley: 11.45,
            },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Recepción registrada o actualizada correctamente.',
    type: RecepcionMineral,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, minerales repetidos, minerales que no corresponden a la codificación o la recepción ya no puede modificarse.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró la recepción, la codificación, el proveedor o alguno de los minerales enviados.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async createRM(
    @Body()
    body: CreateRecepcionMineralDto | UpdateRecepcionMineralDto,
    @GetUser() user: Usuario,
  ): Promise<RecepcionMineral> {
    console.log('data recibida', body);
    if ('id' in body && body.id) {
      return await this.comercioInternoService.update(
        body as UpdateRecepcionMineralDto,
        user,
      );
    }
    return await this.comercioInternoService.create(
      body as CreateRecepcionMineralDto,
      user,
    );
  }

  @Patch('recepcion_mineral/cambiar_estado/:id')
  @Auth()
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
    @GetUser() user: Usuario,
  ): Promise<RecepcionMineral> {
    return this.comercioInternoService.cambiarEstado(id, idEstado, user);
  }

  //------------------------------FILTROS-----------------------------

  @Get('recepcion_mineral')
  @Auth()
  @ApiOperation({
    summary: 'Listado paginado de registros de recepción de mineral',
    description:
      'Obtiene un listado paginado de registros permitiendo filtrar por proveedor, código de operación, documento, estado y rango de fechas.',
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
    name: 'codigoOperacion',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'numeroDocumento',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'idEstado',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'fechaDesde',
    required: false,
    type: String,
    example: '2026-07-01',
  })
  @ApiQuery({
    name: 'fechaHasta',
    required: false,
    type: String,
    example: '2026-07-31',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: [
      'id',
      'codigoOperacion',
      'fechaRecepcion',
      'numeroDocumento',
      'estado',
    ],
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    enum: ['ASC', 'DESC'],
  })
  @ApiOkResponse({
    description: 'Listado paginado obtenido correctamente.',
    type: RegistrosMineralPaginadosDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllRecepcionMineral(@Query() filtros: FiltrosRegistroMineralDto) {
    return await this.comercioInternoService.findAllRM(filtros);
  }

  //--------------reporte exel---------------------

  @Get('recepcion_mineral/excel')
  @Auth()
  async exportarExcel(
    @Query() filtros: FiltrosRegistroMineralDto,
    @Res() res: Response,
  ) {
    const buffer = await this.recepcionMineralExcelService.generar(filtros);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      'Content-Disposition': 'attachment; filename=recepcion-mineral.xlsx',

      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('recepcion_mineral/busqueda/:id')
  async findRegistroById(@Param('id') id: string): Promise<RecepcionMineral> {
    return await this.comercioInternoService.buscarregistroById(id);
  }

  @Get('recepcion_mineral/pdf/:id')
  async descargarPdf(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.comercioInternoService.generarReciboPdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=Recibo-${id}.pdf`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }
}
