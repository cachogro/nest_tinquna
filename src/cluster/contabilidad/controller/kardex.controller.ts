import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
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
import { Response } from 'express';

import { Auth, GetUser } from 'src/security/decorators';
import { Usuario } from 'src/security/entities/usuario.entity';
import { ValidRoles } from 'src/security/enums/valid-roles';
import { KardexService } from '../services/kardex.service';
import { KardexExcelService } from '../services/kardex-excel.service';
import { DeudasTotalesExcelService } from '../services/deudas-totales-excel.service';
import { Kardex } from '../entities/kardex.entity';
import { AbrirKardexDto } from '../dto/kardex/abrir-kardex.dto';
import { FiltrosKardexDto } from '../dto/kardex/filtros-kardex.dto';
import { FiltroDeudasTotalesDto } from '../dto/kardex/filtro-deudas-totales.dto';
import { KardexPaginadoDto } from '../dto/kardex/kardex-paginado.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class KardexController {
  constructor(
    private readonly kardexService: KardexService,
    private readonly kardexExcelService: KardexExcelService,
    private readonly deudasTotalesExcelService: DeudasTotalesExcelService,
  ) {}

  @Post('kardex')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Abrir el primer kardex de un actor o de una persona',
    description:
      'Registra el kardex N° 1 de un actor productivo minero (cubre a todas sus personas) o de una persona individual. Los kardex siguientes (N° 2, N° 3...) se generan solos al cerrar el actual. `saldoInicial` es la deuda que se arrastra del Excel; por defecto 0.',
  })
  @ApiBody({
    type: AbrirKardexDto,
    examples: {
      actor: {
        summary: 'Kardex de un actor (cooperativa / lote)',
        value: {
          tipo: 'ACTOR',
          idActorProductivoMinero: '5',
          descripcion: 'ANTICIPOS A CTA SACOS DE MINERAL',
          gestion: 2026,
          saldoInicial: 3500,
        },
      },
      personal: {
        summary: 'Kardex de personal interno de la empresa',
        value: {
          tipo: 'PERSONAL',
          idPersona: '15',
          descripcion: 'ANTICIPOS A CTA PERSONAL',
          saldoInicial: 0,
        },
      },
      asociado: {
        summary: 'Kardex de una persona asociada a otro actor (o suelta)',
        value: {
          tipo: 'ASOCIADO',
          idPersona: '22',
          descripcion: 'ANTICIPOS A CTA PERSONAL',
          saldoInicial: 0,
        },
      },
      cliente: {
        summary: 'Kardex de un cliente (venta a crédito)',
        value: {
          tipo: 'CLIENTE',
          idCliente: '3',
          descripcion: 'CUENTA POR COBRAR VENTAS',
          gestion: 2026,
          saldoInicial: 0,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Kardex abierto correctamente.',
    type: Kardex,
  })
  @ApiConflictResponse({
    description:
      'El actor o la persona ya tiene un kardex (el siguiente se genera al cerrar).',
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, o destinatario inactivo.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró el actor o la persona.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async abrir(
    @Body() body: AbrirKardexDto,
    @GetUser() user: Usuario,
  ): Promise<Kardex> {
    return await this.kardexService.abrir(body, user);
  }

  @Patch('kardex/:id/cerrar')
  @Auth()
  @ApiOperation({
    summary: 'Cerrar un kardex',
    description:
      'Sella el kardex (`saldo_cierre = saldo_actual`) y abre automáticamente el siguiente (N° + 1) arrastrando ese saldo como `saldo_inicial`. Devuelve el kardex cerrado y el nuevo.',
  })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiOkResponse({ description: 'Kardex cerrado; se devolvió también el nuevo.' })
  @ApiBadRequestResponse({ description: 'El kardex ya está cerrado.' })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cerrar(@Param('id') id: string, @GetUser() user: Usuario) {
    return await this.kardexService.cerrar(id, user);
  }

  @Patch('kardex/:id/reabrir')
  @Auth()
  @ApiOperation({
    summary: 'Reabrir un kardex cerrado',
    description:
      'Vuelve el kardex a ABIERTO. Solo si el kardex siguiente que se generó al cerrar no tuvo movimientos (en ese caso se elimina).',
  })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiOkResponse({ description: 'Kardex reabierto.', type: Kardex })
  @ApiBadRequestResponse({
    description:
      'El kardex no está cerrado, o el kardex siguiente ya tiene movimientos.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async reabrir(
    @Param('id') id: string,
    @GetUser() user: Usuario,
  ): Promise<Kardex> {
    return await this.kardexService.reabrir(id, user);
  }

  @Patch('kardex/:id/cambiar_estado')
  @Auth()
  @ApiOperation({
    summary: 'Activar / desactivar un kardex',
    description:
      'Baja lógica de un kardex creado por error. Solo se puede desactivar el N° 1, sin kardex posteriores y sin movimientos.',
  })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { activo: { type: 'boolean', example: false } },
    },
  })
  @ApiOkResponse({ description: 'Estado del kardex actualizado.', type: Kardex })
  @ApiBadRequestResponse({
    description: 'No se puede desactivar un kardex con historial o movimientos.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cambiarEstado(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<Kardex> {
    return await this.kardexService.cambiarEstado(id, activo, user);
  }

  @Patch('kardex/:id/reactivar')
  @Auth(ValidRoles.administrador, ValidRoles.operador)
  @ApiOperation({
    summary: 'Reactivar un kardex INACTIVO',
    description:
      'Un kardex ABIERTO pasa a INACTIVO (baja lógica) cuando lleva KARDEX_DIAS_INACTIVIDAD días (.env) sin movimientos, contados desde su último movimiento, su apertura o su última reactivación. Sigue apareciendo en los listados y en el resumen de deudores, pero no admite transacciones nuevas (recibos, libreta, kardex, fondos, dación de pago) hasta reactivarlo. Solo administrador u operador. Reinicia el conteo desde hoy.',
  })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiOkResponse({ description: 'Kardex reactivado, con su `actividad` recalculada.', type: Kardex })
  @ApiBadRequestResponse({
    description: 'El kardex está cerrado, anulado o ya está ACTIVO.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async reactivar(
    @Param('id') id: string,
    @GetUser() user: Usuario,
  ): Promise<Kardex> {
    return await this.kardexService.reactivar(id, user);
  }

  @Get('kardex')
  @Auth()
  @ApiOperation({
    summary: 'Listado paginado de kardex',
    description:
      'Bandeja paginada de kardex (mismo formato que persona_ci / actor-productivo-minero), para elegir un kardex abierto o cerrado antes de entrar a cargarle movimientos. Filtra por tipo, estado, gestión, actor o persona puntual, y por búsqueda libre (nombre del actor, nombre/apellidos de la persona o descripción del kardex). Cada kardex abierto trae `actividad` ({ estado: ACTIVO | INACTIVO, ultimaActividad, inactivoDesde, diasSinActividad, diasInactividad }); los INACTIVOS siguen apareciendo pero no admiten transacciones hasta reactivarlos (PATCH kardex/:id/reactivar). En cerrados o anulados `actividad` es null.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'tipo', required: false, enum: ['ACTOR', 'ASOCIADO', 'PERSONAL', 'CLIENTE'] })
  @ApiQuery({ name: 'estado', required: false, enum: ['ABIERTO', 'CERRADO'] })
  @ApiQuery({ name: 'gestion', required: false, type: Number, example: 2026 })
  @ApiQuery({ name: 'idActorProductivoMinero', required: false, type: String })
  @ApiQuery({ name: 'idPersona', required: false, type: String })
  @ApiQuery({ name: 'idCliente', required: false, type: String })
  @ApiQuery({ name: 'busqueda', required: false, type: String, example: 'Kalamarca' })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['id', 'numero', 'gestion', 'estado', 'fechaApertura'],
  })
  @ApiQuery({ name: 'orderDirection', required: false, enum: ['ASC', 'DESC'] })
  @ApiOkResponse({
    description: 'Listado paginado obtenido correctamente.',
    type: KardexPaginadoDto,
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async findAll(@Query() filtros: FiltrosKardexDto): Promise<KardexPaginadoDto> {
    return await this.kardexService.findAll(filtros);
  }

  @Get('kardex/reporte/deudas-totales/excel')
  @Auth()
  @ApiOperation({
    summary: 'Exportar el resumen de deudas (todos los kardex) a Excel',
    description:
      'Genera el .xlsx "RESUMEN DE DEUDAS" (modelo DEUDAS TOTALES): una fila por cada kardex ABIERTO con saldo por cobrar > 0, con la fecha de su última interacción, cuenta, titular e importe. El kardex de un actor productivo minero y los de sus personas asociadas se agrupan como una CORPORACIÓN con su importe total. Cada deudor se marca INACTIVO cuando pasa un mes contable completo sin interactuar (sin movimientos en su kardex -anticipos, pagos- ni entregas de mineral desde el primer día del mes anterior; para un actor cuentan las entregas de cualquiera de sus personas) y vuelve a ACTIVO con su siguiente interacción.',
  })
  @ApiOkResponse({ description: 'Archivo .xlsx generado correctamente.' })
  @ApiBadRequestResponse({ description: 'Filtros inválidos.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async exportarDeudasTotales(
    @Query() filtro: FiltroDeudasTotalesDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.deudasTotalesExcelService.generar(filtro);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=resumen-deudas${filtro.tipo ? `-${filtro.tipo.toLowerCase()}` : ''}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('kardex/:id')
  @Auth()
  @ApiOperation({ summary: 'Obtener un kardex por id' })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiOkResponse({ description: 'Kardex obtenido.', type: Kardex })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async buscarPorId(@Param('id') id: string): Promise<Kardex> {
    return await this.kardexService.buscarPorId(id);
  }

  @Get('kardex/:id/excel')
  @Auth()
  @ApiOperation({
    summary: 'Exportar el kardex actual a Excel',
    description:
      'Genera el .xlsx del kardex (actor, persona o cliente) con el mismo formato del libro físico: cabecera con proveedor, cuenta y gestión, el detalle de todas las líneas activas (en orden de registro, con APROBADO POR, TIPO DE PAGO ej. "QR - UNION - 123578955" y LOTE) y el total de anticipos por cobrar.',
  })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiOkResponse({ description: 'Archivo .xlsx generado correctamente.' })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async exportarExcel(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.kardexExcelService.generar(id);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=kardex-${id}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
