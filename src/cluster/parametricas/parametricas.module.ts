import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParametricasController } from './controller/parametricas.controller';
import { CodificacionService } from './services/codificacion.service';
import { SecurityModule } from 'src/security/security.module';

import { Mineral } from './entities/mineral.entity';
import { Codificacion } from './entities/codificacion.entity';
import { ParametricasService } from './services/parametricas.service';
import { TipoDocumento } from './entities/tipo_documento.entity';
import { LugarEmisionDocumento } from './entities/lugar_emision_documento.entity';
import { PersonaTipo } from './entities/persona-tipo.entity';
import { RecepcionMineral } from '../comercio_interno/entities/recepcion_mineral/recepcion-mineral.entity';
import { EstadoRegistro } from './entities/estado-registro.entity';
import { ConfigModule } from '@nestjs/config';
import { CotizacionMineralService } from './services/cotizacion-mineral.service';
import { CotizacionMineral } from './entities/cotizacion-mineral.entity';

import { ActorProductivoMinero } from './entities/actor-productivo-minero.entity';
import { TipoActorProductivoMinero } from './entities/tipo-actor-productivo-minero.entity';
import { ActorProdMineroService } from './services/actor-productivo-minero.service';
import { Laboratorio } from './entities/laboratorio.entity';
import { LaboratorioService } from './services/laboratorio.service';

@Module({
  controllers: [ParametricasController],
  providers: [
    CodificacionService,
    ParametricasService,
    CotizacionMineralService,
    ActorProdMineroService,
    LaboratorioService,
  ],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature(
      [
        //  entidades
        Codificacion,
        Mineral,
        TipoDocumento,
        LugarEmisionDocumento,
        EstadoRegistro,
        PersonaTipo,
        CotizacionMineral,
        ActorProductivoMinero,
        TipoActorProductivoMinero,
        Laboratorio,
        
      ],
      'ci',
    ),
    forwardRef(() => SecurityModule),
  ],
  exports: [TypeOrmModule],
})
export class ParametricasModule {}
