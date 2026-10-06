import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecurityModule } from 'src/security/security.module';
import { Kardex } from '../contabilidad/entities/kardex.entity';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { FlujoDineroService } from './flujo-dinero.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Kardex], 'ci'),
    ContabilidadModule,
    forwardRef(() => SecurityModule),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, FlujoDineroService],
})
export class DashboardModule {}
