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
import { ReporteDestinoGastoService } from './services/reporte-destino-gasto.service';
//import { ReciboPdfProcesadoController } from './controller/recibo-pdf-procesado.controller';
import { LibretaBancoService } from './services/libreta-banco.service';
import { KardexService } from './services/kardex.service';
import { MovimientoKardexService } from './services/movimiento-kardex.service';
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
import { DestinoGasto } from '../parametricas/entities/destino-gasto.entity';
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
    VentaLoteController,
    PagoValorizacionController,
    // ReciboPdfProcesadoController,
  ],
  providers: [
    LibretaBancoService,
    KardexService,
    MovimientoKardexService,
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
    ReporteDestinoGastoService,
    PrestamoPersonalService,
    BoletaPagoService,
    BoletaPagoPdfService,
    VentaLoteService,
    PagoValorizacionService,
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
        PersonaCi,
        RecepcionMineral,
        ValorizacionMineral,
        DestinoGasto,
        VentaLote,
        PromedioMineral,
        Cliente,
        PagoValorizacion,
        PagoValorizacionDetalle,
      ],
      'ci',
    ),
    ParametricasModule,
    forwardRef(() => SecurityModule),
  ],
  // El dashboard reutiliza la regla de actividad (deudor activo/inactivo).
  exports: [KardexActividadService],
})
export class ContabilidadModule {}
