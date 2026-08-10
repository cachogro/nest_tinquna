import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Auth } from 'src/security/decorators';
import { RecepcionMineralReportesService } from '../reports/recepcion-mineral-reportes.service';
import { FiltroReporteProduccionDto } from '../dto/reportes/filtro-reporte-produccion.dto';
import { FiltroReporteProveedorDto } from '../dto/reportes/filtro-reporte-proveedor.dto';
import { FiltroReporteCodigoMineralDto } from '../dto/reportes/filtro-reporte-codigo-mineral.dto';
import { FiltroReporteEstadoDto } from '../dto/reportes/filtro-reporte-estado.dto';
import { FiltroReporteCicloDto } from '../dto/reportes/filtro-reporte-ciclo.dto';
import { FiltroReporteAnticiposDto } from '../dto/reportes/filtro-reporte-anticipos.dto';

const QUERY_PERIODO = [
  {
    name: 'fechaDesde',
    required: false,
    type: String,
    example: '2026-08-01',
    description: 'Rango explícito. No combinar con mes/semana.',
  },
  {
    name: 'fechaHasta',
    required: false,
    type: String,
    example: '2026-08-31',
    description: 'Rango explícito. No combinar con mes/semana.',
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

@ApiTags('Reportes de Recepción de Mineral')
@Controller('comercio_interno/reportes/recepcion_mineral')
@ApiBearerAuth()
export class ReportesRecepcionMineralController {
  constructor(
    private readonly reportesService: RecepcionMineralReportesService,
  ) {}

  @Get('produccion')
  @Auth()
  @ApiOperation({
    summary: 'Producción por período (día/semana/mes/año)',
    description:
      'Totales de sacos, peso bruto/tara/neto agrupados por período. Requiere un rango acotado ' +
      '(fechaDesde/fechaHasta o anio+mes/semana) para no recorrer toda la tabla.',
  })
  @ApiQuery(QUERY_PERIODO[0])
  @ApiQuery(QUERY_PERIODO[1])
  @ApiQuery(QUERY_PERIODO[2])
  @ApiQuery(QUERY_PERIODO[3])
  @ApiQuery(QUERY_PERIODO[4])
  @ApiQuery({
    name: 'granularidad',
    required: false,
    enum: ['dia', 'semana', 'mes', 'anio'],
  })
  @ApiQuery({ name: 'idCodificacion', required: false, type: Number })
  @ApiQuery({ name: 'idEstado', required: false, type: Number })
  @ApiBadRequestResponse({
    description: 'No se indicó un rango de fechas, o la combinación mes/semana/fechas es inválida.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async produccion(@Query() filtros: FiltroReporteProduccionDto) {
    return await this.reportesService.produccionPorPeriodo(filtros);
  }

  @Get('proveedor')
  @Auth()
  @ApiOperation({
    summary: 'Histórico de un proveedor: volumen, frecuencia y anticipos',
    description:
      'Resumen de un proveedor específico. Sin fechaDesde/fechaHasta ni mes/semana, el resultado es acumulado (todo el histórico).',
  })
  @ApiQuery({ name: 'idPersona', required: true, type: Number })
  @ApiQuery(QUERY_PERIODO[0])
  @ApiQuery(QUERY_PERIODO[1])
  @ApiQuery(QUERY_PERIODO[2])
  @ApiQuery(QUERY_PERIODO[3])
  @ApiQuery(QUERY_PERIODO[4])
  @ApiBadRequestResponse({
    description: 'Combinación de filtros de fecha inválida.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async proveedor(@Query() filtros: FiltroReporteProveedorDto) {
    return await this.reportesService.porProveedor(filtros);
  }

  @Get('codigo_mineral')
  @Auth()
  @ApiOperation({
    summary: 'Volumen y proveedores por código de mineral (ej. ICC)',
    description:
      'Requiere un rango acotado (fechaDesde/fechaHasta o anio+mes/semana) para no recorrer toda la tabla.',
  })
  @ApiQuery(QUERY_PERIODO[0])
  @ApiQuery(QUERY_PERIODO[1])
  @ApiQuery(QUERY_PERIODO[2])
  @ApiQuery(QUERY_PERIODO[3])
  @ApiQuery(QUERY_PERIODO[4])
  @ApiQuery({ name: 'idEstado', required: false, type: Number })
  @ApiBadRequestResponse({
    description: 'No se indicó un rango de fechas, o la combinación mes/semana/fechas es inválida.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async codigoMineral(@Query() filtros: FiltroReporteCodigoMineralDto) {
    return await this.reportesService.porCodigoMineral(filtros);
  }

  @Get('estado')
  @Auth()
  @ApiOperation({
    summary: 'Cantidad de recepciones por estado (dashboard operativo)',
    description:
      'Conteo actual (o del período indicado) por estado: pendientes, aprobadas, en remuestreo, rechazadas, etc. No es una exportación masiva.',
  })
  @ApiQuery(QUERY_PERIODO[0])
  @ApiQuery(QUERY_PERIODO[1])
  @ApiQuery(QUERY_PERIODO[2])
  @ApiQuery(QUERY_PERIODO[3])
  @ApiQuery(QUERY_PERIODO[4])
  @ApiBadRequestResponse({
    description: 'Combinación de filtros de fecha inválida.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async porEstado(@Query() filtros: FiltroReporteEstadoDto) {
    return await this.reportesService.porEstado(filtros);
  }

  @Get('tiempo_ciclo')
  @Auth()
  @ApiOperation({
    summary: 'Tiempo de ciclo: recepción -> valorización asociada',
    description:
      'Promedio/mínimo/máximo de días entre la recepción y cada valorización asociada, para identificar cuellos de botella. ' +
      'Requiere un rango acotado (fechaDesde/fechaHasta o anio+mes/semana).',
  })
  @ApiQuery(QUERY_PERIODO[0])
  @ApiQuery(QUERY_PERIODO[1])
  @ApiQuery(QUERY_PERIODO[2])
  @ApiQuery(QUERY_PERIODO[3])
  @ApiQuery(QUERY_PERIODO[4])
  @ApiQuery({ name: 'idCodificacion', required: false, type: Number })
  @ApiQuery({ name: 'idEstado', required: false, type: Number })
  @ApiBadRequestResponse({
    description: 'No se indicó un rango de fechas, o la combinación mes/semana/fechas es inválida.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async tiempoCiclo(@Query() filtros: FiltroReporteCicloDto) {
    return await this.reportesService.tiempoCiclo(filtros);
  }

  @Get('anticipos')
  @Auth()
  @ApiOperation({
    summary: 'Anticipos entregados por período/proveedor',
    description:
      'Requiere un rango acotado (fechaDesde/fechaHasta o anio+mes/semana).',
  })
  @ApiQuery(QUERY_PERIODO[0])
  @ApiQuery(QUERY_PERIODO[1])
  @ApiQuery(QUERY_PERIODO[2])
  @ApiQuery(QUERY_PERIODO[3])
  @ApiQuery(QUERY_PERIODO[4])
  @ApiQuery({ name: 'idPersona', required: false, type: Number })
  @ApiBadRequestResponse({
    description: 'No se indicó un rango de fechas, o la combinación mes/semana/fechas es inválida.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async anticipos(@Query() filtros: FiltroReporteAnticiposDto) {
    return await this.reportesService.anticipos(filtros);
  }

  @Get('anticipo_vs_liquidado')
  @Auth()
  @ApiOperation({
    summary: 'Anticipo (recepción) vs. valor final liquidado (valorización)',
    description:
      'Cruza recepcion.anticipo contra valorizacion.liquidoPagableBolivianos para detectar sobre-anticipos (riesgo financiero). ' +
      'Requiere un rango acotado (fechaDesde/fechaHasta o anio+mes/semana).',
  })
  @ApiQuery(QUERY_PERIODO[0])
  @ApiQuery(QUERY_PERIODO[1])
  @ApiQuery(QUERY_PERIODO[2])
  @ApiQuery(QUERY_PERIODO[3])
  @ApiQuery(QUERY_PERIODO[4])
  @ApiQuery({ name: 'idPersona', required: false, type: Number })
  @ApiBadRequestResponse({
    description: 'No se indicó un rango de fechas, o la combinación mes/semana/fechas es inválida.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  async anticipoVsLiquidado(@Query() filtros: FiltroReporteAnticiposDto) {
    return await this.reportesService.anticipoVsLiquidado(filtros);
  }
}
