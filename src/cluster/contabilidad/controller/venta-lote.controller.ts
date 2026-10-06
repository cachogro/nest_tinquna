import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Auth, GetUser } from 'src/security/decorators';
import { Usuario } from 'src/security/entities/usuario.entity';
import { PromedioMineral } from 'src/cluster/comercio-interno/entities/promedio/promedio-mineral.entity';
import {
  CreateVentaLoteDto,
  EstimarVentaLoteDto,
  FiltroPromediosDisponiblesVentaDto,
  FiltroVentaLoteDto,
  LiquidarVentaLoteDto,
  UpdateVentaLoteDto,
} from '../dto/venta-lote/venta-lote.dto';
import { VentaLoteConResumen, VentaLoteService } from '../services/venta-lote.service';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class VentaLoteController {
  constructor(private readonly ventaLoteService: VentaLoteService) {}

  @Get('venta-lote/promedios-disponibles')
  @Auth()
  @ApiOperation({
    summary: 'Promedios (lotes) que se pueden vender',
    description: 'Promedios activos sin una venta vigente. Máximo 100, más recientes primero.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  promediosDisponibles(
    @Query() filtro: FiltroPromediosDisponiblesVentaDto,
  ): Promise<PromedioMineral[]> {
    return this.ventaLoteService.promediosDisponibles(filtro);
  }

  @Get('venta-lote')
  @Auth()
  @ApiOperation({
    summary: 'Listar ventas de lote con su seguimiento de cobro',
    description:
      'Paginado. Cada fila trae totalEfectivoInvertido, cobradoBolivianos (recibos PROCESADOS), pendienteBolivianos (BORRADOR), porCobrarBolivianos y utilidadBolivianos (estos dos solo LIQUIDADA) y `pagada`.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  listar(@Query() filtro: FiltroVentaLoteDto) {
    return this.ventaLoteService.listar(filtro);
  }

  @Get('venta-lote/clientes')
  @Auth()
  @ApiOperation({
    summary: 'Clientes compradores con su cuenta corriente',
    description:
      'Todos los clientes activos (primero COMERCIO_INTERNO, luego EXPORTACION) con: anticiposBolivianos (todo lo recibido), liquidadoBolivianos (suma de lotes liquidados), aplicadoBolivianos, anticipoDisponibleBolivianos (recibido que aún no paga ningún lote), saldoBolivianos (positivo = a favor del cliente, se le deben lotes; negativo = el cliente debe), lotes abiertos/liquidados/pagados y saldoProyectadoBolivianos (saldo menos el estimado propio de los lotes sin liquidar). Se calcula desde el kardex CLIENTE.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  cuentasClientes() {
    return this.ventaLoteService.cuentasClientes();
  }

  @Get('venta-lote/clientes/:idCliente')
  @Auth()
  @ApiOperation({
    summary: 'Cuenta corriente de un cliente comprador',
    description:
      'Resumen de la cuenta, sus lotes vigentes (cada uno con lo que la cuenta le paga: en COMERCIO_INTERNO los anticipos pagan los lotes LIQUIDADOS del más antiguo al más nuevo; un lote sin liquidar no recibe nada) y los movimientos de su kardex con saldo corrido.',
  })
  @ApiParam({ name: 'idCliente', example: '1' })
  @ApiNotFoundResponse({ description: 'No existe el cliente.' })
  cuentaCliente(@Param('idCliente') idCliente: string) {
    return this.ventaLoteService.cuentaCliente(idCliente);
  }

  @Get('venta-lote/:id')
  @Auth()
  @ApiOperation({ summary: 'Venta de lote con sus recibos de cobro y resumen' })
  @ApiParam({ name: 'id', example: '4' })
  @ApiNotFoundResponse({ description: 'No existe la venta.' })
  buscarPorId(@Param('id') id: string): Promise<VentaLoteConResumen> {
    return this.ventaLoteService.buscarPorId(id);
  }

  @Post('venta-lote')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Vender un lote (promedio) entero a un cliente',
    description:
      'Nace ABIERTA, sin monto. El cliente debe tener kardex CLIENTE abierto. Los anticipos se registran como recibos de INGRESO con `idVentaLote`.',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos, cliente sin kardex abierto o falta tipo de cambio en USD.' })
  crear(@Body() dto: CreateVentaLoteDto, @GetUser() user: Usuario): Promise<VentaLoteConResumen> {
    return this.ventaLoteService.crear(dto, user);
  }

  @Patch('venta-lote/:id')
  @Auth()
  @ApiOperation({ summary: 'Corregir fecha, observaciones o tipo de cambio de referencia' })
  @ApiParam({ name: 'id', example: '4' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: UpdateVentaLoteDto,
    @GetUser() user: Usuario,
  ): Promise<VentaLoteConResumen> {
    return this.ventaLoteService.actualizar(id, dto, user);
  }

  @Patch('venta-lote/:id/monto-estimado')
  @Auth()
  @ApiOperation({
    summary: 'Registrar o corregir el monto estimado de la valorización',
    description:
      'Lo que la empresa calcula que vale el lote antes de recibir la liquidación del comprador, en la moneda de la venta. Solo referencial (no mueve kardex ni caja). `montoEstimado: null` quita la estimación. La respuesta trae `diferenciaEstimado` (montoVenta − montoEstimado) cuando la venta está LIQUIDADA.',
  })
  @ApiParam({ name: 'id', example: '4' })
  @ApiBadRequestResponse({ description: 'Monto inválido o venta anulada.' })
  estimar(
    @Param('id') id: string,
    @Body() dto: EstimarVentaLoteDto,
    @GetUser() user: Usuario,
  ): Promise<VentaLoteConResumen> {
    return this.ventaLoteService.estimar(id, dto, user);
  }

  @Patch('venta-lote/:id/liquidar')
  @Auth()
  @ApiOperation({
    summary: 'Registrar la liquidación final (neta) del comprador',
    description:
      'Pasa a LIQUIDADA y carga el monto (en Bs.) como DEBE en el kardex del cliente, que los anticipos (HABER) van cancelando.',
  })
  @ApiParam({ name: 'id', example: '4' })
  liquidar(
    @Param('id') id: string,
    @Body() dto: LiquidarVentaLoteDto,
    @GetUser() user: Usuario,
  ): Promise<VentaLoteConResumen> {
    return this.ventaLoteService.liquidar(id, dto, user);
  }

  @Patch('venta-lote/:id/reabrir')
  @Auth()
  @ApiOperation({
    summary: 'Deshacer la liquidación para corregirla',
    description: 'Da de baja la línea DEBE del kardex y vuelve a ABIERTA. Requiere que ese kardex siga abierto.',
  })
  @ApiParam({ name: 'id', example: '4' })
  reabrir(@Param('id') id: string, @GetUser() user: Usuario): Promise<VentaLoteConResumen> {
    return this.ventaLoteService.reabrir(id, user);
  }

  @Patch('venta-lote/:id/anular')
  @Auth()
  @ApiOperation({
    summary: 'Anular una venta',
    description: 'Solo ABIERTA y sin recibos vigentes. Libera el promedio para venderlo de nuevo.',
  })
  @ApiParam({ name: 'id', example: '4' })
  anular(@Param('id') id: string, @GetUser() user: Usuario): Promise<VentaLoteConResumen> {
    return this.ventaLoteService.anular(id, user);
  }
}
