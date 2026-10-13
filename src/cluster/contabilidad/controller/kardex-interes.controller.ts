import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Auth, GetUser, RoleProtected } from 'src/security/decorators';
import { Usuario } from 'src/security/entities/usuario.entity';
import { RolesModules, ValidRoles } from 'src/security/enums/valid-roles';
import {
  DetalleInteresKardex,
  KardexInteresService,
} from '../services/kardex-interes.service';
import { AplicarKardexInteresDto } from '../dto/kardex-interes/aplicar-kardex-interes.dto';
import { CambiarTasaKardexInteresDto } from '../dto/kardex-interes/cambiar-tasa-kardex-interes.dto';
import { CondonarKardexInteresDto } from '../dto/kardex-interes/condonar-kardex-interes.dto';
import { CargarKardexInteresDto } from '../dto/kardex-interes/cargar-kardex-interes.dto';
import { ObservacionKardexInteresDto } from '../dto/kardex-interes/observacion-kardex-interes.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
@RoleProtected(...RolesModules.contabilidad)
export class KardexInteresController {
  constructor(private readonly kardexInteresService: KardexInteresService) {}

  @Get('kardex/:id/interes')
  @Auth()
  @ApiOperation({
    summary: 'Sección de intereses de un kardex',
    description:
      'Devuelve el `resumen` (tasa, cuotas pendientes, importe pendiente / cargado / condonado y `totalConIntereses` = saldo del kardex + pendiente), el plan `vigente` y todos los `planes` del kardex con sus cuotas mensuales y su bitácora de eventos. Antes de responder pone al día el plan vigente: genera las cuotas de los meses ya cumplidos y recalcula las pendientes contra el saldo del kardex. `resumen` es null si nunca se le aplicó interés.',
  })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiOkResponse({ description: 'Intereses del kardex.' })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async detalle(@Param('id') id: string): Promise<DetalleInteresKardex> {
    return await this.kardexInteresService.detalle(id);
  }

  @Post('kardex/:id/interes')
  @Auth(ValidRoles.administrador, ValidRoles.operador)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Aplicar un interés mensual por mora a un kardex',
    description:
      'Solo kardex ABIERTO de tipo ACTOR, ASOCIADO o PERSONAL con deuda (saldo > 0), y un solo plan vigente a la vez. Cada mes (contado desde `fechaInicio`) genera una cuota = saldo del kardex al día de corte x `tasaMensual` / 100. El interés se lleva aparte: no cambia el saldo del kardex hasta que se carga (POST kardex-interes/:id/cargar).',
  })
  @ApiParam({ name: 'id', description: 'Id del kardex.', example: '3' })
  @ApiCreatedResponse({ description: 'Interés aplicado; devuelve la sección de intereses.' })
  @ApiBadRequestResponse({
    description: 'Kardex de cliente, cerrado o sin deuda; o datos inválidos.',
  })
  @ApiConflictResponse({ description: 'El kardex ya tiene un interés vigente.' })
  @ApiNotFoundResponse({ description: 'No se encontró el kardex.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async aplicar(
    @Param('id') id: string,
    @Body() body: AplicarKardexInteresDto,
    @GetUser() user: Usuario,
  ): Promise<DetalleInteresKardex> {
    return await this.kardexInteresService.aplicar(id, body, user);
  }

  @Patch('kardex-interes/:id/tasa')
  @Auth(ValidRoles.administrador, ValidRoles.operador)
  @ApiOperation({
    summary: 'Cambiar la tasa (acuerdo): recalcula los intereses pendientes',
    description:
      'Cambia la tasa mensual del plan y recalcula TODAS sus cuotas PENDIENTES con la tasa nueva (las ya cargadas al kardex o condonadas no se tocan). Queda en la bitácora la tasa anterior, la nueva y el total pendiente antes y después.',
  })
  @ApiParam({ name: 'id', description: 'Id del plan de intereses.', example: '1' })
  @ApiOkResponse({ description: 'Tasa cambiada; devuelve la sección de intereses.' })
  @ApiBadRequestResponse({ description: 'Misma tasa, o plan finalizado sin cuotas pendientes.' })
  @ApiNotFoundResponse({ description: 'No se encontró el plan de intereses.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cambiarTasa(
    @Param('id') id: string,
    @Body() body: CambiarTasaKardexInteresDto,
    @GetUser() user: Usuario,
  ): Promise<DetalleInteresKardex> {
    return await this.kardexInteresService.cambiarTasa(id, body, user);
  }

  @Patch('kardex-interes/:id/condonar')
  @Auth(ValidRoles.administrador, ValidRoles.operador)
  @ApiOperation({
    summary: 'Condonar (perdonar) los intereses pendientes',
    description:
      'Las cuotas PENDIENTES pasan a CONDONADO: no se cobran ni llegan al kardex. Por defecto además finaliza el plan (deja de generar intereses); con `finalizar=false` sigue corriendo los meses siguientes.',
  })
  @ApiParam({ name: 'id', description: 'Id del plan de intereses.', example: '1' })
  @ApiOkResponse({ description: 'Intereses condonados; devuelve la sección de intereses.' })
  @ApiBadRequestResponse({ description: 'No hay intereses pendientes.' })
  @ApiNotFoundResponse({ description: 'No se encontró el plan de intereses.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async condonar(
    @Param('id') id: string,
    @Body() body: CondonarKardexInteresDto,
    @GetUser() user: Usuario,
  ): Promise<DetalleInteresKardex> {
    return await this.kardexInteresService.condonar(id, body, user);
  }

  @Post('kardex-interes/:id/cargar')
  @Auth(ValidRoles.administrador, ValidRoles.operador)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cargar los intereses pendientes al kardex',
    description:
      'Suma las cuotas PENDIENTES y las registra en el kardex como UNA línea DEBE ("INTERESES POR MORA x % MENSUAL - n MESES"), sin movimiento de caja ni de banco. Las cuotas pasan a CARGADO y el saldo del kardex sube por ese importe; desde ahí se cobra con un recibo como cualquier otra deuda. El kardex debe estar ABIERTO y ACTIVO. Con `finalizar=true` además deja de generar intereses.',
  })
  @ApiParam({ name: 'id', description: 'Id del plan de intereses.', example: '1' })
  @ApiOkResponse({ description: 'Intereses cargados; devuelve la sección de intereses.' })
  @ApiBadRequestResponse({
    description: 'No hay intereses pendientes, o el kardex está cerrado o INACTIVO.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el plan de intereses.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async cargar(
    @Param('id') id: string,
    @Body() body: CargarKardexInteresDto,
    @GetUser() user: Usuario,
  ): Promise<DetalleInteresKardex> {
    return await this.kardexInteresService.cargar(id, body, user);
  }

  @Patch('kardex-interes/cargo/:idMovimientoKardex/revertir')
  @Auth(ValidRoles.administrador, ValidRoles.operador)
  @ApiOperation({
    summary: 'Revertir un cargo de intereses',
    description:
      'Da de baja la línea DEBE que generó el cargo (el saldo del kardex baja por ese importe) y sus cuotas vuelven a PENDIENTE, para renegociarlas, cargarlas de nuevo o condonarlas. Es la única forma de anular esa línea: desde la bandeja del kardex está bloqueada.',
  })
  @ApiParam({
    name: 'idMovimientoKardex',
    description: 'Id de la línea del kardex generada por el cargo.',
    example: '120',
  })
  @ApiOkResponse({ description: 'Cargo revertido; devuelve la sección de intereses.' })
  @ApiBadRequestResponse({ description: 'El kardex de la línea está cerrado.' })
  @ApiNotFoundResponse({ description: 'La línea no es un cargo de intereses.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async revertirCargo(
    @Param('idMovimientoKardex') idMovimientoKardex: string,
    @Body() body: ObservacionKardexInteresDto,
    @GetUser() user: Usuario,
  ): Promise<DetalleInteresKardex> {
    return await this.kardexInteresService.revertirCargo(idMovimientoKardex, body, user);
  }

  @Patch('kardex-interes/:id/finalizar')
  @Auth(ValidRoles.administrador, ValidRoles.operador)
  @ApiOperation({
    summary: 'Finalizar un plan de intereses',
    description:
      'El plan deja de generar cuotas desde hoy. Las cuotas PENDIENTES no se pierden: quedan para cargarlas al kardex o condonarlas.',
  })
  @ApiParam({ name: 'id', description: 'Id del plan de intereses.', example: '1' })
  @ApiOkResponse({ description: 'Plan finalizado; devuelve la sección de intereses.' })
  @ApiBadRequestResponse({ description: 'El plan ya está finalizado.' })
  @ApiNotFoundResponse({ description: 'No se encontró el plan de intereses.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async finalizar(
    @Param('id') id: string,
    @Body() body: ObservacionKardexInteresDto,
    @GetUser() user: Usuario,
  ): Promise<DetalleInteresKardex> {
    return await this.kardexInteresService.finalizar(id, body, user);
  }
}
