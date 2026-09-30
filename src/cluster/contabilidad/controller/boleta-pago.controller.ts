import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
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
import { BoletaPagoService } from '../services/boleta-pago.service';
import { BoletaPagoPdfService } from '../services/boleta-pago-pdf.service';
import { BoletaPago } from '../entities/boleta-pago.entity';
import { CreateBoletaPagoDto } from '../dto/boleta-pago/create-boleta-pago.dto';
import { FiltroBoletaPagoDto } from '../dto/boleta-pago/filtro-boleta-pago.dto';
import { ResumenBoletaPagoDto } from '../dto/boleta-pago/resumen-boleta-pago.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class BoletaPagoController {
  constructor(
    private readonly boletaPagoService: BoletaPagoService,
    private readonly boletaPagoPdfService: BoletaPagoPdfService,
  ) {}

  @Get('boleta-pago/preparar/:idPersona')
  @Auth()
  @ApiOperation({
    summary: 'Datos para armar una boleta de pago',
    description:
      'Devuelve el salario mensual registrado, el kardex PERSONAL y los préstamos VIGENTES de la persona con el descuento sugerido de cada uno (cuota pactada, o el saldo si es menor). No guarda nada.',
  })
  @ApiParam({ name: 'idPersona', description: 'Id de la persona.', example: '18' })
  @ApiOkResponse({ description: 'Datos obtenidos correctamente.' })
  @ApiBadRequestResponse({ description: 'La persona está inactiva o no es personal de la empresa.' })
  @ApiNotFoundResponse({ description: 'No se encontró la persona.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async preparar(@Param('idPersona') idPersona: string) {
    return await this.boletaPagoService.preparar(idPersona);
  }

  @Post('boleta-pago')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir y pagar una boleta de pago',
    description:
      'Boleta con el salario completo por ley (total ganado, descuentos de ley, líquido pagable). Internamente descuenta lo indicado para préstamos: cada descuento es un HABER en el kardex PERSONAL SIN movimiento de caja/banco, más la línea DESCUENTO_SUELDO del préstamo. Solo el resto (`montoPagado`) sale de caja/banco con un recibo de EGRESO; si todo el líquido va a préstamos no se genera recibo. No se puede anular una vez pagada.',
  })
  @ApiBody({
    type: CreateBoletaPagoDto,
    examples: {
      cuotaPactada: {
        summary: 'Descontar la cuota pactada (sin enviar descuentos)',
        value: {
          idPersona: '18',
          fechaDesde: '2026-02-28',
          fechaHasta: '2026-03-28',
          fechaPago: '2026-03-28',
          idFormaPago: 1,
          idPersonaAutorizo: '7',
          idDestinoGasto: 45,
        },
      },
      pagaMas: {
        summary: 'El empleado decide descontar más este mes',
        value: {
          idPersona: '18',
          fechaDesde: '2026-03-28',
          fechaHasta: '2026-04-28',
          fechaPago: '2026-04-28',
          diasTrabajados: 30,
          bonoAntiguedad: 0,
          aporteLaboral: 0,
          descuentos: [{ idPrestamo: '3', monto: 2000 }],
          idFormaPago: 1,
          idPersonaAutorizo: '7',
          idDestinoGasto: 45,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Boleta emitida y pagada.', type: BoletaPago })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, persona sin salario, descuentos que superan el saldo del préstamo o el líquido pagable, kardex PERSONAL cerrado/inactivo, o caja/cuenta no aperturada.',
  })
  @ApiConflictResponse({ description: 'Ya existe una boleta para un periodo que se superpone.' })
  @ApiNotFoundResponse({ description: 'No se encontró la persona o un préstamo.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async emitir(
    @Body() body: CreateBoletaPagoDto,
    @GetUser() user: Usuario,
  ): Promise<BoletaPago> {
    return await this.boletaPagoService.emitir(body, user);
  }

  @Get('boleta-pago')
  @Auth()
  @ApiOperation({
    summary: 'Listar boletas de pago',
    description: 'Paginado. Filtros opcionales: persona y rango de fecha de pago.',
  })
  @ApiQuery({ name: 'idPersona', required: false, type: String })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Listado paginado obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listar(@Query() filtro: FiltroBoletaPagoDto) {
    return await this.boletaPagoService.listar(filtro);
  }

  // Antes de 'boleta-pago/:id': si no, ":id" capturaría "resumen".
  @Get('boleta-pago/resumen')
  @Auth()
  @ApiOperation({
    summary: 'Resumen mensual de sueldos pagados',
    description:
      'Del personal interno que trabajaba en el mes: cuántos ya tienen boleta PAGADA (por fecha de pago) y quiénes faltan. Sin gestion/mes, el mes actual.',
  })
  @ApiOkResponse({ description: 'Resumen obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async resumen(@Query() q: ResumenBoletaPagoDto) {
    return await this.boletaPagoService.resumenMensual(q.gestion, q.mes);
  }

  @Get('boleta-pago/:id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener una boleta de pago',
    description: 'Incluye el recibo del neto y `descuentosPrestamo` (con su préstamo).',
  })
  @ApiParam({ name: 'id', description: 'Id de la boleta.', example: '5' })
  @ApiOkResponse({ description: 'Boleta obtenida correctamente.', type: BoletaPago })
  @ApiNotFoundResponse({ description: 'No se encontró la boleta.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async buscarPorId(@Param('id') id: string): Promise<BoletaPago> {
    return await this.boletaPagoService.buscarPorId(id);
  }

  @Get('boleta-pago/:id/pdf')
  @Auth()
  @ApiOperation({
    summary: 'Generar el PDF de una boleta de pago (3 copias en hoja carta)',
    description:
      'Mismo formato que el recibo vertical: hoja carta con 3 copias (Original, Copia 1, Copia 2), logo, N° de boleta, fecha de pago y N° del recibo del neto. Muestra datos del empleado, periodo, INGRESOS y DESCUENTOS DE LEY hasta el LÍQUIDO PAGABLE. Por defecto agrega la columna DESCUENTO PRÉSTAMOS y el NETO RECIBIDO (monto en letras del neto); con `interno=false` imprime solo la parte de ley (monto en letras del líquido pagable). "Entregue conforme" se llena con el usuario que pide el PDF; "Recibi conforme" con el empleado.',
  })
  @ApiParam({ name: 'id', description: 'Id de la boleta.', example: '5' })
  @ApiQuery({
    name: 'interno',
    required: false,
    type: Boolean,
    description: 'false = ocultar el descuento de préstamos. Por defecto true.',
  })
  @ApiOkResponse({ description: 'PDF generado correctamente.' })
  @ApiNotFoundResponse({ description: 'No se encontró la boleta.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async descargarPdf(
    @Param('id') id: string,
    @Query('interno') interno: string | undefined,
    @GetUser() user: Usuario,
    @Res() res: Response,
  ) {
    const boleta = await this.boletaPagoService.buscarPorId(id);
    const pdf = await this.boletaPagoPdfService.generar(boleta, user, interno !== 'false');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=Boleta-Pago-${String(boleta.numero).padStart(4, '0')}.pdf`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }
}
