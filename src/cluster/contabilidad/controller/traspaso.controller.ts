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
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Auth, GetUser } from 'src/security/decorators';
import { Usuario } from 'src/security/entities/usuario.entity';
import { TraspasoService } from '../services/traspaso.service';
import { Traspaso } from '../entities/traspaso.entity';
import { CreateTraspasoDto } from '../dto/traspaso/create-traspaso.dto';
import { FiltroTraspasoDto } from '../dto/traspaso/filtro-traspaso.dto';
import { TraspasoPaginadoDto } from '../dto/traspaso/traspaso-paginado.dto';
import { FiltroTraspasoExcelDto } from '../dto/traspaso/filtro-traspaso-excel.dto';
import { TraspasoExcelService } from '../services/traspaso-excel.service';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class TraspasoController {
  constructor(
    private readonly traspasoService: TraspasoService,
    private readonly traspasoExcelService: TraspasoExcelService,
  ) {}

  @Post('traspaso')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un traspaso interno caja <-> banco',
    description:
      'Sin `id` registra el traspaso; con `id` lo actualiza. Un traspaso mueve fondos propios de la empresa entre la caja de flujo y una cuenta bancaria: no es un ingreso/egreso real del negocio ni una transacción con un tercero, es la misma plata cambiando de custodia. DEPOSITO: sale de la caja (EGRESO) y entra al banco (HABER). RETIRO: sale del banco (DEBE) y entra a la caja (INGRESO). La caja de flujo siempre es la de la empresa (Caja id=1, "CAJA PRINCIPAL"), no se envía. `idDestinoGasto` (opcional, igual que en un recibo) debe ser un destino de EGRESO si tipo=DEPOSITO o de INGRESO si tipo=RETIRO (según su `esEgreso`); se refleja tanto en el movimiento de la caja de flujo como en el de la libreta de bancos, y en ambos queda EXCLUIDO del resumen de "cuánto se gastó/ingresó" de `/contabilidad/reportes/destino-gasto`, porque un traspaso no es un gasto/ingreso real del negocio; sirve para otros reportes contables que sí quieran clasificar/filtrar traspasos. Genera en una sola transacción un movimiento en `/contabilidad/movimiento-caja` y otro en `/contabilidad/libreta-banco`, enlazados entre sí; ambos requieren que la caja y la cuenta ya estén aperturadas. La moneda del traspaso se deriva de la moneda de la cuenta bancaria (BS o USD). Al ACTUALIZAR (con `id`) solo se pueden corregir fecha, concepto, N° de comprobante, destino del gasto y monto: no se puede cambiar el tipo ni la cuenta bancaria (para eso hay que desactivar el traspaso y registrar uno nuevo), y falla si el movimiento de caja o el de banco ya cayeron en un período cerrado.',
  })
  @ApiBody({
    type: CreateTraspasoDto,
    examples: {
      deposito: {
        summary: 'Depósito de efectivo de caja a banco',
        value: {
          fecha: '2026-09-23',
          idCuentaBancaria: 1,
          tipo: 'DEPOSITO',
          nroComprobante: '4478708896',
          concepto: 'DEPÓSITO DE EFECTIVO DE CAJA PRINCIPAL A CTA BANCO UNIÓN',
          idDestinoGasto: 5,
          monto: 1000,
          idPersonaAutorizo: '7',
        },
      },
      retiro: {
        summary: 'Retiro de banco a caja',
        value: {
          fecha: '2026-09-23',
          idCuentaBancaria: 1,
          tipo: 'RETIRO',
          concepto: 'RETIRO DE BANCO UNIÓN PARA REPONER CAJA PRINCIPAL',
          idDestinoGasto: 9,
          monto: 500,
          idPersonaAutorizo: '7',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Traspaso registrado o actualizado correctamente, con el movimiento de caja (`movimientosCaja`) y de banco (`movimientosBanco`) que generó.',
    type: Traspaso,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, la caja o la cuenta bancaria todavía no fueron aperturadas, el destino del gasto no corresponde con el tipo (DEPOSITO exige uno de egreso, RETIRO uno de ingreso), se intentó cambiar el tipo/cuenta al actualizar, alguno de los dos movimientos ya pertenece a un período cerrado, o la persona indicada en idPersonaAutorizo no está autorizada o está inactiva.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró la caja, la cuenta bancaria, el destino del gasto, la persona que autorizó (idPersonaAutorizo), el traspaso a actualizar, o los movimientos que generó.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async guardar(
    @Body() body: CreateTraspasoDto,
    @GetUser() user: Usuario,
  ): Promise<Traspaso> {
    return await this.traspasoService.guardar(body, user);
  }

  @Patch('traspaso/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Activar o desactivar un traspaso',
    description:
      'Baja lógica del traspaso y, en la misma transacción, de los dos movimientos que generó (caja y banco): quedan siempre sincronizados. Solo si ninguno de los dos pertenece a un período cerrado. Recalcula el saldo de la caja y de la cuenta bancaria.',
  })
  @ApiParam({ name: 'id', description: 'Id del traspaso.', example: '4' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { activo: { type: 'boolean', example: false } },
    },
  })
  @ApiOkResponse({
    description: 'Estado del traspaso actualizado.',
    type: Traspaso,
  })
  @ApiBadRequestResponse({
    description: 'El movimiento de caja o el de banco pertenece a un período cerrado.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el traspaso.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ): Promise<Traspaso> {
    return await this.traspasoService.cambiarEstado(id, activo, user);
  }

  @Get('traspaso/reporte/excel')
  @Auth()
  @ApiOperation({
    summary: 'Exportar el libro de traspasos caja <-> banco a Excel',
    description:
      'Genera el .xlsx "LIBRO DE TRASPASOS CAJA - BANCO" con todos los traspasos que cumplan los filtros, sin paginar y en orden cronológico: fecha, tipo, estado, concepto, cuenta bancaria, N° de comprobante, destino del gasto, moneda, importe (depósito caja → banco / retiro banco → caja), usuario que lo registró y observación (quién y cuándo lo desactivó). Los totales solo suman los VIGENTES y van separados por moneda (Bs. / $us); los desactivados salen tachados. Al pie trae un resumen con cantidad e importes por estado y moneda. Todos los filtros son opcionales: sin filtros sale el libro completo.',
  })
  @ApiOkResponse({ description: 'Archivo .xlsx generado correctamente.' })
  @ApiBadRequestResponse({ description: 'Filtros inválidos (ej. fecha desde posterior a fecha hasta).' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async exportarExcel(
    @Query() filtro: FiltroTraspasoExcelDto,
    @GetUser() user: Usuario,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.traspasoExcelService.generar(filtro, user);
    const periodo = [filtro.fechaDesde, filtro.fechaHasta].filter(Boolean).join('_al_');

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=libro-traspasos${periodo ? `-${periodo}` : ''}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('traspaso')
  @Auth()
  @ApiOperation({
    summary: 'Listar traspasos internos caja <-> banco',
    description:
      'Devuelve los traspasos registrados, paginados (`page`, `limit`), más recientes primero por defecto, filtrables por caja, cuenta bancaria, tipo (DEPOSITO/RETIRO) y gestión (año de la fecha). `busqueda` busca en concepto, N° de comprobante y nombres de quien autorizó. Ordenable por `orderBy` (fecha | id | monto) y `orderDirection` (ASC | DESC).',
  })
  @ApiOkResponse({
    description: 'Traspasos obtenidos correctamente.',
    type: TraspasoPaginadoDto,
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listar(@Query() filtro: FiltroTraspasoDto): Promise<TraspasoPaginadoDto> {
    return await this.traspasoService.listar(filtro);
  }

  @Get('traspaso/:id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener un traspaso por id',
    description:
      'Devuelve el traspaso con el movimiento de caja (`movimientosCaja`) y de banco (`movimientosBanco`) que generó.',
  })
  @ApiParam({ name: 'id', description: 'Id del traspaso.', example: '4' })
  @ApiOkResponse({ description: 'Traspaso obtenido correctamente.', type: Traspaso })
  @ApiNotFoundResponse({ description: 'No se encontró el traspaso.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async buscarPorId(@Param('id') id: string): Promise<Traspaso> {
    return await this.traspasoService.buscarPorId(id);
  }
}
