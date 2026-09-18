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
      'Sin `id` registra un movimiento; con `id` lo actualiza. El kardex debe estar ABIERTO. DEBE = anticipo entregado (sube la deuda); HABER = pago/descuento (la baja). El `saldo` corriente y el `numeroLinea` (reinicia en 1 por kardex) los asigna el servicio, que también recalcula `kardex.saldoActual`. Al REGISTRAR (sin `id`), la línea también se refleja automáticamente en la caja de flujo (Caja id=1, "CAJA PRINCIPAL"): DEBE -> EGRESO (plata que sale como anticipo), HABER -> INGRESO (valor recuperado al saldar la deuda); el beneficiario que queda guardado en ese movimiento de caja es el titular del kardex (la persona o el actor productivo minero), y requiere que la Caja id=1 ya esté aperturada en BOB. Si `idFormaPago` es un medio bancario (QR, Transferencia, Cheque, Depósito), se puede indicar `idCuentaBancaria`: en ese caso, además del movimiento de caja, también postea en la libreta de bancos de esa cuenta (misma dirección: DEBE=sale, HABER=entra), y requiere que esa cuenta ya esté aperturada. `nroComprobante` pasa a ser el N° de comprobante real de la transacción bancaria; `facturaRecibo` es el documento que respalda la línea (ej. "REC:C-273", "DET. ADJ."). Al ACTUALIZAR (con `id`) no se sincronizan los movimientos de caja/banco ya generados: si hace falta corregir el monto o el tipo, se ajustan también a mano en `/contabilidad/movimiento-caja` y en la libreta de bancos.',
  })
  @ApiBody({
    type: CreateMovimientoKardexDto,
    examples: {
      anticipo: {
        summary: 'Anticipo entregado (DEBE)',
        value: {
          idKardex: '1',
          fecha: '2026-01-17',
          facturaRecibo: 'REC:C-273',
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
          facturaRecibo: 'REC:C-406',
          detalle: 'PAGO TOTAL DE CARGAS VENDIDAS',
          idFormaPago: 1,
          tipo: 'HABER',
          monto: 7050,
        },
      },
      pagoPorTransferencia: {
        summary: 'Pago recibido por transferencia (HABER + banco)',
        value: {
          idKardex: '1',
          fecha: '2026-03-16',
          nroComprobante: '4613159797',
          facturaRecibo: 'REC:C-406',
          idFormaPago: 3,
          idCuentaBancaria: 1,
          detalle: 'PAGO TOTAL DE CARGAS VENDIDAS',
          tipo: 'HABER',
          monto: 7050,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Movimiento registrado o actualizado correctamente. Al registrar, incluye el movimiento de caja de flujo que generó (`movimientosCaja`).',
    type: MovimientoKardex,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, el kardex está cerrado, la Caja id=1 todavía no fue aperturada en BOB, o (si se indicó idCuentaBancaria) esa cuenta todavía no fue aperturada.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró el kardex, el movimiento a actualizar, o alguna referencia (subcuenta, forma de pago, destino del gasto, cobrador, valorización, cuenta bancaria).',
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
