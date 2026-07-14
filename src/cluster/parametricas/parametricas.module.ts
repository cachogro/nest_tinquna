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
import { RecepcionMineral } from '../comercio_interno/entities/recepcion-mineral.entity';
import { EstadoRegistro } from './entities/estado-registro.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  controllers: [ParametricasController],
  providers: [CodificacionService, ParametricasService],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature(
      [
        Codificacion, 
        Mineral, 
        TipoDocumento, 
        LugarEmisionDocumento,
        EstadoRegistro,
        PersonaTipo,
      ],
      'ci',
    ),
    forwardRef(() => SecurityModule),
  ],
    exports: [
    TypeOrmModule,
      
  ],
})
export class ParametricasModule {}
