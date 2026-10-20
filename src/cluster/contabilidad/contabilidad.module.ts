import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { SecurityModule } from 'src/security/security.module';
import { CommonModule } from 'src/common/common.module';
import { ParametricasModule } from '../parametricas/parametricas.module';

import { ContabilidadController } from './controller/contabilidad.controller';
import { KardexController } from './controller/kardex.controller';
import { MovimientoKardexController } from './controller/movimiento-kardex.controller';
import { CajaController } from './controller/caja.controller';
import { TraspasoController } from './controller/traspaso.controller';
import { FondoRendirController } from './controller/fondo-rendir.controller';
import { BienDacionPagoController } from './controller/bien-dacion-pago.controller';
import { ReciboController } from './controller/recibo.controller';
import { ReporteContabilidadController } from './controller/reporte-contabilidad.controller';
import { PrestamoPersonalController } from './controller/prestamo-personal.controller';
import { BoletaPagoController } from './controller/boleta-pago.controller';
import { PrestamoPersonalService } from './services/prestamo-personal.service';
import { BoletaPagoService } from './services/boleta-pago.service';
import { BoletaPagoPdfService } from './services/boleta-pago-pdf.service';
import { PrestamoPersonal } from './entities/prestamo-personal.entity';
import { MovimientoPrestamo } from './entities/movimiento-prestamo.entity';
import { BoletaPago } from './entities/boleta-pago.entity';
import { BoletaPagoDetalle } from './entities/boleta-pago-detalle.entity';
import { PersonalPlanilla } from './entities/personal-planilla.entity';
import { Vacacion } from './entities/vacacion.entity';
import { PersonalBeneficio } from './entities/personal-beneficio.entity';
import { Asistencia } from './entities/asistencia.entity';
import { AsistenciaService } from './services/asistencia.service';
import { HorarioTrabajo } from 'src/cluster/parametricas/entities/horario-trabajo.entity';
import { PlanillaCalculoService } from './services/planilla-calculo.service';
import { PersonalPlanillaService } from './services/personal-planilla.service';
import { PlanillaSueldosExcelService } from './services/planilla-sueldos-excel.service';
import { PlanillaFirmasExcelService } from './services/planilla-firmas-excel.service';
import { PersonalPlanillaController } from './controller/personal-planilla.controller';
import { ReportePlanCuentasService } from './services/reporte-plan-cuentas.service';
import { LibretaBancoService } from './services/libreta-banco.service';
import { KardexService } from './services/kardex.service';
import { MovimientoKardexService } from './services/movimiento-kardex.service';
import { PagoDeudaKardexService } from './services/pago-deuda-kardex.service';
import { MovimientoCajaService } from './services/movimiento-caja.service';
import { TraspasoService } from './services/traspaso.service';
import { FondoRendirService } from './services/fondo-rendir.service';
import { FondoRendirExcelService } from './services/fondo-rendir-excel.service';
import { BienDacionPagoService } from './services/bien-dacion-pago.service';
import { ReciboService } from './services/recibo.service';
import { ReciboPdfService } from './services/recibo-pdf.service';
import { KardexExcelService } from './services/kardex-excel.service';
import { CajaFlujoExcelService } from './services/caja-flujo-excel.service';
import { CajaFlujoConsolidadoExcelService } from './services/caja-flujo-consolidado-excel.service';
import { ContabilidadExcelService } from './services/contabilidad-excel.service';
import { ContabilidadPdfService } from './services/contabilidad-pdf.service';
import { DeudasTotalesExcelService } from './services/deudas-totales-excel.service';
import { ReciboExcelService } from './services/recibo-excel.service';
import { TraspasoExcelService } from './services/traspaso-excel.service';
import { LibretaBancoExcelService } from './services/libreta-banco-excel.service';
import { KardexActividadService } from './services/kardex-actividad.service';
import { ChequeService } from './services/cheque.service';
import { ChequeController } from './controller/cheque.controller';
import { TalonarioCheque } from './entities/talonario-cheque.entity';
import { Cheque } from './entities/cheque.entity';
import { LibretaBanco } from './entities/libreta-banco.entity';
import { PeriodoBanco } from './entities/periodo-banco.entity';
import { Kardex } from './entities/kardex.entity';
import { MovimientoKardex } from './entities/movimiento-kardex.entity';
import { PeriodoCaja } from './entities/periodo-caja.entity';
import { MovimientoCaja } from './entities/movimiento-caja.entity';
import { Recibo } from './entities/recibo.entity';
import { ReciboDetalle } from './entities/recibo-detalle.entity';
import { Traspaso } from './entities/traspaso.entity';
import { FondoRendir } from './entities/fondo-rendir.entity';
import { FondoRendirDetalle } from './entities/fondo-rendir-detalle.entity';
import { BienDacionPago } from './entities/bien-dacion-pago.entity';
import { BienDacionPagoGasto } from './entities/bien-dacion-pago-gasto.entity';
import { PersonaCi } from '../comercio-interno/entities/persona-ci.entity';
import { RecepcionMineral } from '../comercio-interno/entities/recepcion-mineral/recepcion-mineral.entity';
import { ValorizacionMineral } from '../comercio-interno/entities/valorizacion/valorizacion-mineral.entity';
import { PlanCuentas } from '../parametricas/entities/plan-cuentas.entity';
import { ReciboPdfHorizontalService } from './services/recibo-pdf-horizontal.service';
import { VentaLoteController } from './controller/venta-lote.controller';
import { VentaLoteService } from './services/venta-lote.service';
import { VentaLote } from './entities/venta-lote.entity';
import { PromedioMineral } from '../comercio-interno/entities/promedio/promedio-mineral.entity';
import { Cliente } from '../parametricas/entities/cliente.entity';
import { PagoValorizacionController } from './controller/pago-valorizacion.controller';
import { PagoValorizacionService } from './services/pago-valorizacion.service';
import { PagoValorizacion } from './entities/pago-valorizacion.entity';
import { PagoValorizacionDetalle } from './entities/pago-valorizacion-detalle.entity';
import { PagoValorizacionMedio } from './entities/pago-valorizacion-medio.entity';
import { ReciboPago } from './entities/recibo-pago.entity';
import { KardexInteresController } from './controller/kardex-interes.controller';
import { KardexInteresService } from './services/kardex-interes.service';
import { KardexInteres } from './entities/kardex-interes.entity';
import { KardexInteresCuota } from './entities/kardex-interes-cuota.entity';
import { KardexInteresEvento } from './entities/kardex-interes-evento.entity';

@Module({
  controllers: [
    ContabilidadController,
    KardexController,
    MovimientoKardexController,
    CajaController,
    TraspasoController,
    FondoRendirController,
    BienDacionPagoController,
    ReciboController,
    ReporteContabilidadController,
    PrestamoPersonalController,
    BoletaPagoController,
    PersonalPlanillaController,
    VentaLoteController,
    PagoValorizacionController,
    ChequeController,
    KardexInteresController,
    // ReciboPdfProcesadoController,
  ],
  providers: [
    LibretaBancoService,
    KardexService,
    MovimientoKardexService,
    PagoDeudaKardexService,
    MovimientoCajaService,
    TraspasoService,
    FondoRendirService,
    FondoRendirExcelService,
    BienDacionPagoService,
    ReciboService,
    ReciboPdfService,
    ReciboPdfHorizontalService,
    KardexExcelService,
    CajaFlujoExcelService,
    CajaFlujoConsolidadoExcelService,
    ContabilidadExcelService,
    ContabilidadPdfService,
    DeudasTotalesExcelService,
    ReciboExcelService,
    TraspasoExcelService,
    LibretaBancoExcelService,
    KardexActividadService,
    ReportePlanCuentasService,
    PrestamoPersonalService,
    BoletaPagoService,
    BoletaPagoPdfService,
    PlanillaCalculoService,
    AsistenciaService,
    PersonalPlanillaService,
    PlanillaSueldosExcelService,
    PlanillaFirmasExcelService,
    VentaLoteService,
    PagoValorizacionService,
    ChequeService,
    KardexInteresService,
  ],
  imports: [
    ConfigModule,
    CommonModule,
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
        Traspaso,
        FondoRendir,
        FondoRendirDetalle,
        BienDacionPago,
        BienDacionPagoGasto,
        PrestamoPersonal,
        MovimientoPrestamo,
        BoletaPago,
        BoletaPagoDetalle,
        PersonalPlanilla,
        Vacacion,
        PersonalBeneficio,
        Asistencia,
        HorarioTrabajo,
        PersonaCi,
        RecepcionMineral,
        ValorizacionMineral,
        PlanCuentas,
        VentaLote,
        PromedioMineral,
        Cliente,
        PagoValorizacion,
        PagoValorizacionDetalle,
        PagoValorizacionMedio,
        ReciboPago,
        TalonarioCheque,
        Cheque,
        KardexInteres,
        KardexInteresCuota,
        KardexInteresEvento,
      ],
      'ci',
    ),
    ParametricasModule,
    forwardRef(() => SecurityModule),
  ],
  // El dashboard reutiliza la regla de actividad (deudor activo/inactivo) y
  // la situación de las chequeras.
  exports: [KardexActividadService, ChequeService],
})
export class ContabilidadModule {}
