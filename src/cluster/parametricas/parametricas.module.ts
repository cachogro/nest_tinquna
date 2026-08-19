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
import { RecepcionMineral } from '../comercio-interno/entities/recepcion-mineral/recepcion-mineral.entity';
import { EstadoRegistro } from './entities/estado-registro.entity';
import { ConfigModule } from '@nestjs/config';
import { CotizacionMineralService } from './services/cotizacion-mineral.service';
import { CotizacionMineral } from './entities/cotizacion-mineral.entity';

import { ActorProductivoMinero } from './entities/actor-productivo-minero.entity';
import { TipoActorProductivoMinero } from './entities/tipo-actor-productivo-minero.entity';
import { ActorProdMineroService } from './services/actor-productivo-minero.service';
import { Laboratorio } from './entities/laboratorio.entity';
import { LaboratorioService } from './services/laboratorio.service';
import { EntidadAporte } from './entities/entidad-aporte.entity';
import { TipoEntidadAporte } from './entities/tipo-entidad-aporte.entity';
import { EntidadAporteService } from './services/entidad-aporte.service';
import { EstadoValorizacion } from './entities/estado-valorizacion.entity';
import { TipoCalculoValorizacion } from './entities/tipo-calculo-valorizacion.entity';
import { MineralService } from './services/mineral.service';
import { EscalaPrecioMineral } from './entities/escala-precio-mineral.entity';
import { EscalaPrecioMineralService } from './services/escala-precio-mineral.service';
import { TipoCalculoValorizacionService } from './services/tipo-calculo-valorizacion.service';

@Module({
  controllers: [ParametricasController],
  providers: [
    CodificacionService,
    ParametricasService,
    CotizacionMineralService,
    ActorProdMineroService,
    LaboratorioService,
    EntidadAporteService,
    MineralService,
    EscalaPrecioMineralService,
    TipoCalculoValorizacionService,
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
        EntidadAporte,
        TipoEntidadAporte,
        EstadoValorizacion,
        TipoCalculoValorizacion,
        EscalaPrecioMineral,
      ],
      'ci',
    ),
    forwardRef(() => SecurityModule),
  ],
  exports: [TypeOrmModule],
})
export class ParametricasModule {}
