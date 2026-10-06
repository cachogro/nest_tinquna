import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Auth } from 'src/security/decorators';
import { DashboardService } from './dashboard.service';
import { FiltroDashboardDto } from './dto/filtro-dashboard.dto';
import { FlujoDineroService } from './flujo-dinero.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@ApiBearerAuth()
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly flujoDineroService: FlujoDineroService,
  ) {}

  @Get('resumen')
  @Auth()
  @ApiOperation({
    summary: 'Resumen del negocio para la pantalla de inicio',
    description:
      'En una sola llamada: indicadores del período (mineral recibido, valorizado, pagado, ' +
      'liquidez, por cobrar/pagar) con comparación contra el período anterior de igual ' +
      'duración, lotes en proceso, rankings de proveedores y clientes, ingreso de mineral de ' +
      'los últimos 12 meses por codificación, deudores, cobranzas pendientes y alertas. ' +
      'Sin fechas: mes actual.',
  })
  @ApiBadRequestResponse({ description: 'Fechas inválidas o fechaDesde posterior a fechaHasta.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async resumen(@Query() filtro: FiltroDashboardDto) {
    return this.dashboardService.resumen(filtro);
  }

  @Get('flujo-dinero')
  @Auth()
  @ApiOperation({
    summary: 'Flujo de dinero diario y ganancia estimada',
    description:
      'Dinero que entró y salió en el período, sumando caja de flujo y libreta de bancos (sin ' +
      'traspasos internos): `totales` del período, `hoyFlujo` (siempre el día de hoy), `dias` ' +
      '(un renglón por día con movimientos), cada uno separado en efectivo Bs/$us y bancos ' +
      'Bs/$us (todas las cuentas unificadas) más el total en Bs. Los $us sin tipo de cambio ' +
      'van aparte en `usdSinTipoCambio` y no entran al total en Bs. `ganancia` = utilidad de ' +
      'los lotes liquidados en el período + otros ingresos − gastos operativos − sueldos, ' +
      'según la categoría de cada destino de gasto. Sin fechas: mes actual.',
  })
  @ApiBadRequestResponse({ description: 'Fechas inválidas o fechaDesde posterior a fechaHasta.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async flujoDinero(@Query() filtro: FiltroDashboardDto) {
    return this.flujoDineroService.resumen(filtro);
  }
}
