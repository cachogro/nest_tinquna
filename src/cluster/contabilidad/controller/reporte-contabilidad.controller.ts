import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Auth } from 'src/security/decorators';
import { ReporteDestinoGastoService } from '../services/reporte-destino-gasto.service';
import { FiltroReporteDestinoGastoDto } from '../dto/reporte/filtro-reporte-destino-gasto.dto';

@ApiTags('Contabilidad - Reportes')
@Controller('contabilidad/reportes')
@ApiBearerAuth()
export class ReporteContabilidadController {
  constructor(
    private readonly reporteDestinoGastoService: ReporteDestinoGastoService,
  ) {}

  @Get('destino-gasto')
  @Auth()
  @ApiOperation({
    summary: 'Resumen de caja + bancos agrupado por destino del gasto',
    description:
      'Una fila por destino de gasto con el total ingresado (ganado), el total egresado (gastado) y el neto (ingreso - egreso), combinando los movimientos vigentes de la caja de flujo (efectivo) y de la libreta de bancos (todas las cuentas de la moneda pedida): un recibo o movimiento de kardex pagado por banco no genera fila en la caja, así que sin esto quedaría afuera. Excluye los traspasos internos caja/banco (no son gasto/ingreso real). La moneda es obligatoria porque no se mezclan monedas. Los movimientos sin destino aparecen como "SIN DESTINO". Filtros opcionales: caja (solo afecta el lado efectivo), cuenta bancaria (solo afecta el lado banco) y rango de fechas.',
  })
  @ApiQuery({ name: 'moneda', required: true, enum: ['BS', 'USD'] })
  @ApiQuery({ name: 'idCaja', required: false, type: Number })
  @ApiQuery({ name: 'idCuentaBancaria', required: false, type: Number })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiOkResponse({ description: 'Resumen generado correctamente.' })
  @ApiBadRequestResponse({ description: 'Filtros inválidos.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async resumen(@Query() filtro: FiltroReporteDestinoGastoDto) {
    return await this.reporteDestinoGastoService.resumen(filtro);
  }

  @Get('destino-gasto/:id')
  @Auth()
  @ApiOperation({
    summary: 'Detalle de un destino del gasto',
    description:
      'Movimientos de caja y de banco de un destino puntual (ej. id 4, venta de combustible), combinados y en orden cronológico (`origen`: CAJA o BANCO), con sus totales de ingreso, egreso y neto. Mismos filtros y exclusión de traspasos que el resumen.',
  })
  @ApiParam({ name: 'id', description: 'Id del destino del gasto.', example: 4 })
  @ApiQuery({ name: 'moneda', required: true, enum: ['BS', 'USD'] })
  @ApiQuery({ name: 'idCaja', required: false, type: Number })
  @ApiQuery({ name: 'idCuentaBancaria', required: false, type: Number })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiOkResponse({ description: 'Detalle generado correctamente.' })
  @ApiBadRequestResponse({ description: 'Filtros inválidos.' })
  @ApiNotFoundResponse({ description: 'No se encontró el destino de gasto.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async detalle(
    @Param('id', ParseIntPipe) id: number,
    @Query() filtro: FiltroReporteDestinoGastoDto,
  ) {
    return await this.reporteDestinoGastoService.detalle(id, filtro);
  }
}
