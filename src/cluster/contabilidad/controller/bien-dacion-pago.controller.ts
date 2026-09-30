import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { BienDacionPagoService } from '../services/bien-dacion-pago.service';
import { BienDacionPago } from '../entities/bien-dacion-pago.entity';
import { CreateBienDacionPagoDto } from '../dto/bien-dacion-pago/create-bien-dacion-pago.dto';
import { VenderBienDacionPagoDto } from '../dto/bien-dacion-pago/vender-bien-dacion-pago.dto';
import { DevolverBienDacionPagoDto } from '../dto/bien-dacion-pago/devolver-bien-dacion-pago.dto';
import { FiltroBienDacionPagoDto } from '../dto/bien-dacion-pago/filtro-bien-dacion-pago.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class BienDacionPagoController {
  constructor(private readonly bienDacionPagoService: BienDacionPagoService) {}

  @Post('bien-dacion-pago')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un bien recibido en dación de pago',
    description:
      'Registra un bien (ej. un auto) que un actor productivo minero o una persona asociada entrega en lugar de efectivo, como antecedente de que la empresa lo tiene en su poder (estado EN_POSESION). El destinatario debe tener ya un kardex ABIERTO (se valida antes de registrar). NO genera ningún movimiento de kardex ni de caja: `valorReferencial` es solo un avalúo aproximado de referencia, no se usa para saldar nada todavía.',
  })
  @ApiBody({
    type: CreateBienDacionPagoDto,
    examples: {
      registro: {
        summary: 'Recibir un auto',
        value: {
          idActorProductivoMinero: '4',
          fechaRecepcion: '2026-09-24',
          descripcion: 'AUTO TOYOTA HILUX, PLACA 1234-ABC, AÑO 2015',
          valorReferencial: 45000,
          observaciones: 'ENTREGADO A CUENTA DE SU DEUDA POR ANTICIPOS.',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Bien registrado correctamente.', type: BienDacionPago })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, destinatario inactivo, o no tiene un kardex ABIERTO.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la persona o el actor.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async registrar(
    @Body() body: CreateBienDacionPagoDto,
    @GetUser() user: Usuario,
  ): Promise<BienDacionPago> {
    return await this.bienDacionPagoService.registrar(body, user);
  }

  @Post('bien-dacion-pago/:id/vender')
  @Auth()
  @ApiOperation({
    summary: 'Registrar la venta de un bien en dación de pago',
    description:
      'Pasa el bien a VENDIDO (solo si está EN_POSESION) y con el monto amortiza la deuda de su dueño: genera un recibo de INGRESO PROCESADO con HABER en su kardex abierto y entrada a la caja de flujo (o a la libreta bancaria si viene idCuentaBancaria). Todo en una transacción.',
  })
  @ApiParam({ name: 'id', description: 'Id del bien.', example: '3' })
  @ApiBody({ type: VenderBienDacionPagoDto })
  @ApiOkResponse({ description: 'Bien vendido; incluye `recibo`.', type: BienDacionPago })
  @ApiBadRequestResponse({
    description:
      'El bien no está EN_POSESION, el dueño ya no tiene kardex abierto, falta quién autorizó, o la caja/cuenta no está aperturada.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el bien.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async vender(
    @Param('id') id: string,
    @Body() body: VenderBienDacionPagoDto,
    @GetUser() user: Usuario,
  ): Promise<BienDacionPago> {
    return await this.bienDacionPagoService.vender(id, body, user);
  }

  @Post('bien-dacion-pago/:id/devolver')
  @Auth()
  @ApiOperation({
    summary: 'Registrar la devolución de un bien en dación de pago',
    description:
      'Pasa el bien a estado DEVUELTO. Solo si está EN_POSESION. `observaciones` es obligatorio: ahí se anota el motivo de la devolución (no hay un campo aparte).',
  })
  @ApiParam({ name: 'id', description: 'Id del bien.', example: '3' })
  @ApiBody({ type: DevolverBienDacionPagoDto })
  @ApiOkResponse({ description: 'Bien marcado como devuelto.', type: BienDacionPago })
  @ApiBadRequestResponse({ description: 'El bien no está EN_POSESION, o falta el motivo.' })
  @ApiNotFoundResponse({ description: 'No se encontró el bien.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async devolver(
    @Param('id') id: string,
    @Body() body: DevolverBienDacionPagoDto,
    @GetUser() user: Usuario,
  ): Promise<BienDacionPago> {
    return await this.bienDacionPagoService.devolver(id, body, user);
  }

  @Get('bien-dacion-pago')
  @Auth()
  @ApiOperation({
    summary: 'Listar bienes recibidos en dación de pago',
    description: 'Paginado. Filtros opcionales: persona, actor, estado y rango de fecha de recepción.',
  })
  @ApiQuery({ name: 'idPersona', required: false, type: String })
  @ApiQuery({ name: 'idActorProductivoMinero', required: false, type: String })
  @ApiQuery({ name: 'estado', required: false, enum: ['EN_POSESION', 'VENDIDO', 'DEVUELTO'] })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Listado paginado obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listar(@Query() filtro: FiltroBienDacionPagoDto) {
    return await this.bienDacionPagoService.listar(filtro);
  }

  @Get('bien-dacion-pago/:id')
  @Auth()
  @ApiOperation({ summary: 'Obtener un bien por id' })
  @ApiParam({ name: 'id', description: 'Id del bien.', example: '3' })
  @ApiOkResponse({ description: 'Bien obtenido correctamente.', type: BienDacionPago })
  @ApiNotFoundResponse({ description: 'No se encontró el bien.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async buscarPorId(@Param('id') id: string): Promise<BienDacionPago> {
    return await this.bienDacionPagoService.buscarPorId(id);
  }
}
