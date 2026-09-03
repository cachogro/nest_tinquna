import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';

import { Auth } from 'src/security/decorators';
import { ValorizacionMineralReportesService } from '../reports/valorizacion-mineral-reportes.service';
import { ValorizacionMineralReporteExcelService } from '../reports/valorizacion-mineral-reporte-excel.service';
import { FiltroReporteValorizacionDto } from '../dto/reportes/filtro-reporte-valorizacion.dto';

const QUERY_REPORTE = [
  {
    name: 'estado',
    required: false,
    enum: ['ambas', 'pre_valorizadas', 'valorizadas'],
    description:
      'Alcance por estado de la valorización. "ambas" (default) = pre-valorizadas (2) + valorizadas (3).',
  },
  {
    name: 'entregado',
    required: false,
    enum: ['ambos', 'entregados', 'no_entregados'],
    description:
      'Alcance por el campo entregado (material que salió del ingenio). "ambos" es el default.',
  },
  {
    name: 'idCodificacion',
    required: false,
    type: Number,
    example: 1,
    description:
      'Id de la codificación de la recepción (ej. ICC). Opcional: si se envía, ' +
      'trae solo las valorizaciones de esa codificación. Se combina con el resto de filtros.',
  },
  {
    name: 'fechaDesde',
    required: false,
    type: String,
    example: '2026-08-01',
    description: 'Rango explícito. No combinar con anio+mes/semana.',
  },
  {
    name: 'fechaHasta',
    required: false,
    type: String,
    example: '2026-08-31',
    description: 'Rango explícito. No combinar con anio+mes/semana.',
  },
  {
    name: 'anio',
    required: false,
    type: Number,
    example: 2026,
    description: 'Año a usar junto con "mes" o "semana".',
  },
  {
    name: 'mes',
    required: false,
    type: Number,
    example: 8,
    description: 'Mes (1-12), junto con "anio".',
  },
  {
    name: 'semana',
    required: false,
    type: Number,
    example: 32,
    description: 'Semana ISO (1-53), junto con "anio".',
  },
] as const;

@ApiTags('Reportes de Valorización de Mineral')
@Controller('comercio_interno/reportes/valorizacion_mineral')
@ApiBearerAuth()
export class ReportesValorizacionMineralController {
  constructor(
    private readonly reportesService: ValorizacionMineralReportesService,
    private readonly excelService: ValorizacionMineralReporteExcelService,
  ) {}

  @Get()
  @Auth()
  @ApiOperation({
    summary: 'Reporte de valorizaciones (JSON)',
    description:
      'Trae TODAS las valorizaciones que cumplan el filtro (no pagina), más un ' +
      'resumen con totales (sacos, peso, monto a pagar, cantidad entregados). ' +
      'Se puede acotar por estado (ambas / solo pre-valorizadas / solo ' +
      'valorizadas), por entregado (ambos / entregados / no entregados) y por ' +
      'fecha (rango explícito, o anio+mes, o anio+semana). Sin filtro de fecha ' +
      'devuelve todo el histórico.',
  })
  @ApiQuery(QUERY_REPORTE[0])
  @ApiQuery(QUERY_REPORTE[1])
  @ApiQuery(QUERY_REPORTE[2])
  @ApiQuery(QUERY_REPORTE[3])
  @ApiQuery(QUERY_REPORTE[4])
  @ApiQuery(QUERY_REPORTE[5])
  @ApiQuery(QUERY_REPORTE[6])
  @ApiQuery(QUERY_REPORTE[7])
  @ApiOkResponse({ description: 'Reporte generado correctamente.' })
  @ApiBadRequestResponse({
    description:
      'Combinación de filtros de fecha inválida (mes y semana a la vez, o mes/semana junto con fechaDesde/fechaHasta, o mes/semana sin año).',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async reporte(@Query() filtros: FiltroReporteValorizacionDto) {
    return await this.reportesService.reporte(filtros);
  }

  @Get('excel')
  @Auth()
  @ApiOperation({
    summary: 'Reporte de valorizaciones (Excel)',
    description:
      'Mismos datos y filtros que el reporte JSON, exportados a un archivo .xlsx ' +
      'con el formato de la Hoja3 (lote, referencia, sacos, peso, ley, monto a ' +
      'pagar, entregado) y una fila de totales.',
  })
  @ApiQuery(QUERY_REPORTE[0])
  @ApiQuery(QUERY_REPORTE[1])
  @ApiQuery(QUERY_REPORTE[2])
  @ApiQuery(QUERY_REPORTE[3])
  @ApiQuery(QUERY_REPORTE[4])
  @ApiQuery(QUERY_REPORTE[5])
  @ApiQuery(QUERY_REPORTE[6])
  @ApiQuery(QUERY_REPORTE[7])
  @ApiOkResponse({ description: 'Archivo .xlsx generado correctamente.' })
  @ApiBadRequestResponse({
    description: 'Combinación de filtros de fecha inválida.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async excel(
    @Query() filtros: FiltroReporteValorizacionDto,
    @Res() res: Response,
  ) {
    const buffer = await this.excelService.generar(filtros);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=reporte-valorizaciones.xlsx',
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
