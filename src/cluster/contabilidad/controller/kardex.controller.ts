import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Auth, GetUser } from 'src/security/decorators';
import { Usuario } from 'src/security/entities/usuario.entity';
import { KardexService } from '../services/kardex.service';
import { Kardex } from '../entities/kardex.entity';
import { AbrirKardexDto } from '../dto/kardex/abrir-kardex.dto';
import { FiltrosKardexDto } from '../dto/kardex/filtros-kardex.dto';
import { KardexPaginadoDto } from '../dto/kardex/kardex-paginado.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class KardexController {
  constructor(private readonly kardexService: KardexService) {}

  @Post('kardex')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Abrir el primer kardex de un actor o de una persona',
    description:
      'Registra el kardex N° 1 de un actor productivo minero (cubre a todas sus personas) o de una persona individual. Los kardex siguientes (N° 2, N° 3...) se generan solos al cerrar el actual. `saldoInicial` es la deuda que se arrastra del Excel; por defecto 0.',
  })
  @ApiBody({
    type: AbrirKardexDto,
    examples: {
      actor: {
        summary: 'Kardex de un actor (cooperativa / lote)',
        value: {
          tipo: 'ACTOR',
          idActorProductivoMinero: '5',
          descripcion: 'ANTICIPOS A CTA SACOS DE MINERAL',
          gestion: 2026,
          saldoInicial: 3500,
        },
      },
      personal: {
        summary: 'Kardex personal de un socio',
        value: {
          tipo: 'PERSONAL',
          idPersona: '15',
          descripcion: 'ANTICIPOS A CTA PERSONAL',
          saldoInicial: 0,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Kardex abierto correctamente.',
    type: Kardex,
  })
  @ApiConflictResponse({
    description:
      'El actor o la persona ya tiene un kardex (el siguiente se genera al cerrar).',
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, o destinatario inactivo.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el actor o la persona.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async abrir(
    @Body() body: AbrirKardexDto,
    @GetUser() user: Usuario,
  ): Promise<Kardex> {
    return await this.kardexService.abrir(body, user);
  }

  @Patch('kardex/:id/cerrar')
  @Auth()
  @ApiOperation({
    summary: 'Cerrar un kardex',
    description:
      'Sella el kardex (`saldo_cierre = saldo_actual`) y abre automáticamente el siguiente (N° + 1) arrastrando ese saldo como `saldo_inicial`. Devuelve el kardex cerrado y el nuevo.',
  })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiOkResponse({ description: 'Kardex cerrado; se devolvió también el nuevo.' })
  @ApiBadRequestResponse({ description: 'El kardex ya está cerrado.' })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cerrar(@Param('id') id: string, @GetUser() user: Usuario) {
    return await this.kardexService.cerrar(id, user);
  }

  @Patch('kardex/:id/reabrir')
  @Auth()
  @ApiOperation({
    summary: 'Reabrir un kardex cerrado',
    description:
      'Vuelve el kardex a ABIERTO. Solo si el kardex siguiente que se generó al cerrar no tuvo movimientos (en ese caso se elimina).',
  })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiOkResponse({ description: 'Kardex reabierto.', type: Kardex })
  @ApiBadRequestResponse({
    description:
      'El kardex no está cerrado, o el kardex siguiente ya tiene movimientos.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async reabrir(
    @Param('id') id: string,
    @GetUser() user: Usuario,
  ): Promise<Kardex> {
    return await this.kardexService.reabrir(id, user);
  }

  @Patch('kardex/:id/cambiar_estado')
  @Auth()
  @ApiOperation({
    summary: 'Activar / desactivar un kardex',
    description:
      'Baja lógica de un kardex creado por error. Solo se puede desactivar el N° 1, sin kardex posteriores y sin movimientos.',
  })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { activo: { type: 'boolean', example: false } },
    },
  })
  @ApiOkResponse({ description: 'Estado del kardex actualizado.', type: Kardex })
  @ApiBadRequestResponse({
    description: 'No se puede desactivar un kardex con historial o movimientos.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cambiarEstado(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<Kardex> {
    return await this.kardexService.cambiarEstado(id, activo, user);
  }

  @Get('kardex')
  @Auth()
  @ApiOperation({
    summary: 'Listado paginado de kardex',
    description:
      'Bandeja paginada de kardex (mismo formato que persona_ci / actor-productivo-minero), para elegir un kardex abierto o cerrado antes de entrar a cargarle movimientos. Filtra por tipo, estado, gestión, actor o persona puntual, y por búsqueda libre (nombre del actor, nombre/apellidos de la persona o descripción del kardex).',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'tipo', required: false, enum: ['ACTOR', 'PERSONAL'] })
  @ApiQuery({ name: 'estado', required: false, enum: ['ABIERTO', 'CERRADO'] })
  @ApiQuery({ name: 'gestion', required: false, type: Number, example: 2026 })
  @ApiQuery({ name: 'idActorProductivoMinero', required: false, type: String })
  @ApiQuery({ name: 'idPersona', required: false, type: String })
  @ApiQuery({ name: 'busqueda', required: false, type: String, example: 'Kalamarca' })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['id', 'numero', 'gestion', 'estado', 'fechaApertura'],
  })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['ASC', 'DESC'] })
  @ApiOkResponse({
    description: 'Listado paginado obtenido correctamente.',
    type: KardexPaginadoDto,
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async findAll(@Query() filtros: FiltrosKardexDto): Promise<KardexPaginadoDto> {
    return await this.kardexService.findAll(filtros);
  }

  @Get('kardex/:id')
  @Auth()
  @ApiOperation({ summary: 'Obtener un kardex por id' })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiOkResponse({ description: 'Kardex obtenido.', type: Kardex })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async buscarPorId(@Param('id') id: string): Promise<Kardex> {
    return await this.kardexService.buscarPorId(id);
  }
}
