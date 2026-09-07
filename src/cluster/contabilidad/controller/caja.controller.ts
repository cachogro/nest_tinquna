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
import { MovimientoCajaService } from '../services/movimiento-caja.service';
import { MovimientoCaja } from '../entities/movimiento-caja.entity';
import { PeriodoCaja } from '../entities/periodo-caja.entity';
import { CreateMovimientoCajaDto } from '../dto/movimiento-caja/create-movimiento-caja.dto';
import { FiltroMovimientoCajaDto } from '../dto/movimiento-caja/filtro-movimiento-caja.dto';
import { CerrarPeriodoCajaDto } from '../dto/movimiento-caja/cerrar-periodo-caja.dto';
import { CerrarGestionCajaDto } from '../dto/movimiento-caja/cerrar-gestion-caja.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class CajaController {
  constructor(private readonly movimientoCajaService: MovimientoCajaService) {}

  //--------------------------- Caja de flujo --------------------------------

  @Post('movimiento-caja')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un movimiento de la caja de flujo',
    description:
      'Sin `id` registra un movimiento; con `id` lo actualiza. El movimiento cae en el período mensual de su fecha y moneda (se crea si no existe). No se puede tocar un movimiento de un período cerrado: para corregir, se registra una regularización en el período abierto. El `saldo` corriente y el `folio` los asigna el servicio, por separado para cada moneda; INGRESO = entrada de efectivo, EGRESO = salida.',
  })
  @ApiBody({
    type: CreateMovimientoCajaDto,
    examples: {
      egreso: {
        summary: 'Egreso (EGRESO)',
        value: {
          idCaja: 1,
          moneda: 'BOB',
          fecha: '2025-07-01',
          nroComprobante: 'REC:R-0084',
          nombresApellidos: 'IVAR CALLAHUANCA',
          concepto: 'COMPRA DE DIESEL',
          idDestinoGasto: 21,
          tipo: 'EGRESO',
          monto: 1260,
        },
      },
      ingreso: {
        summary: 'Ingreso (INGRESO)',
        value: {
          idCaja: 1,
          moneda: 'BOB',
          fecha: '2025-07-01',
          nroComprobante: 'REC:R-0009',
          nombresApellidos: 'RAFAEL DOUCHEN',
          concepto: 'VENTA DE DIESEL DE 400 LTRS. A 7.-BS DEL GALPON DE ARRIBA',
          idDestinoGasto: 2,
          tipo: 'INGRESO',
          monto: 2800,
        },
      },
      beneficiarioRegistrado: {
        summary: 'Beneficiario ya registrado (persona_ci)',
        value: {
          idCaja: 1,
          moneda: 'BOB',
          fecha: '2025-07-01',
          nroComprobante: 'REC:C-0535',
          idPersona: '15',
          concepto: 'ANTICIPO A CTA SACO MINERAL',
          idDestinoGasto: 13,
          tipo: 'EGRESO',
          monto: 3500,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Movimiento registrado o actualizado correctamente.',
    type: MovimientoCaja,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, caja inactiva, o el período de la fecha/moneda está cerrado.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la caja, la persona, la forma de pago, el destino del gasto, o el movimiento a actualizar.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async guardarMovimiento(
    @Body() body: CreateMovimientoCajaDto,
    @GetUser() user: Usuario,
  ): Promise<MovimientoCaja> {
    return await this.movimientoCajaService.guardar(body, user);
  }

  @Patch('movimiento-caja/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Activar o desactivar un movimiento de caja',
    description:
      'Baja lógica de un movimiento. Solo si su período está abierto. Recalcula el saldo de la caja para esa moneda.',
  })
  @ApiParam({ name: 'id', description: 'Id del movimiento.', example: '15' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { activo: { type: 'boolean', example: false } },
    },
  })
  @ApiOkResponse({
    description: 'Estado del movimiento actualizado.',
    type: MovimientoCaja,
  })
  @ApiBadRequestResponse({
    description: 'El movimiento pertenece a un período cerrado.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el movimiento.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cambiarEstadoMovimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<MovimientoCaja> {
    return await this.movimientoCajaService.cambiarEstado(id, activo, user);
  }

  @Get('movimiento-caja')
  @Auth()
  @ApiOperation({
    summary: 'Listar la caja de flujo de una caja',
    description:
      'Devuelve los movimientos de una caja en una moneda (filtrables por gestión y mes), los períodos correspondientes y los datos de la caja (incluido su saldo inicial en esa moneda). Sin paginación.',
  })
  @ApiQuery({ name: 'idCaja', required: true, type: Number, example: 1 })
  @ApiQuery({ name: 'moneda', required: true, enum: ['BOB', 'USD'], example: 'BOB' })
  @ApiQuery({ name: 'gestion', required: false, type: Number, example: 2025 })
  @ApiQuery({ name: 'mes', required: false, type: Number, example: 7 })
  @ApiOkResponse({ description: 'Caja de flujo obtenida correctamente.' })
  @ApiBadRequestResponse({ description: 'Caja inactiva o filtros inválidos.' })
  @ApiNotFoundResponse({ description: 'No se encontró la caja.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listarCaja(@Query() filtro: FiltroMovimientoCajaDto) {
    return await this.movimientoCajaService.listar(filtro);
  }

  //--------------------------- Períodos y cierres --------------------------

  @Get('movimiento-caja/periodo')
  @Auth()
  @ApiOperation({
    summary: 'Listar los períodos de una caja en una moneda',
    description:
      'Devuelve todos los períodos (mensuales y de gestión) de una caja en una moneda, con sus totales, saldo inicial y saldo final.',
  })
  @ApiQuery({ name: 'idCaja', required: true, type: Number, example: 1 })
  @ApiQuery({ name: 'moneda', required: true, enum: ['BOB', 'USD'], example: 'BOB' })
  @ApiOkResponse({
    description: 'Períodos obtenidos correctamente.',
    type: PeriodoCaja,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'No se encontró la caja.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listarPeriodos(
    @Query('idCaja', ParseIntPipe) idCaja: number,
    @Query('moneda') moneda: 'BOB' | 'USD',
  ): Promise<PeriodoCaja[]> {
    return await this.movimientoCajaService.listarPeriodos(idCaja, moneda);
  }

  @Post('movimiento-caja/periodo/cerrar')
  @Auth()
  @ApiOperation({
    summary: 'Cerrar un período mensual de caja',
    description:
      'Sella el mes: sus movimientos quedan inmutables, se fija `saldo_final = saldo_inicial + ingresos - egresos`, y ese saldo pasa como saldo inicial del mes siguiente (misma moneda). Requiere que el mes anterior ya esté cerrado (contigüidad).',
  })
  @ApiBody({ type: CerrarPeriodoCajaDto })
  @ApiOkResponse({
    description: 'Período cerrado correctamente.',
    type: PeriodoCaja,
  })
  @ApiBadRequestResponse({
    description:
      'El período ya está cerrado, o el mes anterior sigue abierto, o la gestión está cerrada.',
  })
  @ApiNotFoundResponse({
    description: 'No hay movimientos registrados en ese mes para la caja.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cerrarPeriodo(
    @Body() body: CerrarPeriodoCajaDto,
    @GetUser() user: Usuario,
  ): Promise<PeriodoCaja> {
    return await this.movimientoCajaService.cerrarPeriodo(body, user);
  }

  @Post('movimiento-caja/periodo/reabrir')
  @Auth()
  @ApiOperation({
    summary: 'Reabrir un período mensual de caja',
    description:
      'Vuelve el mes a ABIERTO. Requiere que el mes siguiente NO esté cerrado y que la gestión NO esté cerrada (misma moneda).',
  })
  @ApiBody({ type: CerrarPeriodoCajaDto })
  @ApiOkResponse({
    description: 'Período reabierto correctamente.',
    type: PeriodoCaja,
  })
  @ApiBadRequestResponse({
    description:
      'El período no está cerrado, o el mes siguiente / la gestión están cerrados.',
  })
  @ApiNotFoundResponse({ description: 'No existe el período indicado.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async reabrirPeriodo(
    @Body() body: CerrarPeriodoCajaDto,
    @GetUser() user: Usuario,
  ): Promise<PeriodoCaja> {
    return await this.movimientoCajaService.reabrirPeriodo(body, user);
  }

  @Post('movimiento-caja/periodo/cerrar-gestion')
  @Auth()
  @ApiOperation({
    summary: 'Cerrar la gestión (año) de una caja en una moneda',
    description:
      'Solo se puede cerrar la gestión cuando sus 12 meses están cerrados. Registra el resumen anual (saldo inicial de enero, totales del año, saldo final de diciembre) y sella el año.',
  })
  @ApiBody({ type: CerrarGestionCajaDto })
  @ApiOkResponse({
    description: 'Gestión cerrada correctamente.',
    type: PeriodoCaja,
  })
  @ApiBadRequestResponse({
    description: 'Faltan meses por cerrar en la gestión.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la caja.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cerrarGestion(
    @Body() body: CerrarGestionCajaDto,
    @GetUser() user: Usuario,
  ): Promise<PeriodoCaja> {
    return await this.movimientoCajaService.cerrarGestion(body, user);
  }

  @Post('movimiento-caja/periodo/reabrir-gestion')
  @Auth()
  @ApiOperation({
    summary: 'Reabrir la gestión (año) de una caja en una moneda',
    description:
      'Vuelve la gestión a ABIERTO. Después se pueden reabrir los meses de ese año (en orden inverso).',
  })
  @ApiBody({ type: CerrarGestionCajaDto })
  @ApiOkResponse({
    description: 'Gestión reabierta correctamente.',
    type: PeriodoCaja,
  })
  @ApiBadRequestResponse({ description: 'La gestión no está cerrada.' })
  @ApiNotFoundResponse({
    description: 'No existe un cierre de gestión para esa caja/moneda.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async reabrirGestion(
    @Body() body: CerrarGestionCajaDto,
    @GetUser() user: Usuario,
  ): Promise<PeriodoCaja> {
    return await this.movimientoCajaService.reabrirGestion(body, user);
  }
}
