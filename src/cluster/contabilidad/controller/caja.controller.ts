import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';

import { Auth, GetUser } from 'src/security/decorators';
import { Usuario } from 'src/security/entities/usuario.entity';
import { MovimientoCajaService } from '../services/movimiento-caja.service';
import { CajaFlujoExcelService } from '../services/caja-flujo-excel.service';
import { CajaFlujoConsolidadoExcelService } from '../services/caja-flujo-consolidado-excel.service';
import { ContabilidadPdfService } from '../services/contabilidad-pdf.service';
import { MovimientoCaja } from '../entities/movimiento-caja.entity';
import { PeriodoCaja } from '../entities/periodo-caja.entity';
import { CreateMovimientoCajaDto } from '../dto/movimiento-caja/create-movimiento-caja.dto';
import { FiltroMovimientoCajaDto } from '../dto/movimiento-caja/filtro-movimiento-caja.dto';
import { FiltroCajaExcelDto } from '../dto/movimiento-caja/filtro-caja-excel.dto';
import {
  ACCIONES_PERIODO,
  AccionPeriodo,
  AccionPeriodoCajaDto,
} from '../dto/movimiento-caja/accion-periodo-caja.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class CajaController {
  constructor(
    private readonly movimientoCajaService: MovimientoCajaService,
    private readonly cajaFlujoExcelService: CajaFlujoExcelService,
    private readonly cajaFlujoConsolidadoExcelService: CajaFlujoConsolidadoExcelService,
    private readonly contabilidadPdfService: ContabilidadPdfService,
  ) {}

  //--------------------------- Caja de flujo --------------------------------

  @Post('movimiento-caja')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un movimiento de la caja de flujo',
    description:
      'Sin `id` registra un movimiento; con `id` lo actualiza. El movimiento cae en el período mensual de su fecha y moneda (se crea si no existe). No se puede tocar un movimiento de un período cerrado: para corregir, se registra una regularización en el período abierto. El `saldo` corriente y el `folio` los asigna el servicio, por separado para cada moneda; INGRESO = entrada de efectivo, EGRESO = salida.',
  })
  @ApiBody({
    type: CreateMovimientoCajaDto,
    examples: {
      egreso: {
        summary: 'Egreso (EGRESO)',
        value: {
          idCaja: 1,
          moneda: 'BS',
          fecha: '2025-07-01',
          facturaRecibo: 'REC:R-0084',
          entregaFondosA: 'IVAR CALLAHUANCA',
          concepto: 'COMPRA DE DIESEL',
          idDestinoGasto: 21,
          tipo: 'EGRESO',
          monto: 1260,
        },
      },
      ingreso: {
        summary: 'Ingreso (INGRESO)',
        value: {
          idCaja: 1,
          moneda: 'BS',
          fecha: '2025-07-01',
          facturaRecibo: 'REC:R-0009',
          entregaFondosA: 'RAFAEL DOUCHEN',
          concepto: 'VENTA DE DIESEL DE 400 LTRS. A 7.-BS DEL GALPON DE ARRIBA',
          idDestinoGasto: 2,
          tipo: 'INGRESO',
          monto: 2800,
        },
      },
      beneficiarioRegistrado: {
        summary:
          'Beneficiario ya registrado (persona_ci), pagado por transferencia',
        value: {
          idCaja: 1,
          moneda: 'BS',
          fecha: '2025-07-01',
          facturaRecibo: 'REC:C-0535',
          nroComprobante: '4613159797',
          idPersona: '15',
          concepto: 'ANTICIPO A CTA SACO MINERAL',
          idDestinoGasto: 13,
          tipo: 'EGRESO',
          monto: 3500,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Movimiento registrado o actualizado correctamente.',
    type: MovimientoCaja,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, caja inactiva, o el período de la fecha/moneda está cerrado.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró la caja, la persona, la forma de pago, el destino del gasto, o el movimiento a actualizar.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async guardarMovimiento(
    @Body() body: CreateMovimientoCajaDto,
    @GetUser() user: Usuario,
  ): Promise<MovimientoCaja> {
    return await this.movimientoCajaService.guardar(body, user);
  }

  @Patch('movimiento-caja/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Activar o desactivar un movimiento de caja',
    description:
      'Baja lógica de un movimiento. Solo si su período está abierto. Recalcula el saldo de la caja para esa moneda.',
  })
  @ApiParam({ name: 'id', description: 'Id del movimiento.', example: '15' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { activo: { type: 'boolean', example: false } },
    },
  })
  @ApiOkResponse({
    description: 'Estado del movimiento actualizado.',
    type: MovimientoCaja,
  })
  @ApiBadRequestResponse({
    description: 'El movimiento pertenece a un período cerrado.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el movimiento.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async cambiarEstadoMovimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<MovimientoCaja> {
    return await this.movimientoCajaService.cambiarEstado(id, activo, user);
  }

  @Get('movimiento-caja')
  @Auth()
  @ApiOperation({
    summary: 'Listar la caja de flujo de una caja',
    description:
      'Devuelve los movimientos de una caja en una moneda (filtrables por gestión y mes), los períodos correspondientes y los datos de la caja (incluido su saldo inicial en esa moneda). Sin paginación.',
  })
  @ApiQuery({ name: 'idCaja', required: true, type: Number, example: 1 })
  @ApiQuery({
    name: 'moneda',
    required: true,
    enum: ['BS', 'USD'],
    example: 'BS',
  })
  @ApiQuery({ name: 'gestion', required: false, type: Number, example: 2025 })
  @ApiQuery({ name: 'mes', required: false, type: Number, example: 7 })
  @ApiOkResponse({ description: 'Caja de flujo obtenida correctamente.' })
  @ApiBadRequestResponse({ description: 'Caja inactiva o filtros inválidos.' })
  @ApiNotFoundResponse({ description: 'No se encontró la caja.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async listarCaja(@Query() filtro: FiltroMovimientoCajaDto) {
    return await this.movimientoCajaService.listar(filtro);
  }

  @Get('movimiento-caja/excel')
  @Auth()
  @ApiOperation({
    summary: 'Exportar la caja de flujo a Excel o PDF (una caja o el libro completo)',
    description:
      'Genera el .xlsx de un único período mensual del libro, por eso gestión y mes son obligatorios. Sin `completo` exporta una caja en una moneda con el formato del libro físico (fecha, concepto, entrega de fondos a, factura y/o recibo, N° cpte., destino del gasto, ingreso, egreso, saldo); ahí `idCaja` y `moneda` son obligatorios. Con `completo=true` exporta el libro completo como la hoja "CAJA DE FLUJO" del modelo físico: en una sola lista ordenada por fecha y hora de registro, la caja en Bs., la caja en $us. y cada cuenta bancaria (aperturadas o con movimientos en el mes), cada una con su grupo INGRESO / EGRESO / SALDO, sumas totales, resumen por cuenta y firmas; `moneda` se ignora e `idCaja` es opcional (por defecto la caja principal). Con `formato=PDF` devuelve el mismo reporte en PDF: hoja carta apaisada (por la cantidad de columnas), márgenes estrechos, encabezado de columnas repetido y páginas numeradas.',
  })
  @ApiOkResponse({ description: 'Archivo .xlsx o .pdf generado correctamente.' })
  @ApiBadRequestResponse({ description: 'Caja inactiva o filtros inválidos.' })
  @ApiNotFoundResponse({ description: 'No se encontró la caja.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async exportarExcel(
    @Query() filtro: FiltroCajaExcelDto,
    @GetUser() user: Usuario,
    @Res() res: Response,
  ): Promise<void> {
    const periodo = `${filtro.gestion}-${String(filtro.mes).padStart(2, '0')}`;
    let buffer: Buffer;
    let nombre: string;

    if (filtro.completo) {
      buffer = await this.cajaFlujoConsolidadoExcelService.generar(
        { idCaja: filtro.idCaja, gestion: filtro.gestion, mes: filtro.mes },
        user,
      );
      nombre = `caja-flujo-completa-${periodo}`;
    } else {
      // idCaja y moneda ya vienen validados por el DTO cuando no es completo.
      const idCaja = filtro.idCaja;
      const moneda = filtro.moneda;
      buffer = await this.cajaFlujoExcelService.generar(
        { idCaja, moneda, gestion: filtro.gestion, mes: filtro.mes },
        user,
      );
      nombre = `caja-flujo-${idCaja}-${moneda}-${periodo}`;
    }

    // La caja de flujo va apaisada: tiene tres columnas por cada cuenta.
    await this.contabilidadPdfService.enviar(res, buffer, nombre, filtro.formato, {
      horizontal: true,
    });
  }

//--------------------------- Períodos y cierres --------------------------

  @Get('movimiento-caja/periodo')
  @Auth()
  @ApiOperation({
    summary: 'Listar los períodos de una caja en una moneda',
    description:
      'Devuelve todos los períodos (mensuales y de gestión) de una caja en una moneda, con sus totales, saldo inicial y saldo final.',
  })
  @ApiQuery({ name: 'idCaja', required: true, type: Number, example: 1 })
  @ApiQuery({
    name: 'moneda',
    required: true,
    enum: ['BS', 'USD'],
    example: 'BS',
  })
  @ApiOkResponse({
    description: 'Períodos obtenidos correctamente.',
    type: PeriodoCaja,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'No se encontró la caja.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async listarPeriodos(
    @Query('idCaja', ParseIntPipe) idCaja: number,
    @Query('moneda') moneda: 'BS' | 'USD',
  ): Promise<PeriodoCaja[]> {
    return await this.movimientoCajaService.listarPeriodos(idCaja, moneda);
  }

  @Post('movimiento-caja/periodo/:accion')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar o reabrir un período mensual o la gestión de una caja',
    description:
      '`accion` = cerrar | reabrir; `alcance` (en el cuerpo) = MES | GESTION, siempre en una moneda. Cerrar MES sella el mes: sus movimientos quedan inmutables, se fija `saldo_final = saldo_inicial + ingresos - egresos` y ese saldo pasa como saldo inicial del mes siguiente; requiere que el mes anterior ya esté cerrado (contigüidad). Reabrir MES lo vuelve a ABIERTO; requiere que ni el mes siguiente ni la gestión estén cerrados. Cerrar GESTION solo se puede con sus 12 meses cerrados: registra el resumen anual (saldo inicial de enero, totales del año, saldo final de diciembre) y sella el año. Reabrir GESTION la vuelve a ABIERTO; después se pueden reabrir sus meses en orden inverso.',
  })
  @ApiParam({ name: 'accion', enum: ACCIONES_PERIODO, example: 'cerrar' })
  @ApiBody({
    type: AccionPeriodoCajaDto,
    examples: {
      mes: {
        summary: 'Un mes',
        value: { idCaja: 1, moneda: 'BS', gestion: 2026, mes: 9, alcance: 'MES' },
      },
      gestion: {
        summary: 'La gestión (año)',
        value: { idCaja: 1, moneda: 'BS', gestion: 2026, alcance: 'GESTION' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Período o gestión actualizado correctamente.',
    type: PeriodoCaja,
  })
  @ApiBadRequestResponse({
    description:
      'Acción o alcance inválidos; el período ya está en ese estado; el mes anterior sigue abierto o el siguiente cerrado; la gestión está cerrada o le faltan meses por cerrar.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró la caja, el período, el cierre de gestión, o no hay movimientos en ese mes.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async accionPeriodo(
    @Param('accion', new ParseEnumPipe(AccionPeriodo)) accion: AccionPeriodo,
    @Body() body: AccionPeriodoCajaDto,
    @GetUser() user: Usuario,
  ): Promise<PeriodoCaja> {
    const { alcance, mes, ...gestion } = body;
    if (alcance === 'GESTION') {
      return accion === AccionPeriodo.CERRAR
        ? await this.movimientoCajaService.cerrarGestion(gestion, user)
        : await this.movimientoCajaService.reabrirGestion(gestion, user);
    }
    // Con alcance MES el DTO ya exigió el mes.
    const periodo = { ...gestion, mes };
    return accion === AccionPeriodo.CERRAR
      ? await this.movimientoCajaService.cerrarPeriodo(periodo, user)
      : await this.movimientoCajaService.reabrirPeriodo(periodo, user);
  }
}
