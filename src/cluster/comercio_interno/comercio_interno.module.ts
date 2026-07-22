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
import { RecepcionMineralDetalle } from './entities/recepcion_mineral/recepcion-mineral-detalle.entity';

@Module({
  providers: [ComercioInternoService, PersonaCiService],
  controllers: [ComercioInternoController],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature(
      [
        // entitis
        PersonaCi, 
        RecepcionMineral, 
        PersonaPersonaTipo, 
        RecepcionMineralDetalle,
        
      ],
      'ci',
    ),
    forwardRef(() => SecurityModule),
    ParametricasModule,
  ],
})
export class ComercioInternoModule {}
