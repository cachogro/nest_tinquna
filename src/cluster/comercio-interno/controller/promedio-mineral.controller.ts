import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { Auth, GetUser } from 'src/security/decorators';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CodificacionLote } from 'src/cluster/parametricas/entities/codificacion-lote.entity';
import { PromedioMineral } from '../entities/promedio/promedio-mineral.entity';
import {
  CreatePromedioMineralDto,
  DisponiblesPromedioPaginadoDto,
  FiltrosDisponiblesPromedioDto,
  FiltroReportePromedioDto,
  FiltrosPromedioMineralDto,
  PromediosMineralPaginadosDto,
  UpdatePromedioMineralDto,
} from '../dto/promedio/promedio-mineral.dto';
import { PromedioMineralService } from '../services/promedio-mineral.service';
import { PromedioMineralReporteExcelService } from '../reports/promedio-mineral-reporte-excel.service';

@ApiTags('Promedios de Mineral')
@Controller('comercio_interno')
@ApiBearerAuth()
export class PromedioMineralController {
  constructor(
    private readonly promedioService: PromedioMineralService,
    private readonly reporteExcelService: PromedioMineralReporteExcelService,
  ) {}

  @Get('promedio_mineral/reporte/excel')
  @Auth()
  @ApiOperation({
    summary: 'Reporte de promedios (Excel) diario, semanal o mensual',
    description:
      'Promedios activos cuya fecha cae en el período. Hoja "Resumen" con una ' +
      'fila por lote y hoja "Detalle" con un bloque por lote como PROMEDIOS.xlsx ' +
      '(TOTAL Kg, ley promedio ponderada, valorizaciones y TOTAL DE EFECTIVO INVERTIDO).',
  })
  async reporteExcel(
    @Query() filtros: FiltroReportePromedioDto,
    @Res() res: Response,
  ) {
    const { buffer, nombreArchivo } =
      await this.reporteExcelService.generar(filtros);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${nombreArchivo}`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('promedio_mineral/disponibles')
  @Auth()
  @ApiOperation({
    summary: 'Valorizaciones disponibles para armar un promedio',
    description:
      'Lista las valorizaciones PRE-VALORIZADO o VALORIZADO que aún no forman ' +
      'parte de ningún promedio, con su peso (kg) y la ley de cada mineral.',
  })
  disponibles(
    @Query() filtros: FiltrosDisponiblesPromedioDto,
  ): Promise<DisponiblesPromedioPaginadoDto> {
    return this.promedioService.disponibles(filtros);
  }

  @Get('promedio_mineral/codificaciones_lote')
  @Auth()
  @ApiOperation({
    summary: 'Codificaciones de lote (MC, TM, C, RV...)',
    description:
      'Catálogo para elegir la codificación del lote al crear un promedio. ' +
      'Incluye el último correlativo usado de cada una.',
  })
  codificacionesLote(): Promise<CodificacionLote[]> {
    return this.promedioService.listarCodificacionesLote();
  }

  @Post('promedio_mineral')
  @Auth()
  @ApiOperation({
    summary: 'Crear un promedio a partir de valorizaciones seleccionadas',
    description:
      'Genera el código PRM-XXXX, marca las valorizaciones como parte del ' +
      'promedio y calcula la ley promedio ponderada por peso de cada mineral.',
  })
  crear(
    @Body() dto: CreatePromedioMineralDto,
    @GetUser() user: Usuario,
  ): Promise<PromedioMineral> {
    return this.promedioService.crear(dto, user);
  }

  @Get('promedio_mineral')
  @Auth()
  @ApiOperation({ summary: 'Listado paginado de promedios' })
  findAll(
    @Query() filtros: FiltrosPromedioMineralDto,
  ): Promise<PromediosMineralPaginadosDto> {
    return this.promedioService.findAll(filtros);
  }

  @Get('promedio_mineral/:id')
  @Auth()
  @ApiOperation({ summary: 'Detalle de un promedio (valorizaciones y leyes)' })
  buscarPorId(@Param('id') id: string): Promise<PromedioMineral> {
    return this.promedioService.buscarPorId(id);
  }

  @Patch('promedio_mineral/:id')
  @Auth()
  @ApiOperation({
    summary: 'Actualizar un promedio',
    description:
      'Permite cambiar descripción/fecha/observaciones y, si se envía ' +
      'idsValorizacion, reemplazar su composición (se recalcula todo).',
  })
  actualizar(
    @Param('id') id: string,
    @Body() dto: UpdatePromedioMineralDto,
    @GetUser() user: Usuario,
  ): Promise<PromedioMineral> {
    return this.promedioService.actualizar(id, dto, user);
  }

  @Delete('promedio_mineral/:id')
  @Auth()
  @ApiOperation({
    summary: 'Anular un promedio',
    description:
      'Anula el promedio y libera sus valorizaciones para que puedan ' +
      'seleccionarse de nuevo.',
  })
  anular(
    @Param('id') id: string,
    @GetUser() user: Usuario,
  ): Promise<PromedioMineral> {
    return this.promedioService.anular(id, user);
  }
}
