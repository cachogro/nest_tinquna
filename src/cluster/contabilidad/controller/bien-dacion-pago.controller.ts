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
import { BienDacionPagoService } from '../services/bien-dacion-pago.service';
import { BienDacionPago } from '../entities/bien-dacion-pago.entity';
import { CreateBienDacionPagoDto } from '../dto/bien-dacion-pago/create-bien-dacion-pago.dto';
import { VenderBienDacionPagoDto } from '../dto/bien-dacion-pago/vender-bien-dacion-pago.dto';
import { DevolverBienDacionPagoDto } from '../dto/bien-dacion-pago/devolver-bien-dacion-pago.dto';
import { FiltroBienDacionPagoDto } from '../dto/bien-dacion-pago/filtro-bien-dacion-pago.dto';
import { TomarEnPagoBienDacionPagoDto } from '../dto/bien-dacion-pago/tomar-en-pago-bien-dacion-pago.dto';
import { CreateBienDacionPagoGastoDto } from '../dto/bien-dacion-pago/create-bien-dacion-pago-gasto.dto';

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
      'Registra un bien (ej. una moto) que un actor productivo minero o una persona asociada entrega a cuenta de su deuda, por un valor acordado (`valorReferencial`, obligatorio). Queda EN_POSESION: la empresa lo retiene. El dueño debe tener ya un kardex ABIERTO. Registrar NO genera ningún movimiento de kardex ni de caja; eso ocurre al tomarlo en pago o al venderlo.',
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
  ) {
    return await this.bienDacionPagoService.registrar(body, user);
  }

  @Post('bien-dacion-pago/:id/vender')
  @Auth()
  @ApiOperation({
    summary: 'Registrar la venta de un bien en dación de pago',
    description:
      'Pasa el bien a VENDIDO. El precio entra DIRECTO a la caja de flujo (efectivo) o a la libreta de bancos (medio bancario, con idCuentaBancaria y nroComprobante), SIN generar recibo. Si el bien estaba TOMADO_EN_PAGO, el kardex del dueño ya se abonó al tomarlo: acá solo entra el dinero. Si estaba EN_POSESION (venta directa), en la misma transacción abona `montoAmortizar` como HABER en el kardex abierto del dueño (por defecto el valor acordado, o el precio si se vendió por menos); lo que sobre del precio es ganancia de la empresa. La respuesta trae `totalGastos`, `costoTotal` y `resultadoVenta` (precio − amortizado − gastos).',
  })
  @ApiParam({ name: 'id', description: 'Id del bien.', example: '3' })
  @ApiBody({ type: VenderBienDacionPagoDto })
  @ApiOkResponse({ description: 'Bien vendido, con el resultado de la venta.', type: BienDacionPago })
  @ApiBadRequestResponse({
    description:
      'El bien ya está VENDIDO o DEVUELTO, el dueño no tiene kardex abierto (venta directa), falta la forma de pago o quién autorizó, o la caja/cuenta no está aperturada.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el bien.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async vender(
    @Param('id') id: string,
    @Body() body: VenderBienDacionPagoDto,
    @GetUser() user: Usuario,
  ) {
    return await this.bienDacionPagoService.vender(id, body, user);
  }

  @Post('bien-dacion-pago/:id/tomar-en-pago')
  @Auth()
  @ApiOperation({
    summary: 'Tomar en pago un bien en dación (la empresa se queda con él)',
    description:
      'Solo si está EN_POSESION. Abona el valor acordado (o `montoAmortizar`) como HABER en el kardex abierto del dueño, SIN mover caja, y pasa el bien a TOMADO_EN_PAGO. Desde ahí el bien es de la empresa: ya no se puede devolver, se le pueden cargar gastos (`POST /:id/gasto`) y al venderlo solo entra el dinero.',
  })
  @ApiParam({ name: 'id', description: 'Id del bien.', example: '3' })
  @ApiBody({ type: TomarEnPagoBienDacionPagoDto })
  @ApiOkResponse({ description: 'Bien tomado en pago; deuda amortizada en el kardex.', type: BienDacionPago })
  @ApiBadRequestResponse({
    description: 'El bien no está EN_POSESION, o el dueño no tiene un kardex ABIERTO.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el bien.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async tomarEnPago(
    @Param('id') id: string,
    @Body() body: TomarEnPagoBienDacionPagoDto,
    @GetUser() user: Usuario,
  ) {
    return await this.bienDacionPagoService.tomarEnPago(id, body, user);
  }

  @Post('bien-dacion-pago/:id/gasto')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un gasto de un bien tomado en pago',
    description:
      'Gasto que la empresa le invierte al bien para venderlo mejor (cambio de nombre, arreglos, pintura...). Solo con el bien TOMADO_EN_PAGO. Sale DIRECTO de la caja de flujo (efectivo) o de la libreta de bancos (medio bancario), sin recibo, y NO toca el kardex del dueño. Suma al costo del bien y baja el resultado de su venta.',
  })
  @ApiParam({ name: 'id', description: 'Id del bien.', example: '3' })
  @ApiBody({ type: CreateBienDacionPagoGastoDto })
  @ApiCreatedResponse({ description: 'Bien con el gasto agregado.', type: BienDacionPago })
  @ApiBadRequestResponse({
    description:
      'El bien no está TOMADO_EN_PAGO, falta la forma de pago o quién autorizó, o la caja/cuenta no está aperturada.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el bien.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async registrarGasto(
    @Param('id') id: string,
    @Body() body: CreateBienDacionPagoGastoDto,
    @GetUser() user: Usuario,
  ) {
    return await this.bienDacionPagoService.registrarGasto(id, body, user);
  }

  @Patch('bien-dacion-pago/gasto/:idGasto/anular')
  @Auth()
  @ApiOperation({
    summary: 'Anular un gasto de un bien tomado en pago',
    description:
      'Da de baja el gasto y su egreso de caja o libreta (el saldo se recalcula). Solo mientras el bien sigue TOMADO_EN_PAGO y el período del movimiento está abierto.',
  })
  @ApiParam({ name: 'idGasto', description: 'Id del gasto.', example: '7' })
  @ApiOkResponse({ description: 'Bien con el gasto anulado.', type: BienDacionPago })
  @ApiBadRequestResponse({
    description: 'El gasto ya está anulado, el bien ya se vendió, o el período está cerrado.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el gasto.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async anularGasto(@Param('idGasto') idGasto: string, @GetUser() user: Usuario) {
    return await this.bienDacionPagoService.anularGasto(idGasto, user);
  }

  @Post('bien-dacion-pago/:id/devolver')
  @Auth()
  @ApiOperation({
    summary: 'Registrar la devolución de un bien en dación de pago',
    description:
      'Pasa el bien a estado DEVUELTO. Solo si está EN_POSESION (un bien TOMADO_EN_PAGO ya es de la empresa y no se devuelve). No genera ningún movimiento. `observaciones` es obligatorio: ahí se anota el motivo de la devolución.',
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
  ) {
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
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['EN_POSESION', 'TOMADO_EN_PAGO', 'VENDIDO', 'DEVUELTO'],
  })
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
  async buscarPorId(@Param('id') id: string) {
    return await this.bienDacionPagoService.buscarPorId(id);
  }
}
