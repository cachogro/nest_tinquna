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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Auth, GetUser, RoleProtected } from 'src/security/decorators';
import { RolesModules } from 'src/security/enums/valid-roles';
import { Usuario } from 'src/security/entities/usuario.entity';
import { ChequeService } from '../services/cheque.service';
import {
  AnularChequeEnBlancoDto,
  CobrarChequeDto,
  CuentaChequeDto,
  FiltroChequeDto,
  FiltroTalonarioChequeDto,
  GuardarTalonarioChequeDto,
} from '../dto/cheque/cheque.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
@RoleProtected(...RolesModules.contabilidad)
export class ChequeController {
  constructor(private readonly chequeService: ChequeService) {}

  //------------------ talonarios (chequeras) ----------------------

  @Post('talonario-cheque')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un talonario de cheques',
    description:
      'Sin `id` registra el talonario que entregó el banco (rango `numeroInicial`–`numeroFinal`); con `id` lo actualiza. La cuenta debe tener habilitado el manejo de cheques. Dos talonarios activos de la misma cuenta y serie no pueden superponerse. `fechaVencimiento` es opcional: por ley el talonario no vence. Al actualizar, el rango no puede dejar fuera cheques ya usados. Devuelve el talonario con cuántos cheques le quedan.',
  })
  @ApiBody({
    type: GuardarTalonarioChequeDto,
    examples: {
      crear: {
        summary: 'Registrar talonario de 50 cheques',
        value: {
          idCuentaBancaria: 1,
          numeroInicial: 1001,
          numeroFinal: 1050,
          fechaRecepcion: '2026-10-06',
        },
      },
      actualizar: {
        summary: 'Actualizar talonario',
        value: {
          id: 3,
          idCuentaBancaria: 1,
          numeroInicial: 1001,
          numeroFinal: 1050,
          fechaRecepcion: '2026-10-06',
          observacion: 'Entregado en agencia central.',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Talonario registrado o actualizado.' })
  @ApiBadRequestResponse({
    description:
      'Rango inválido, cuenta sin manejo de cheques, o el nuevo rango deja fuera cheques usados.',
  })
  @ApiConflictResponse({
    description: 'El rango se superpone con otro talonario activo de la cuenta.',
  })
  @ApiNotFoundResponse({ description: 'No existe la cuenta o el talonario.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  guardarTalonario(
    @Body() body: GuardarTalonarioChequeDto,
    @GetUser() user: Usuario,
  ) {
    return this.chequeService.guardarTalonario(body, user);
  }

  @Patch('talonario-cheque/cambiar_estado/:id')
  @Auth()
  @ApiOperation({
    summary: 'Activar o desactivar un talonario de cheques',
    description:
      'Un talonario inactivo deja de ofrecer cheques (los ya usados se conservan). Sirve para dar de baja un talonario terminado, devuelto o extraviado.',
  })
  @ApiParam({ name: 'id', description: 'Identificador del talonario.', example: 3 })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { activo: { type: 'boolean', example: false } },
    },
  })
  @ApiOkResponse({ description: 'Estado actualizado.' })
  @ApiNotFoundResponse({ description: 'No se encontró el talonario.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  cambiarEstadoTalonario(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
    return this.chequeService.cambiarEstadoTalonario(id, activo, user);
  }

  @Get('talonario-cheque')
  @Auth()
  @ApiOperation({
    summary: 'Listar talonarios de cheques',
    description:
      'Talonarios (activos e inactivos), opcionalmente de una cuenta, cada uno con `total`, `emitidos`, `cobrados`, `anulados`, `disponibles` y `siguienteNumero`.',
  })
  @ApiOkResponse({ description: 'Listado obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  listarTalonarios(@Query() filtro: FiltroTalonarioChequeDto) {
    return this.chequeService.listarTalonarios(filtro);
  }

  //------------------ cheques ----------------------

  @Get('cheque/siguiente')
  @Auth()
  @ApiOperation({
    summary: 'Próximo cheque disponible de una cuenta',
    description:
      'Para proponer el N° de cheque al pagar. Devuelve `manejaCheques`, `siguienteNumero` (null si no quedan), `serie`, `idTalonarioCheque` y `disponibles` (cheques sin usar entre todos los talonarios activos). Si la cuenta no maneja cheques devuelve `manejaCheques: false` y el N° de comprobante sigue siendo libre.',
  })
  @ApiOkResponse({ description: 'Consulta realizada.' })
  @ApiNotFoundResponse({ description: 'No existe la cuenta bancaria.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  siguiente(@Query() filtro: CuentaChequeDto) {
    return this.chequeService.siguiente(filtro.idCuentaBancaria);
  }

  @Get('cheque')
  @Auth()
  @ApiOperation({
    summary: 'Listar cheques usados',
    description:
      'Cheques emitidos, cobrados o anulados, filtrables por cuenta, talonario y estado (los más recientes primero, hasta 500). Los EMITIDO traen `diasParaVencer` y `vencido` según su `fechaLimiteCobro` (30 días desde la emisión o la última revalidación).',
  })
  @ApiOkResponse({ description: 'Listado obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  listarCheques(@Query() filtro: FiltroChequeDto) {
    return this.chequeService.listarCheques(filtro);
  }

  @Patch('cheque/:id/cobrar')
  @Auth()
  @ApiOperation({
    summary: 'Marcar un cheque como cobrado',
    description:
      'El banco ya pagó el cheque: pasa de EMITIDO a COBRADO con su `fechaCobro`. No mueve la libreta de bancos (el egreso ya se registró al emitirlo).',
  })
  @ApiParam({ name: 'id', description: 'Identificador del cheque.', example: 12 })
  @ApiOkResponse({ description: 'Cheque marcado como cobrado.' })
  @ApiBadRequestResponse({
    description: 'El cheque no está EMITIDO o la fecha es anterior a la emisión.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el cheque.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  cobrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CobrarChequeDto,
    @GetUser() user: Usuario,
  ) {
    return this.chequeService.cobrar(id, body, user);
  }

  @Patch('cheque/:id/deshacer-cobro')
  @Auth()
  @ApiOperation({
    summary: 'Deshacer el cobro de un cheque',
    description: 'Se marcó como cobrado por error: vuelve a EMITIDO.',
  })
  @ApiParam({ name: 'id', description: 'Identificador del cheque.', example: 12 })
  @ApiOkResponse({ description: 'El cheque volvió a EMITIDO.' })
  @ApiBadRequestResponse({ description: 'El cheque no está COBRADO.' })
  @ApiNotFoundResponse({ description: 'No se encontró el cheque.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  deshacerCobro(@Param('id', ParseIntPipe) id: number, @GetUser() user: Usuario) {
    return this.chequeService.deshacerCobro(id, user);
  }

  @Patch('cheque/:id/revalidar')
  @Auth()
  @ApiOperation({
    summary: 'Revalidar un cheque emitido',
    description:
      'Para un cheque EMITIDO que no se cobró dentro de su plazo: desde hoy corre un nuevo plazo de 30 días (`fechaLimiteCobro`) y queda registrada la `fechaRevalidacion`.',
  })
  @ApiParam({ name: 'id', description: 'Identificador del cheque.', example: 12 })
  @ApiOkResponse({ description: 'Cheque revalidado.' })
  @ApiBadRequestResponse({ description: 'El cheque no está EMITIDO.' })
  @ApiNotFoundResponse({ description: 'No se encontró el cheque.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  revalidar(@Param('id', ParseIntPipe) id: number, @GetUser() user: Usuario) {
    return this.chequeService.revalidar(id, user);
  }

  @Post('cheque/anular')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Anular un cheque sin usar',
    description:
      'Para un cheque del talonario que nunca se usó en un pago (dañado, mal llenado, extraviado). El número se consume y no vuelve a estar disponible. Un cheque ya emitido no se anula acá: se anula el pago que lo generó y el cheque queda ANULADO automáticamente.',
  })
  @ApiBody({
    type: AnularChequeEnBlancoDto,
    examples: {
      ejemplo: {
        summary: 'Cheque dañado',
        value: {
          idTalonarioCheque: 3,
          numero: 1007,
          motivo: 'Cheque dañado al llenarlo.',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Cheque anulado.' })
  @ApiBadRequestResponse({
    description: 'El número no pertenece al talonario o el talonario está inactivo.',
  })
  @ApiConflictResponse({ description: 'El cheque ya fue utilizado.' })
  @ApiNotFoundResponse({ description: 'No se encontró el talonario.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  anularEnBlanco(
    @Body() body: AnularChequeEnBlancoDto,
    @GetUser() user: Usuario,
  ) {
    return this.chequeService.anularEnBlanco(body, user);
  }
}
