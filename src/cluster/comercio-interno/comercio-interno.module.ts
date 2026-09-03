import { forwardRef, Module } from '@nestjs/common';
import { ComercioInternoService } from './services/comercio-interno.service';
import { ComercioInternoController } from './controller/comercio-interno.controller';
import { ReportesRecepcionMineralController } from './controller/reportes-recepcion-mineral.controller';
import { ValorizacionEntregadoController } from './controller/valorizacion-entregado.controller';
import { ReportesValorizacionMineralController } from './controller/reportes-valorizacion-mineral.controller';
import { RecepcionMineralReportesService } from './reports/recepcion-mineral-reportes.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from 'src/security/security.module';

import { ParametricasModule } from '../parametricas/parametricas.module';

import { RecepcionMineral } from './entities/recepcion-mineral/recepcion-mineral.entity';
import { PersonaPersonaTipo } from './entities/persona-persona-tipo.entity';
import { PersonaTipo } from '../parametricas/entities/persona-tipo.entity';
import { PersonaCiService } from './services/persona-ci.service';
import { PersonaCi } from './entities/persona-ci.entity';
import { ConfigModule } from '@nestjs/config';
//import { RecepcionMineralDetalle } from './entities/recepcion-mineral/recepcion-mineral-detalle.entity';
import { RecepcionMineralExcelService } from './reports/recepcion-mineral-excel.service';
import { RecepcionMineralReportePdfService } from './reports/recepcion-mineral-pdf.service';
import { CommonModule } from 'src/common/common.module';
import { ReciboRecepcionMineralPdfService } from './services/recibo-pdf-recepcion-mineral.service';
import { ValorizacionCalculoAporte } from './entities/valorizacion/valorizacion-calculo-aporte.entity';
import { ValorizacionCalculo } from './entities/valorizacion/valorizacion-calculo.entity';
import { ValorizacionDetalleMineral } from './entities/valorizacion/valorizacion-detalle-mineral.entity';
import { ValorizacionMineral } from './entities/valorizacion/valorizacion-mineral.entity';
import { ValorizacionMineralService } from './services/valorizacion-mineral.service';
import { ValorizacionMineralPdfService } from './services/valorizacion-mineral-pdf.service';
import { ValorizacionEntregadoService } from './services/valorizacion-entregado.service';
import { ValorizacionMineralReportesService } from './reports/valorizacion-mineral-reportes.service';
import { ValorizacionMineralReporteExcelService } from './reports/valorizacion-mineral-reporte-excel.service';

@Module({
  providers: [
    ComercioInternoService,
    PersonaCiService,
    RecepcionMineralExcelService,
    RecepcionMineralReportePdfService,
    RecepcionMineralReportesService,
    ReciboRecepcionMineralPdfService,
    ValorizacionMineralService,
    ValorizacionMineralPdfService,
    ValorizacionEntregadoService,
    ValorizacionMineralReportesService,
    ValorizacionMineralReporteExcelService,
  ],
  controllers: [
    ComercioInternoController,
    ReportesRecepcionMineralController,
    ValorizacionEntregadoController,
    ReportesValorizacionMineralController,
  ],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature(
      [
        // entitis
        PersonaCi,
        RecepcionMineral,
        PersonaPersonaTipo,
       // RecepcionMineralDetalle,
        ValorizacionCalculoAporte,
        ValorizacionCalculo,
        ValorizacionDetalleMineral,
        ValorizacionMineral,
      ],
      'ci',
    ),
    forwardRef(() => SecurityModule),
    ParametricasModule,
    CommonModule,
  ],
})
export class ComercioInternoModule {}
