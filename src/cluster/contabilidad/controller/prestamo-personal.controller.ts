import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { PrestamoPersonalService } from '../services/prestamo-personal.service';
import { PrestamoPersonal } from '../entities/prestamo-personal.entity';
import { CreatePrestamoPersonalDto } from '../dto/prestamo-personal/create-prestamo-personal.dto';
import { AbonarPrestamoDto } from '../dto/prestamo-personal/abonar-prestamo.dto';
import { ActualizarCuotaPrestamoDto } from '../dto/prestamo-personal/actualizar-cuota-prestamo.dto';
import { FiltroPrestamoPersonalDto } from '../dto/prestamo-personal/filtro-prestamo-personal.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class PrestamoPersonalController {
  constructor(private readonly prestamoPersonalService: PrestamoPersonalService) {}

  @Post('prestamo-personal')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Otorgar un préstamo al personal',
    description:
      'Préstamo a un empleado (personal de la empresa con kardex PERSONAL abierto), ej. compra de una moto. En una sola transacción: recibo de EGRESO (sale de caja o, con idCuentaBancaria, de la libreta de bancos), DEBE en su kardex PERSONAL y la línea OTORGAMIENTO del sub-libro del préstamo, que lleva su saldo propio aparte de los demás anticipos del kardex.',
  })
  @ApiBody({
    type: CreatePrestamoPersonalDto,
    examples: {
      efectivo: {
        summary: 'Préstamo en efectivo para una moto',
        value: {
          idPersona: '18',
          fecha: '2026-09-29',
          descripcion: 'COMPRA DE MOTO HONDA XR150',
          monto: 12000,
          cuotaMensual: 1000,
          idFormaPago: 1,
          idPersonaAutorizo: '7',
          observaciones: 'PACTADO CON GERENCIA, 12 CUOTAS.',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Préstamo otorgado.', type: PrestamoPersonal })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, la persona no es personal de la empresa, no tiene kardex PERSONAL abierto/activo, la cuota supera el monto, o la caja/cuenta no está aperturada.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la persona.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async otorgar(
    @Body() body: CreatePrestamoPersonalDto,
    @GetUser() user: Usuario,
  ): Promise<PrestamoPersonal> {
    return await this.prestamoPersonalService.otorgar(body, user);
  }

  @Post('prestamo-personal/:id/abono')
  @Auth()
  @ApiOperation({
    summary: 'Abonar a un préstamo con dinero propio',
    description:
      'El empleado paga parte o todo el préstamo con dinero de otro lado (fuera del sueldo). Genera un recibo de INGRESO (entra a caja o banco), el HABER en su kardex PERSONAL y la línea ABONO del sub-libro. El préstamo pasa a CANCELADO si el saldo llega a 0.',
  })
  @ApiParam({ name: 'id', description: 'Id del préstamo.', example: '3' })
  @ApiBody({
    type: AbonarPrestamoDto,
    examples: {
      abono: {
        summary: 'Abono en efectivo',
        value: { fecha: '2026-10-15', monto: 2000, idFormaPago: 1, idPersonaAutorizo: '7' },
      },
    },
  })
  @ApiOkResponse({ description: 'Abono registrado.', type: PrestamoPersonal })
  @ApiBadRequestResponse({ description: 'El préstamo está CANCELADO o el abono supera el saldo.' })
  @ApiNotFoundResponse({ description: 'No se encontró el préstamo.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async abonar(
    @Param('id') id: string,
    @Body() body: AbonarPrestamoDto,
    @GetUser() user: Usuario,
  ): Promise<PrestamoPersonal> {
    return await this.prestamoPersonalService.abonar(id, body, user);
  }

  @Patch('prestamo-personal/:id/cuota')
  @Auth()
  @ApiOperation({
    summary: 'Cambiar la cuota mensual pactada',
    description:
      'Renegocia la cuota que se sugiere descontar en cada boleta. No mueve dinero. Solo préstamos VIGENTES.',
  })
  @ApiParam({ name: 'id', description: 'Id del préstamo.', example: '3' })
  @ApiBody({ type: ActualizarCuotaPrestamoDto })
  @ApiOkResponse({ description: 'Cuota actualizada.', type: PrestamoPersonal })
  @ApiBadRequestResponse({ description: 'El préstamo está CANCELADO.' })
  @ApiNotFoundResponse({ description: 'No se encontró el préstamo.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async actualizarCuota(
    @Param('id') id: string,
    @Body() body: ActualizarCuotaPrestamoDto,
    @GetUser() user: Usuario,
  ): Promise<PrestamoPersonal> {
    return await this.prestamoPersonalService.actualizarCuota(id, body, user);
  }

  @Get('prestamo-personal')
  @Auth()
  @ApiOperation({
    summary: 'Listar préstamos al personal',
    description: 'Paginado. Filtros opcionales: persona y estado.',
  })
  @ApiQuery({ name: 'idPersona', required: false, type: String })
  @ApiQuery({ name: 'estado', required: false, enum: ['VIGENTE', 'CANCELADO'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Listado paginado obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listar(@Query() filtro: FiltroPrestamoPersonalDto) {
    return await this.prestamoPersonalService.listar(filtro);
  }

  @Get('prestamo-personal/:id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener un préstamo con su sub-libro',
    description: 'Incluye `movimientos` (OTORGAMIENTO, DESCUENTO_SUELDO, ABONO) con su saldo corriente.',
  })
  @ApiParam({ name: 'id', description: 'Id del préstamo.', example: '3' })
  @ApiOkResponse({ description: 'Préstamo obtenido correctamente.', type: PrestamoPersonal })
  @ApiNotFoundResponse({ description: 'No se encontró el préstamo.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async buscarPorId(@Param('id') id: string): Promise<PrestamoPersonal> {
    return await this.prestamoPersonalService.buscarPorId(id);
  }
}
