import { forwardRef, Module } from '@nestjs/common';
import { ComercioInternoService } from './services/comercio_interno.service';
import { ComercioInternoController } from './controller/comercio_interno.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from 'src/security/security.module';

import { ParametricasModule } from '../parametricas/parametricas.module';

import { RecepcionMineral } from './entities/recepcion_mineral/recepcion-mineral.entity';
import { PersonaPersonaTipo } from './entities/persona-persona-tipo.entity';
import { PersonaTipo } from '../parametricas/entities/persona-tipo.entity';
import { PersonaCiService } from './services/persona_ci.service';
import { PersonaCi } from './entities/persona-ci.entity';
import { ConfigModule } from '@nestjs/config';
//import { RecepcionMineralDetalle } from './entities/recepcion_mineral/recepcion-mineral-detalle.entity';
import { RecepcionMineralExcelService } from './reports/recepcion-mineral-excel.service';
import { CommonModule } from 'src/common/common.module';
import { ReciboRecepcionMineralPdfService } from './services/recibo-pdf-recepcion-mineral.service';
import { ValorizacionCalculoAporte } from './entities/valorizacion/valorizacion-calculo-aporte.entity';
import { ValorizacionCalculo } from './entities/valorizacion/valorizacion-calculo.entity';
import { ValorizacionDetalleMineral } from './entities/valorizacion/valorizacion-detalle-mineral.entity';
import { ValorizacionMineral } from './entities/valorizacion/valorizacion-mineral.entity';
import { ValorizacionMineralService } from './services/valorizacion-mineral.service';
import { ValorizacionMineralPdfService } from './services/valorizacion-mineral-pdf.service';

@Module({
  providers: [
    ComercioInternoService,
    PersonaCiService,
    RecepcionMineralExcelService,
    ReciboRecepcionMineralPdfService,
    ValorizacionMineralService,
    ValorizacionMineralPdfService,
  ],
  controllers: [ComercioInternoController],
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
