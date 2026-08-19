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

import { Response } from 'express';

import { ComercioInternoService } from '../services/comercio-interno.service';
import { Auth, GetUser } from 'src/security/decorators';
import { PersonaCiService } from '../services/persona-ci.service';
import { PersonaCi } from '../entities/persona-ci.entity';
import { UpdatePersonaCiDto } from '../dto/persona-ci/update-persona-ci.dto';
import { CreatePersonaCiDto } from '../dto/persona-ci/create-persona-ci.dto';
import { UpdateRecepcionMineralDto } from '../dto/recepcion-mineral/update-recepcion-mineral.dto';
import { RecepcionMineral } from '../entities/recepcion-mineral/recepcion-mineral.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltrosPersonaDto } from '../dto/persona-ci/filtros-persona-ci.dto';
import { PersonasPaginadasDto } from '../dto/persona-ci/persona-paginacion.dto';
import { FiltrosRegistroMineralDto } from '../dto/recepcion-mineral/filtros-registro-mineral.dto';
import { CreateRecepcionMineralDto } from '../dto/recepcion-mineral/create-recepcion-mineral.dto';
import { RegistrosMineralPaginadosDto } from '../dto/recepcion-mineral/registro-mineral-paginado.dto';
import { RecepcionMineralExcelService } from '../reports/recepcion-mineral-excel.service';
import { RecepcionMineralReportePdfService } from '../reports/recepcion-mineral-pdf.service';
import { ValorizacionMineralService } from '../services/valorizacion-mineral.service';
import { ValorizacionMineralPdfService } from '../services/valorizacion-mineral-pdf.service';
import { CreateValorizacionMineralDto } from '../dto/valorizacion/create-valorizacion-mineral.dto';
import { ValorizacionMineral } from '../entities/valorizacion/valorizacion-mineral.entity';
import { UpdateValorizacionMineralDto } from '../dto/valorizacion/update-valorizacion-mineral.dto';
import { CambiarEstadoValorizacionMineralDto } from '../dto/valorizacion/cambiar-estado-valorizacion-mineral.dto';
import { FiltrosValorizacionMineralDto } from '../dto/valorizacion/filtros-valorizacion-mineral.dto';
import { ValorizacionesMineralPaginadasDto } from '../dto/valorizacion/valorizacion-mineral-paginado.dto';

@ApiTags('Registro de Operaciones')
@Controller('comercio_interno')
@ApiBearerAuth()
export class ComercioInternoController {
  constructor(
    private readonly comercioInternoService: ComercioInternoService,
    private readonly personaCiService: PersonaCiService,
    private readonly recepcionMineralExcelService: RecepcionMineralExcelService,
    private readonly recepcionMineralReportePdfService: RecepcionMineralReportePdfService,
    private readonly valorizacionMineralService: ValorizacionMineralService,
    private readonly valorizacionMineralPdfService: ValorizacionMineralPdfService,
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
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['id', 'nombres', 'numeroDocumento'],
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
  @ApiOperation({
    summary: 'Cambiar estado de una persona',
    description:
      'Permite activar o desactivar una persona mediante baja lógica.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la persona.',
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
    description: 'Nuevo estado de la persona.',
  })
  @ApiOkResponse({
    description: 'Estado de la persona actualizado correctamente.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la persona solicitada.',
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
      return await this.comercioInternoService.update(body, user);
    }
    return await this.comercioInternoService.create(body, user);
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        idEstado: {
          type: 'number',
          example: 4,
        },
      },
      required: ['idEstado'],
    },
    description: 'Nuevo estado de la recepción.',
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
    description: 'Código de operación de la recepción (búsqueda parcial).',
  })
  @ApiQuery({
    name: 'idCodificacion',
    required: false,
    type: Number,
    description: 'Id de la codificación de mineral (ej. ICC).',
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
    description: 'Rango explícito. No combinar con mes/semana.',
  })
  @ApiQuery({
    name: 'fechaHasta',
    required: false,
    type: String,
    example: '2026-07-31',
    description: 'Rango explícito. No combinar con mes/semana.',
  })
  @ApiQuery({
    name: 'anio',
    required: false,
    type: Number,
    example: 2026,
    description: 'Año a usar junto con "mes" o "semana".',
  })
  @ApiQuery({
    name: 'mes',
    required: false,
    type: Number,
    example: 8,
    description:
      'Mes (1-12). Junto con "anio", filtra ese mes completo sin necesidad de calcular fechaDesde/fechaHasta.',
  })
  @ApiQuery({
    name: 'semana',
    required: false,
    type: Number,
    example: 32,
    description:
      'Semana ISO (1-53). Junto con "anio", filtra esa semana (lunes a domingo).',
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
  @ApiOperation({
    summary: 'Exportar recepciones de mineral a Excel',
    description:
      'Genera un archivo .xlsx con los registros de recepción de mineral que cumplan los mismos filtros que el listado paginado (sin paginar). ' +
      'Casos de uso: (1) por código de mineral (idCodificacion) + estado(s) + rango de fechas; ' +
      '(2) por proveedor (busqueda) + estado(s) + rango de fechas, orden ascendente; ' +
      '(3) todos los registros/estados fraccionado por mes (anio+mes) o semana ISO (anio+semana) para no saturar la consulta.',
  })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    type: String,
    description: 'Búsqueda por proveedor (nombres, apellidos o documento).',
  })
  @ApiQuery({
    name: 'codigoOperacion',
    required: false,
    type: String,
    description: 'Código de operación de la recepción (búsqueda parcial).',
  })
  @ApiQuery({
    name: 'idCodificacion',
    required: false,
    type: Number,
    description: 'Id de la codificación de mineral (ej. ICC).',
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
    description: 'Rango explícito. No combinar con mes/semana.',
  })
  @ApiQuery({
    name: 'fechaHasta',
    required: false,
    type: String,
    example: '2026-07-31',
    description: 'Rango explícito. No combinar con mes/semana.',
  })
  @ApiQuery({
    name: 'anio',
    required: false,
    type: Number,
    example: 2026,
    description: 'Año a usar junto con "mes" o "semana".',
  })
  @ApiQuery({
    name: 'mes',
    required: false,
    type: Number,
    example: 8,
    description:
      'Mes (1-12). Junto con "anio", filtra ese mes completo sin necesidad de calcular fechaDesde/fechaHasta.',
  })
  @ApiQuery({
    name: 'semana',
    required: false,
    type: Number,
    example: 32,
    description:
      'Semana ISO (1-53). Junto con "anio", filtra esa semana (lunes a domingo).',
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
    description: 'Archivo .xlsx generado correctamente.',
  })
  @ApiBadRequestResponse({
    description:
      'Combinación de filtros de fecha inválida (mes y semana a la vez, o mes/semana junto con fechaDesde/fechaHasta, o mes/semana sin año).',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
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

  //--------------reporte pdf---------------------

  @Get('recepcion_mineral/reporte_pdf')
  @Auth()
  @ApiOperation({
    summary: 'Exportar recepciones de mineral a PDF',
    description:
      'Genera un PDF con las mismas columnas y filtros que el reporte Excel (recepcion_mineral/excel), en formato de tabla. ' +
      'Casos de uso: (1) por código de mineral (idCodificacion) + estado(s) + rango de fechas; ' +
      '(2) por proveedor (busqueda) + estado(s) + rango de fechas, orden ascendente; ' +
      '(3) todos los registros/estados fraccionado por mes (anio+mes) o semana ISO (anio+semana) para no saturar la consulta.',
  })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    type: String,
    description: 'Búsqueda por proveedor (nombres, apellidos o documento).',
  })
  @ApiQuery({
    name: 'codigoOperacion',
    required: false,
    type: String,
    description: 'Código de operación de la recepción (búsqueda parcial).',
  })
  @ApiQuery({
    name: 'idCodificacion',
    required: false,
    type: Number,
    description: 'Id de la codificación de mineral (ej. ICC).',
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
    description: 'Rango explícito. No combinar con mes/semana.',
  })
  @ApiQuery({
    name: 'fechaHasta',
    required: false,
    type: String,
    example: '2026-07-31',
    description: 'Rango explícito. No combinar con mes/semana.',
  })
  @ApiQuery({
    name: 'anio',
    required: false,
    type: Number,
    example: 2026,
    description: 'Año a usar junto con "mes" o "semana".',
  })
  @ApiQuery({
    name: 'mes',
    required: false,
    type: Number,
    example: 8,
    description:
      'Mes (1-12). Junto con "anio", filtra ese mes completo sin necesidad de calcular fechaDesde/fechaHasta.',
  })
  @ApiQuery({
    name: 'semana',
    required: false,
    type: Number,
    example: 32,
    description:
      'Semana ISO (1-53). Junto con "anio", filtra esa semana (lunes a domingo).',
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
    description: 'Archivo .pdf generado correctamente.',
  })
  @ApiBadRequestResponse({
    description:
      'Combinación de filtros de fecha inválida (mes y semana a la vez, o mes/semana junto con fechaDesde/fechaHasta, o mes/semana sin año).',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async exportarReportePdf(
    @Query() filtros: FiltrosRegistroMineralDto,
    @Res() res: Response,
  ) {
    const buffer =
      await this.recepcionMineralReportePdfService.generar(filtros);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=recepcion-mineral.pdf',
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('recepcion_mineral/busqueda/:id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener una recepción de mineral por id',
    description:
      'Obtiene los datos de una recepción de mineral a partir de su id.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la recepción.',
    example: '25',
  })
  @ApiOkResponse({
    description: 'Recepción obtenida correctamente.',
    type: RecepcionMineral,
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la recepción solicitada.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findRegistroById(@Param('id') id: string): Promise<RecepcionMineral> {
    return await this.comercioInternoService.buscarregistroById(id);
  }

  @Get('recepcion_mineral/pdf/:id')
  @Auth()
  @ApiOperation({
    summary: 'Generar el PDF del recibo de una recepción de mineral',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la recepción.',
    example: '25',
  })
  @ApiQuery({
    name: 'formato',
    required: false,
    enum: ['ticket', 'carta'],
    description: 'Formato del recibo (default: ticket).',
  })
  @ApiOkResponse({
    description: 'PDF generado correctamente.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la recepción solicitada.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async descargarPdf(
    @Param('id') id: string,
    @Query('formato') formato: 'ticket' | 'carta' = 'ticket',
    @Res() res: Response,
  ) {
    const pdf = await this.comercioInternoService.generarReciboPdf(id, formato);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=Recibo-${id}.pdf`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }

  //--------------------------- valorización de mineral -------------------
  //
  //-------------------------------------------------------------------------

  @Post('valorizacion_mineral')
  @Auth()
  @ApiOperation({
    summary: 'Crear el borrador de una valorización de mineral',
    description:
      'Crea el registro inicial (estado BORRADOR) de una valorización a partir de una recepción ' +
      'de mineral en estado APROBADO (2) o REMUESTREO (6). En esta etapa solo se registra la relación ' +
      'con la recepción; el resto de la información (laboratorio, pesos, económicos, detalles, aportes) ' +
      'se completa después con PATCH /comercio_interno/valorizacion_mineral/:id, pudiendo llamarse ' +
      'varias veces según se vaya teniendo la información.',
  })
  @ApiBody({
    description: 'Id de la recepción de mineral a valorizar.',
    type: CreateValorizacionMineralDto,
  })
  @ApiCreatedResponse({
    description: 'Borrador de valorización creado correctamente.',
    type: ValorizacionMineral,
  })
  @ApiBadRequestResponse({
    description:
      'La recepción no está en un estado válido para valorizarse, o ya tiene una valorización registrada.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la recepción de mineral.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async crearValorizacionMineral(
    @Body() body: CreateValorizacionMineralDto,
    @GetUser() user: Usuario,
  ): Promise<ValorizacionMineral> {
    return await this.valorizacionMineralService.crear(body, user);
  }

  @Patch('valorizacion_mineral/:id')
  @Auth()
  @ApiOperation({
    summary: 'Actualizar parcialmente una valorización de mineral',
    description:
      'Actualiza únicamente los campos enviados (laboratorio, pesos, económicos, detalles, aportes, ' +
      'cálculos, o el estado de la valorización). Puede llamarse varias veces mientras la recepción ' +
      'asociada permanezca en estado APROBADO (2) o REMUESTREO (6). Al enviar detalles, aportes o ' +
      'cálculos, se da de baja lógica lo anterior y se registra lo nuevo. "calculos" (maquila, ajuste ' +
      'de maquila, penalidades por elemento, etc) es opcional: depende de la codificación de la ' +
      'recepción, no todas lo usan. Al pasar idEstadoValorizacion a VALORIZADO (3), se valida que la ' +
      'información mínima esté completa y la recepción de mineral pasa a TRANZADO (5), quedando la ' +
      'valorización bloqueada para futuras modificaciones.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la valorización.',
    example: '12',
  })
  @ApiBody({
    description: 'Subconjunto de campos a actualizar.',
    type: UpdateValorizacionMineralDto,
  })
  @ApiOkResponse({
    description: 'Valorización actualizada correctamente.',
    type: ValorizacionMineral,
  })
  @ApiBadRequestResponse({
    description:
      'La valorización ya no puede modificarse, faltan datos para pasar a VALORIZADO, o el detalle/aportes/cálculos enviados son inválidos.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró la valorización, el laboratorio, el estado de valorización, alguna entidad de aporte o algún tipo de cálculo.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async actualizarValorizacionMineral(
    @Param('id') id: string,
    @Body() body: UpdateValorizacionMineralDto,
    @GetUser() user: Usuario,
  ): Promise<ValorizacionMineral> {
    return await this.valorizacionMineralService.actualizar(id, body, user);
  }

  @Patch('valorizacion_mineral/:id/estado')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar el estado de una valorización de mineral',
    description:
      'Endpoint dedicado exclusivamente al cambio de estado de la valorización. El front indica ' +
      'a qué estado está pasando: PRE-VALORIZADO (2) o VALORIZADO (3). Valida que la valorización ' +
      'exista, esté activa, no haya sido tranzada previamente, tenga registrado el saldo a pagar y ' +
      'al menos un detalle de mineral. Al pasar a VALORIZADO (3), la recepción de mineral asociada ' +
      'pasa a TRANZADO (5), quedando la valorización bloqueada para futuras modificaciones.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la valorización.',
    example: '12',
  })
  @ApiBody({
    description: 'Nuevo estado de la valorización.',
    type: CambiarEstadoValorizacionMineralDto,
  })
  @ApiOkResponse({
    description: 'Estado de la valorización actualizado correctamente.',
    type: ValorizacionMineral,
  })
  @ApiBadRequestResponse({
    description:
      'La valorización no está activa, ya fue tranzada, no tiene saldo a pagar registrado, o no tiene detalle de mineral.',
  })
  @ApiNotFoundResponse({
    description:
      'No existe la valorización o el estado de valorización seleccionado.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async cambiarEstadoValorizacionMineral(
    @Param('id') id: string,
    @Body() body: CambiarEstadoValorizacionMineralDto,
    @GetUser() user: Usuario,
  ): Promise<ValorizacionMineral> {
    return await this.valorizacionMineralService.cambiarEstado(id, body, user);
  }

  @Get('valorizacion_mineral/:id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener una valorización de mineral por id',
  })
  @ApiOkResponse({
    description: 'Valorización obtenida correctamente.',
    type: ValorizacionMineral,
  })
  @ApiNotFoundResponse({
    description: 'No existe la valorización.',
  })
  async buscarValorizacionMineral(
    @Param('id') id: string,
  ): Promise<ValorizacionMineral> {
    return await this.valorizacionMineralService.buscarPorId(id);
  }

  //------------------------------FILTROS VALORIZACIÓN-----------------------------

  @Get('valorizacion_mineral')
  @Auth()
  @ApiOperation({
    summary: 'Listado paginado de valorizaciones de mineral',
    description:
      'Obtiene un listado paginado de valorizaciones permitiendo filtrar por proveedor, código de operación, documento, estado de valorización y rango de fechas.',
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
    name: 'idEstadoValorizacion',
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
      'fechaValorizacion',
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
    type: ValorizacionesMineralPaginadasDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllValorizacionMineral(
    @Query() filtros: FiltrosValorizacionMineralDto,
  ) {
    return await this.valorizacionMineralService.findAll(filtros);
  }

  @Get('valorizacion_mineral/pdf/:id')
  @Auth()
  @ApiOperation({
    summary: 'Generar el PDF de una valorización de mineral',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la valorización.',
    example: '12',
  })
  @ApiOkResponse({
    description: 'PDF generado correctamente.',
  })
  @ApiNotFoundResponse({
    description: 'No existe la valorización.',
  })
  async descargarValorizacionPdf(
    @Param('id') id: string,
    @GetUser() user: Usuario,
    @Res() res: Response,
  ) {
    const valorizacion = await this.valorizacionMineralService.buscarPorId(id);

    const pdf = await this.valorizacionMineralPdfService.generarPdf(
      valorizacion,
      user,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=Valorizacion-${id}.pdf`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }
}
