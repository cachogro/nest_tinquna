import { forwardRef, Module } from '@nestjs/common';
import { ParametricasModule } from './parametricas/parametricas.module';
import { SecurityModule } from 'src/security/security.module';
import { ComercioInternoModule } from './comercio-interno/comercio-interno.module';
import { ContabilidadModule } from './contabilidad/contabilidad.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ParametricasModule,
    ComercioInternoModule,
    ContabilidadModule,
    DashboardModule,
    forwardRef(() => SecurityModule),
  ],
  providers: [],
})
export class ClusterModule {}
