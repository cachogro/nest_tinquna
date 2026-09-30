import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
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

import { Auth, GetUser } from 'src/security/decorators';
import { Usuario } from 'src/security/entities/usuario.entity';
import { LibretaBancoService } from '../services/libreta-banco.service';
import { LibretaBancoExcelService } from '../services/libreta-banco-excel.service';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { PeriodoBanco } from '../entities/periodo-banco.entity';
import { CreateLibretaBancoDto } from '../dto/libreta-banco/create-libreta-banco.dto';
import { FiltroLibretaBancoDto } from '../dto/libreta-banco/filtro-libreta-banco.dto';
import { CerrarPeriodoBancoDto } from '../dto/libreta-banco/cerrar-periodo-banco.dto';
import { CerrarGestionBancoDto } from '../dto/libreta-banco/cerrar-gestion-banco.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class ContabilidadController {
  constructor(
    private readonly libretaBancoService: LibretaBancoService,
    private readonly libretaBancoExcelService: LibretaBancoExcelService,
  ) {}

  //--------------------------- Libreta de bancos ----------------------------

  @Post('libreta-banco')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un movimiento de la libreta de bancos',
    description:
      'Sin `id` registra un movimiento; con `id` lo actualiza. El movimiento cae en el período mensual de su fecha (se crea si no existe). No se puede tocar un movimiento de un período cerrado: para corregir, se registra una regularización en el período abierto. El `saldo` corriente y el `folio` los asigna el servicio; DEBE = salida, HABER = entrada.',
  })
  @ApiBody({
    type: CreateLibretaBancoDto,
    examples: {
      egreso: {
        summary: 'Egreso (DEBE)',
        value: {
          idCuentaBancaria: 1,
          fecha: '2025-05-14',
          nroTransaccion: '4478708896',
          tipoTransaccion: 'TRANSFERENCIA',
          nombresApellidos: 'RENE MISQUE - ANDIA ROMAN PERALTA',
          concepto: 'ANTICIPO A CTA SACO MINERAL',
          tipo: 'DEBE',
          monto: 2000,
        },
      },
      ingreso: {
        summary: 'Ingreso / depósito (HABER)',
        value: {
          idCuentaBancaria: 1,
          fecha: '2025-06-23',
          nroTransaccion: '32632109',
          tipoTransaccion: 'DEPOSITO',
          nombresApellidos: 'ANDREA JHYMALIA CALLAHUANCA CHACON',
          concepto: 'DEPOSITO DE EFECTIVO',
          tipo: 'HABER',
          monto: 60000,
        },
      },
      beneficiarioRegistrado: {
        summary: 'Beneficiario ya registrado (persona_ci)',
        value: {
          idCuentaBancaria: 1,
          fecha: '2025-07-14',
          nroTransaccion: '4613649398',
          tipoTransaccion: 'QR',
          idPersona: '15',
          concepto: 'ANTICIPO A CTA SUELDO',
          tipo: 'DEBE',
          monto: 1800,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Movimiento registrado o actualizado correctamente.',
    type: LibretaBanco,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, cuenta inactiva, o el período de la fecha está cerrado.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró la cuenta bancaria o el movimiento a actualizar.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async guardarMovimiento(
    @Body() body: CreateLibretaBancoDto,
    @GetUser() user: Usuario,
  ): Promise<LibretaBanco> {
    return await this.libretaBancoService.guardar(body, user);
  }

  @Patch('libreta-banco/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Activar o desactivar un movimiento de la libreta',
    description:
      'Baja lógica de un movimiento. Solo si su período está abierto. Recalcula el saldo de la cuenta.',
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
    type: LibretaBanco,
  })
  @ApiBadRequestResponse({
    description: 'El movimiento pertenece a un período cerrado.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el movimiento.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cambiarEstadoMovimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<LibretaBanco> {
    return await this.libretaBancoService.cambiarEstado(id, activo, user);
  }

  @Get('libreta-banco')
  @Auth()
  @ApiOperation({
    summary: 'Listar la libreta de bancos de una cuenta',
    description:
      'Devuelve los movimientos de una cuenta (filtrables por gestión y mes), los períodos correspondientes y los datos de la cuenta (incluido su saldo inicial). Sin paginación.',
  })
  @ApiQuery({ name: 'idCuentaBancaria', required: true, type: Number, example: 1 })
  @ApiQuery({ name: 'gestion', required: false, type: Number, example: 2025 })
  @ApiQuery({ name: 'mes', required: false, type: Number, example: 5 })
  @ApiOkResponse({ description: 'Libreta obtenida correctamente.' })
  @ApiBadRequestResponse({ description: 'Cuenta inactiva o filtros inválidos.' })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta bancaria.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listarLibreta(@Query() filtro: FiltroLibretaBancoDto) {
    return await this.libretaBancoService.listar(filtro);
  }

  @Get('libreta-banco/excel')
  @Auth()
  @ApiOperation({
    summary: 'Exportar la libreta de bancos de una cuenta a Excel',
    description:
      'Genera el .xlsx con el formato del libro físico "LIBRETA DE BANCOS": FECHA, N° DE TRANSACCIÓN, NOMBRES Y APELLIDOS, CONCEPTO y SALDOS (DEBE / HABER / SALDOS). La primera fila es el saldo inicial de la cuenta (o el saldo anterior al rango si se filtra por gestión/mes) y el pie "TOTAL DE SALDO" = suma HABER (incluido el saldo inicial) - suma DEBE. Sin gestión ni mes imprime toda la historia de la cuenta; `mes` requiere `gestion`. Solo movimientos vigentes (activo = true).',
  })
  @ApiQuery({ name: 'idCuentaBancaria', required: true, type: Number, example: 1 })
  @ApiQuery({ name: 'gestion', required: false, type: Number, example: 2026 })
  @ApiQuery({ name: 'mes', required: false, type: Number, example: 8 })
  @ApiOkResponse({ description: 'Archivo .xlsx generado correctamente.' })
  @ApiBadRequestResponse({
    description: 'Cuenta inactiva, filtros inválidos o `mes` sin `gestion`.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta bancaria.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async exportarLibretaExcel(
    @Query() filtro: FiltroLibretaBancoDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.libretaBancoExcelService.generar(filtro);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${this.libretaBancoExcelService.nombreArchivo(filtro)}`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('libreta-banco/detalle/:id')
  @Auth()
  @ApiOperation({
    summary: 'Detalle de un movimiento de la libreta',
    description:
      'Movimiento completo para el visor de la bandeja: cuenta, período, beneficiario, destino del gasto, quién y cuándo lo registró, y el origen (recibo, traspaso o línea de kardex) si lo tiene.',
  })
  @ApiParam({ name: 'id', description: 'Id del movimiento.', example: '15' })
  @ApiOkResponse({ description: 'Movimiento obtenido.', type: LibretaBanco })
  @ApiNotFoundResponse({ description: 'No se encontró el movimiento.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async detalleMovimiento(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LibretaBanco> {
    return await this.libretaBancoService.buscarPorId(String(id));
  }

  //--------------------------- Períodos y cierres --------------------------

  @Get('libreta-banco/periodo')
  @Auth()
  @ApiOperation({
    summary: 'Listar los períodos de la libreta de una cuenta',
    description:
      'Devuelve todos los períodos (mensuales y de gestión) de una cuenta, con sus totales, saldo inicial y saldo final.',
  })
  @ApiQuery({ name: 'idCuentaBancaria', required: true, type: Number, example: 1 })
  @ApiOkResponse({
    description: 'Períodos obtenidos correctamente.',
    type: PeriodoBanco,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta bancaria.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listarPeriodos(
    @Query('idCuentaBancaria', ParseIntPipe) idCuentaBancaria: number,
  ): Promise<PeriodoBanco[]> {
    return await this.libretaBancoService.listarPeriodos(idCuentaBancaria);
  }

  @Post('libreta-banco/periodo/cerrar')
  @Auth()
  @ApiOperation({
    summary: 'Cerrar un período mensual',
    description:
      'Sella el mes: sus movimientos quedan inmutables, se fija `saldo_final = saldo_inicial + haberes - debes`, y ese saldo pasa como saldo inicial del mes siguiente. Requiere que el mes anterior ya esté cerrado (contigüidad).',
  })
  @ApiBody({ type: CerrarPeriodoBancoDto })
  @ApiOkResponse({
    description: 'Período cerrado correctamente.',
    type: PeriodoBanco,
  })
  @ApiBadRequestResponse({
    description:
      'El período ya está cerrado, o el mes anterior sigue abierto, o la gestión está cerrada.',
  })
  @ApiNotFoundResponse({
    description: 'No hay movimientos registrados en ese mes para la cuenta.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cerrarPeriodo(
    @Body() body: CerrarPeriodoBancoDto,
    @GetUser() user: Usuario,
  ): Promise<PeriodoBanco> {
    return await this.libretaBancoService.cerrarPeriodo(body, user);
  }

  @Post('libreta-banco/periodo/reabrir')
  @Auth()
  @ApiOperation({
    summary: 'Reabrir un período mensual',
    description:
      'Vuelve el mes a ABIERTO. Requiere que el mes siguiente NO esté cerrado y que la gestión NO esté cerrada.',
  })
  @ApiBody({ type: CerrarPeriodoBancoDto })
  @ApiOkResponse({
    description: 'Período reabierto correctamente.',
    type: PeriodoBanco,
  })
  @ApiBadRequestResponse({
    description:
      'El período no está cerrado, o el mes siguiente / la gestión están cerrados.',
  })
  @ApiNotFoundResponse({ description: 'No existe el período indicado.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async reabrirPeriodo(
    @Body() body: CerrarPeriodoBancoDto,
    @GetUser() user: Usuario,
  ): Promise<PeriodoBanco> {
    return await this.libretaBancoService.reabrirPeriodo(body, user);
  }

  @Post('libreta-banco/periodo/cerrar-gestion')
  @Auth()
  @ApiOperation({
    summary: 'Cerrar la gestión (año) de una cuenta',
    description:
      'Solo se puede cerrar la gestión cuando sus 12 meses están cerrados. Registra el resumen anual (saldo inicial de enero, totales del año, saldo final de diciembre) y sella el año.',
  })
  @ApiBody({ type: CerrarGestionBancoDto })
  @ApiOkResponse({
    description: 'Gestión cerrada correctamente.',
    type: PeriodoBanco,
  })
  @ApiBadRequestResponse({
    description: 'Faltan meses por cerrar en la gestión.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró la cuenta bancaria.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cerrarGestion(
    @Body() body: CerrarGestionBancoDto,
    @GetUser() user: Usuario,
  ): Promise<PeriodoBanco> {
    return await this.libretaBancoService.cerrarGestion(body, user);
  }

  @Post('libreta-banco/periodo/reabrir-gestion')
  @Auth()
  @ApiOperation({
    summary: 'Reabrir la gestión (año) de una cuenta',
    description:
      'Vuelve la gestión a ABIERTO. Después se pueden reabrir los meses de ese año (en orden inverso).',
  })
  @ApiBody({ type: CerrarGestionBancoDto })
  @ApiOkResponse({
    description: 'Gestión reabierta correctamente.',
    type: PeriodoBanco,
  })
  @ApiBadRequestResponse({ description: 'La gestión no está cerrada.' })
  @ApiNotFoundResponse({
    description: 'No existe un cierre de gestión para esa cuenta.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async reabrirGestion(
    @Body() body: CerrarGestionBancoDto,
    @GetUser() user: Usuario,
  ): Promise<PeriodoBanco> {
    return await this.libretaBancoService.reabrirGestion(body, user);
  }
}
