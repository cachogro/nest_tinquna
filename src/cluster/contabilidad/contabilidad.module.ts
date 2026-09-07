import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { SecurityModule } from 'src/security/security.module';
import { ParametricasModule } from '../parametricas/parametricas.module';

import { ContabilidadController } from './controller/contabilidad.controller';
import { KardexController } from './controller/kardex.controller';
import { MovimientoKardexController } from './controller/movimiento-kardex.controller';
import { CajaController } from './controller/caja.controller';
import { ReciboController } from './controller/recibo.controller';
import { LibretaBancoService } from './services/libreta-banco.service';
import { KardexService } from './services/kardex.service';
import { MovimientoKardexService } from './services/movimiento-kardex.service';
import { MovimientoCajaService } from './services/movimiento-caja.service';
import { ReciboService } from './services/recibo.service';
import { ReciboPdfService } from './services/recibo-pdf.service';
import { LibretaBanco } from './entities/libreta-banco.entity';
import { PeriodoBanco } from './entities/periodo-banco.entity';
import { Kardex } from './entities/kardex.entity';
import { MovimientoKardex } from './entities/movimiento-kardex.entity';
import { PeriodoCaja } from './entities/periodo-caja.entity';
import { MovimientoCaja } from './entities/movimiento-caja.entity';
import { Recibo } from './entities/recibo.entity';
import { ReciboDetalle } from './entities/recibo-detalle.entity';
import { PersonaCi } from '../comercio-interno/entities/persona-ci.entity';
import { ValorizacionMineral } from '../comercio-interno/entities/valorizacion/valorizacion-mineral.entity';

@Module({
  controllers: [
    ContabilidadController,
    KardexController,
    MovimientoKardexController,
    CajaController,
    ReciboController,
  ],
  providers: [
    LibretaBancoService,
    KardexService,
    MovimientoKardexService,
    MovimientoCajaService,
    ReciboService,
    ReciboPdfService,
  ],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature(
      [
        LibretaBanco,
        PeriodoBanco,
        Kardex,
        MovimientoKardex,
        PeriodoCaja,
        MovimientoCaja,
        Recibo,
        ReciboDetalle,
        PersonaCi,
        ValorizacionMineral,
      ],
      'ci',
    ),
    ParametricasModule,
    forwardRef(() => SecurityModule),
  ],
})
export class ContabilidadModule {}
