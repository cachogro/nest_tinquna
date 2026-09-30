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
  Res,
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
import { Response } from 'express';

import { Auth, GetUser } from 'src/security/decorators';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FondoRendirService } from '../services/fondo-rendir.service';
import { FondoRendirExcelService } from '../services/fondo-rendir-excel.service';
import { FondoRendir } from '../entities/fondo-rendir.entity';
import { CreateFondoRendirDto } from '../dto/fondo-rendir/create-fondo-rendir.dto';
import { CreateFondoRendirDetalleDto } from '../dto/fondo-rendir/create-fondo-rendir-detalle.dto';
import { FiltroFondoRendirDto } from '../dto/fondo-rendir/filtro-fondo-rendir.dto';
import { FiltroFondoRendirExcelDto } from '../dto/fondo-rendir/filtro-fondo-rendir-excel.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class FondoRendirController {
  constructor(
    private readonly fondoRendirService: FondoRendirService,
    private readonly fondoRendirExcelService: FondoRendirExcelService,
  ) {}

  @Post('fondo-rendir')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Entregar un fondo a rendir cuentas',
    description:
      'Entrega una plata puntual a una persona o a un actor productivo minero (excluyentes) para un propósito concreto (ej. comprar materiales). Genera en el mismo paso el recibo de EGRESO real que mueve la plata (efectivo -> caja de flujo; medio bancario -> libreta de bancos, mismo criterio que un recibo común) y queda en estado PENDIENTE. `fechaHoraEntrega` (fecha y hora reales del registro, con hora) la asigna el servidor automáticamente, no se envía: `fecha` sigue siendo la fecha de negocio (editable, sin hora). A diferencia del kardex de anticipos, esto NO genera automáticamente una deuda en el kardex del destinatario: el fondo se justifica de a poco con `POST /contabilidad/fondo-rendir/detalle`, y solo si queda un saldo sin justificar, un administrador puede cargarlo manualmente al kardex con `POST /contabilidad/fondo-rendir/:id/cerrar-con-deuda`.',
  })
  @ApiBody({
    type: CreateFondoRendirDto,
    examples: {
      entrega: {
        summary: 'Entrega de 100 para materiales',
        value: {
          idPersona: '20',
          fecha: '2026-09-23',
          concepto: 'ADELANTO PARA COMPRA DE MATERIALES',
          monto: 100,
          idFormaPago: 1,
          idDestinoGasto: 13,
          idPersonaAutorizo: '7',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Fondo entregado correctamente, con el recibo de egreso que generó.',
    type: FondoRendir,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, destinatario inactivo, o la caja/cuenta bancaria no está aperturada.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la persona, el actor, el destino del gasto, o quien autoriza.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async entregar(
    @Body() body: CreateFondoRendirDto,
    @GetUser() user: Usuario,
  ) {
    return await this.fondoRendirService.entregar(body, user);
  }

  @Post('fondo-rendir/detalle')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Justificar un fondo a rendir (agregar/actualizar un comprobante de gasto)',
    description:
      'Sin `id` agrega una línea de justificación; con `id` la actualiza. No mueve plata: es solo evidencia de en qué se gastó. La suma de líneas activas PUEDE superar el monto entregado (el destinatario adelantó plata propia): en ese caso el fondo queda RENDIDO_EN_EXCESO y `montoPorReponer` (en vez de `saldoPendiente`) indica cuánto le debe la empresa a él. Recalcula el estado del fondo (PENDIENTE / RENDIDO_PARCIAL / RENDIDO_TOTAL / RENDIDO_EN_EXCESO). Falla si el fondo ya está CERRADO_CON_DEUDA.',
  })
  @ApiBody({
    type: CreateFondoRendirDetalleDto,
    examples: {
      justificacion: {
        summary: 'Justificar 90 de un fondo de 100',
        value: {
          idFondoRendir: 4,
          fecha: '2026-09-25',
          concepto: 'COMPRA DE CEMENTO - 5 BOLSAS',
          monto: 90,
          nroComprobante: 'FAC-0456',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Fondo con la justificación aplicada.',
    type: FondoRendir,
  })
  @ApiBadRequestResponse({
    description: 'El fondo está cerrado con deuda.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el fondo, la línea, o el destino del gasto.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async justificar(
    @Body() body: CreateFondoRendirDetalleDto,
    @GetUser() user: Usuario,
  ) {
    return await this.fondoRendirService.justificar(body, user);
  }

  @Patch('fondo-rendir/detalle/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Activar o desactivar una línea de justificación',
    description: 'Baja lógica de una línea. Recalcula el estado del fondo.',
  })
  @ApiParam({ name: 'id', description: 'Id de la línea de justificación.', example: '5' })
  @ApiBody({
    schema: { type: 'object', properties: { activo: { type: 'boolean', example: false } } },
  })
  @ApiOkResponse({ description: 'Fondo actualizado.', type: FondoRendir })
  @ApiBadRequestResponse({ description: 'El fondo está cerrado con deuda.' })
  @ApiNotFoundResponse({ description: 'No se encontró la línea o el fondo.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cambiarEstadoDetalle(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
    return await this.fondoRendirService.cambiarEstadoDetalle(id, activo, user);
  }

  @Post('fondo-rendir/:id/cerrar-con-deuda')
  @Auth()
  @ApiOperation({
    summary: 'Cargar el saldo sin justificar al kardex personal del destinatario',
    description:
      'Acción manual y opcional del administrador (no automática): cuando ya pasó tiempo y no se espera más justificación ni devolución, carga el saldo pendiente como una línea DEBE en el kardex ABIERTO del destinatario. NO genera ningún movimiento nuevo de caja/banco (esa plata ya salió al entregar el fondo). Deja el fondo en estado terminal CERRADO_CON_DEUDA: ya no admite más justificaciones. Falla si no hay saldo pendiente (incluye el caso RENDIDO_EN_EXCESO: ahí no hay nada que cargarle, al revés, la empresa le debe a él) o si el destinatario no tiene un kardex ABIERTO.',
  })
  @ApiParam({ name: 'id', description: 'Id del fondo a rendir.', example: '4' })
  @ApiOkResponse({
    description: 'Fondo cerrado con deuda, con el movimiento de kardex que generó.',
    type: FondoRendir,
  })
  @ApiBadRequestResponse({
    description: 'El fondo ya está cerrado, no tiene saldo pendiente, o el destinatario no tiene kardex abierto.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el fondo a rendir.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cerrarConDeuda(@Param('id') id: string, @GetUser() user: Usuario) {
    return await this.fondoRendirService.cerrarConDeuda(id, user);
  }

  @Get('fondo-rendir')
  @Auth()
  @ApiOperation({
    summary: 'Listar fondos a rendir cuentas',
    description:
      'Paginado. Cada fila trae `montoJustificado`, `saldoPendiente` y `montoPorReponer` calculados (mutuamente excluyentes: uno de los dos últimos siempre es 0). Filtros opcionales: persona, actor, estado y rango de fechas.',
  })
  @ApiQuery({ name: 'idPersona', required: false, type: String })
  @ApiQuery({ name: 'idActorProductivoMinero', required: false, type: String })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['PENDIENTE', 'RENDIDO_PARCIAL', 'RENDIDO_TOTAL', 'RENDIDO_EN_EXCESO', 'CERRADO_CON_DEUDA'],
  })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Listado paginado obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listar(@Query() filtro: FiltroFondoRendirDto) {
    return await this.fondoRendirService.listar(filtro);
  }

  @Get('fondo-rendir/excel')
  @Auth()
  @ApiOperation({
    summary: 'Exportar la rendición de cuentas de un destinatario a Excel',
    description:
      'Genera el .xlsx "RENDICIÓN DE CUENTAS" de una persona o un actor productivo minero (excluyentes), mezclando cronológicamente sus entregas de fondo (columna CARGO) y todas sus líneas de justificación (columna DESCARGO, de cualquiera de sus fondos, no solo los abiertos en el período) con saldo corriente, igual formato que el modelo físico de la empresa. Con `mes` es el reporte MENSUAL de ese mes; sin `mes`, el ANUAL (toda la gestión). Al final marca "POR REPONER A" (si se justificó de más) o "SALDO PENDIENTE POR RENDIR" (si falta justificar), según corresponda.',
  })
  @ApiQuery({ name: 'idPersona', required: false, type: String })
  @ApiQuery({ name: 'idActorProductivoMinero', required: false, type: String })
  @ApiQuery({ name: 'gestion', required: true, type: Number, example: 2026 })
  @ApiQuery({ name: 'mes', required: false, type: Number, example: 3 })
  @ApiOkResponse({ description: 'Archivo .xlsx generado correctamente.' })
  @ApiBadRequestResponse({
    description: 'Falta el destinatario, o se indicaron ambos (idPersona e idActorProductivoMinero) a la vez.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la persona o el actor.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async exportarExcel(
    @Query() filtro: FiltroFondoRendirExcelDto,
    @GetUser() user: Usuario,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.fondoRendirExcelService.generar(filtro, user);
    const destinatario = filtro.idPersona ?? filtro.idActorProductivoMinero ?? 'destinatario';
    const periodo = filtro.mes
      ? `${filtro.gestion}-${String(filtro.mes).padStart(2, '0')}`
      : `${filtro.gestion}-anual`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=rendicion-cuentas-${destinatario}-${periodo}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('fondo-rendir/:id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener un fondo a rendir por id',
    description:
      'Devuelve el fondo con sus líneas de justificación (`detalles`), el recibo que lo respalda, y `montoJustificado`/`saldoPendiente`/`montoPorReponer` calculados.',
  })
  @ApiParam({ name: 'id', description: 'Id del fondo a rendir.', example: '4' })
  @ApiOkResponse({ description: 'Fondo obtenido correctamente.', type: FondoRendir })
  @ApiNotFoundResponse({ description: 'No se encontró el fondo a rendir.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async buscarPorId(@Param('id') id: string) {
    return await this.fondoRendirService.buscarPorId(id);
  }
}
