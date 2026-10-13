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

import { Auth, RoleProtected } from 'src/security/decorators';
import { RolesModules } from 'src/security/enums/valid-roles';
import { ReportePlanCuentasService } from '../services/reporte-plan-cuentas.service';
import { FiltroReportePlanCuentasDto } from '../dto/reporte/filtro-reporte-plan-cuentas.dto';

@ApiTags('Contabilidad - Reportes')
@Controller('contabilidad/reportes')
@ApiBearerAuth()
@RoleProtected(...RolesModules.contabilidad)
export class ReporteContabilidadController {
  constructor(
    private readonly reportePlanCuentasService: ReportePlanCuentasService,
  ) {}

  @Get('plan-cuentas')
  @Auth()
  @ApiOperation({
    summary: 'Resumen de caja + bancos agrupado por plan de cuentas',
    description:
      'Una fila por plan de cuentas con el total ingresado (ganado), el total egresado (gastado) y el neto (ingreso - egreso), combinando los movimientos vigentes de la caja de flujo (efectivo) y de la libreta de bancos (todas las cuentas de la moneda pedida): un recibo o movimiento de kardex pagado por banco no genera fila en la caja, así que sin esto quedaría afuera. Excluye los traspasos internos caja/banco (no son gasto/ingreso real). La moneda es obligatoria porque no se mezclan monedas. Los movimientos sin destino aparecen como "SIN DESTINO". Filtros opcionales: caja (solo afecta el lado efectivo), cuenta bancaria (solo afecta el lado banco) y rango de fechas.',
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
  async resumen(@Query() filtro: FiltroReportePlanCuentasDto) {
    return await this.reportePlanCuentasService.resumen(filtro);
  }

  @Get('plan-cuentas/:id')
  @Auth()
  @ApiOperation({
    summary: 'Detalle de una cuenta del plan de cuentas',
    description:
      'Movimientos de caja y de banco de una cuenta puntual del plan de cuentas (ej. id 4, venta de combustible), combinados y en orden cronológico (`origen`: CAJA o BANCO), con sus totales de ingreso, egreso y neto. Mismos filtros y exclusión de traspasos que el resumen.',
  })
  @ApiParam({ name: 'id', description: 'Id del plan de cuentas.', example: 4 })
  @ApiQuery({ name: 'moneda', required: true, enum: ['BS', 'USD'] })
  @ApiQuery({ name: 'idCaja', required: false, type: Number })
  @ApiQuery({ name: 'idCuentaBancaria', required: false, type: Number })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiOkResponse({ description: 'Detalle generado correctamente.' })
  @ApiBadRequestResponse({ description: 'Filtros inválidos.' })
  @ApiNotFoundResponse({ description: 'No se encontró el plan de cuentas.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async detalle(
    @Param('id', ParseIntPipe) id: number,
    @Query() filtro: FiltroReportePlanCuentasDto,
  ) {
    return await this.reportePlanCuentasService.detalle(id, filtro);
  }
}
