import { forwardRef, Module } from '@nestjs/common';
import { ParametricasModule } from './parametricas/parametricas.module';
import { SecurityModule } from 'src/security/security.module';
import { ComercioInternoModule } from './comercio-interno/comercio-interno.module';

@Module({
  imports: [
    ParametricasModule,
    ComercioInternoModule,
    forwardRef(() => SecurityModule),
  ],
  providers: [],
})
export class ClusterModule {}
