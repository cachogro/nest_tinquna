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
import { MovimientoKardexService } from '../services/movimiento-kardex.service';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { CreateMovimientoKardexDto } from '../dto/movimiento-kardex/create-movimiento-kardex.dto';
import { FiltroMovimientoKardexDto } from '../dto/movimiento-kardex/filtro-movimiento-kardex.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class MovimientoKardexController {
  constructor(
    private readonly movimientoKardexService: MovimientoKardexService,
  ) {}

  @Post('movimiento-kardex')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar una línea del kardex',
    description:
      'Sin `id` registra un movimiento; con `id` lo actualiza. El kardex debe estar ABIERTO. DEBE = anticipo entregado (sube la deuda); HABER = pago/descuento (la baja). El `saldo` corriente y el `numeroLinea` (reinicia en 1 por kardex) los asigna el servicio, que también recalcula `kardex.saldoActual`.',
  })
  @ApiBody({
    type: CreateMovimientoKardexDto,
    examples: {
      anticipo: {
        summary: 'Anticipo entregado (DEBE)',
        value: {
          idKardex: '1',
          fecha: '2026-01-17',
          nroComprobante: 'REC:C-273',
          detalle: 'ANTICIPO A CTA COMPRESORA',
          idFormaPago: 1,
          tipo: 'DEBE',
          monto: 960,
        },
      },
      pago: {
        summary: 'Pago / descuento (HABER)',
        value: {
          idKardex: '1',
          fecha: '2026-03-16',
          nroComprobante: 'REC:C-406',
          detalle: 'PAGO TOTAL DE CARGAS VENDIDAS',
          idFormaPago: 1,
          tipo: 'HABER',
          monto: 7050,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Movimiento registrado o actualizado correctamente.',
    type: MovimientoKardex,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, o el kardex está cerrado.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró el kardex, el movimiento a actualizar, o alguna referencia (subcuenta, forma de pago, tipo de movimiento, cobrador, valorización).',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async guardar(
    @Body() body: CreateMovimientoKardexDto,
    @GetUser() user: Usuario,
  ): Promise<MovimientoKardex> {
    return await this.movimientoKardexService.guardar(body, user);
  }

  @Patch('movimiento-kardex/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Activar o desactivar una línea del kardex',
    description:
      'Baja lógica de un movimiento. Solo si el kardex está abierto. Recalcula el saldo del kardex.',
  })
  @ApiParam({ name: 'id', description: 'Id del movimiento.', example: '10' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { activo: { type: 'boolean', example: false } },
    },
  })
  @ApiOkResponse({
    description: 'Estado del movimiento actualizado.',
    type: MovimientoKardex,
  })
  @ApiBadRequestResponse({ description: 'El kardex está cerrado.' })
  @ApiNotFoundResponse({ description: 'No se encontró el movimiento.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cambiarEstado(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<MovimientoKardex> {
    return await this.movimientoKardexService.cambiarEstado(id, activo, user);
  }

  @Get('movimiento-kardex')
  @Auth()
  @ApiOperation({
    summary: 'Listar las líneas de un kardex',
    description: 'Devuelve el kardex y todas sus líneas activas, en orden. Sin paginación.',
  })
  @ApiQuery({ name: 'idKardex', required: true, type: String, example: '1' })
  @ApiOkResponse({ description: 'Kardex y sus movimientos.' })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listar(@Query() filtro: FiltroMovimientoKardexDto) {
    return await this.movimientoKardexService.listar(filtro.idKardex);
  }
}
