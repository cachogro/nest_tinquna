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
import { EstadoRegistro } from './entities/estado-registro.entity';
import { ConfigModule } from '@nestjs/config';
import { CotizacionMineralService } from './services/cotizacion-mineral.service';
import { CotizacionMineral } from './entities/cotizacion-mineral.entity';

import { ActorProductivoMinero } from './entities/actor-productivo-minero.entity';
import { TipoActorProductivoMinero } from './entities/tipo-actor-productivo-minero.entity';
import { Municipio } from './entities/municipio.entity';
import { MunicipioService } from './services/municipio.service';
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
import { PersonaTipoService } from './services/persona-tipo.service';
import { EntidadFinanciera } from './entities/entidad-financiera.entity';
import { CuentaBancaria } from './entities/cuenta-bancaria.entity';
import { EntidadFinancieraService } from './services/entidad-financiera.service';
import { FormaPago } from './entities/forma-pago.entity';
import { KardexSubcuenta } from './entities/kardex-subcuenta.entity';
import { PlanCuentas } from './entities/plan-cuentas.entity';
import { CodificacionLote } from './entities/codificacion-lote.entity';
import { PlanCuentasService } from './services/plan-cuentas.service';
import { CodificacionLoteService } from './services/codificacion-lote.service';
import { LugarAcopio } from './entities/lugar-acopio.entity';
import { LugarAcopioService } from './services/lugar-acopio.service';
import { FormaPagoService } from './services/forma-pago.service';
import { Caja } from './entities/caja.entity';
import { CajaService } from './services/caja.service';
import { Cliente } from './entities/cliente.entity';
import { ClienteService } from './services/cliente.service';
import { ParametroPlanilla } from './entities/parametro-planilla.entity';
import { ConceptoPlanilla } from './entities/concepto-planilla.entity';
import { BeneficioPlanilla } from './entities/beneficio-planilla.entity';
import { EscalaPlanilla } from './entities/escala-planilla.entity';
import { TipoContrato } from './entities/tipo-contrato.entity';
import { HorarioTrabajo, HorarioTrabajoDia } from './entities/horario-trabajo.entity';
import { DatosEmpleador } from './entities/datos-empleador.entity';
import { PlanillaConfigService } from './services/planilla-config.service';
import { PlanillaConfigController } from './controller/planilla-config.controller';

@Module({
  controllers: [ParametricasController, PlanillaConfigController],
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
    MunicipioService,
    PersonaTipoService,
    EntidadFinancieraService,
    CajaService,
    ClienteService,
    PlanCuentasService,
    CodificacionLoteService,
    LugarAcopioService,
    FormaPagoService,
    PlanillaConfigService,
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
        Municipio,
        Laboratorio,
        EntidadAporte,
        TipoEntidadAporte,
        EstadoValorizacion,
        TipoCalculoValorizacion,
        EscalaPrecioMineral,
        EntidadFinanciera,
        CuentaBancaria,
        FormaPago,
        KardexSubcuenta,
        PlanCuentas,
        CodificacionLote,
        LugarAcopio,
        Caja,
        Cliente,
        ParametroPlanilla,
        ConceptoPlanilla,
        BeneficioPlanilla,
        EscalaPlanilla,
        TipoContrato,
        HorarioTrabajo,
        HorarioTrabajoDia,
        DatosEmpleador,
      ],
      'ci',
    ),
    forwardRef(() => SecurityModule),
  ],
  exports: [TypeOrmModule, PlanillaConfigService],
})
export class ParametricasModule {}
