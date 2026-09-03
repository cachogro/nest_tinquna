import { Body, Controller, Param, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
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
import { ValorizacionMineral } from '../entities/valorizacion/valorizacion-mineral.entity';
import { CambiarEntregadoValorizacionMineralDto } from '../dto/valorizacion/cambiar-entregado-valorizacion-mineral.dto';
import { ValorizacionEntregadoService } from '../services/valorizacion-entregado.service';

@ApiTags('Registro de Operaciones')
@Controller('comercio_interno')
@ApiBearerAuth()
export class ValorizacionEntregadoController {
  constructor(
    private readonly valorizacionEntregadoService: ValorizacionEntregadoService,
  ) {}

  @Patch('valorizacion_mineral/:id/entregado')
  @Auth()
  @ApiOperation({
    summary:
      'Marcar/desmarcar el material de una valorización como entregado (salió del ingenio)',
    description:
      'Endpoint dedicado exclusivamente a cambiar el campo "entregado" de una ' +
      'valorización, que indica si el material ya salió del ingenio. Pensado ' +
      'para un botón de alternado (toggle) en el front. Solo se puede activar ' +
      '(entregado = true) cuando la valorización está en estado PRE-VALORIZADO ' +
      '(2) o VALORIZADO (3); desmarcar (entregado = false) se permite siempre ' +
      'para revertir una marca hecha por error. Al activar se registra la fecha ' +
      'de entrega; al desmarcar se limpia.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador de la valorización.',
    example: '12',
  })
  @ApiBody({
    description: 'Nuevo valor del campo entregado.',
    type: CambiarEntregadoValorizacionMineralDto,
  })
  @ApiOkResponse({
    description: 'Campo entregado actualizado correctamente.',
    type: ValorizacionMineral,
  })
  @ApiBadRequestResponse({
    description:
      'La valorización no está activa, o se intenta marcar como entregado sin estar en PRE-VALORIZADO o VALORIZADO.',
  })
  @ApiNotFoundResponse({
    description: 'No existe la valorización.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async cambiarEntregado(
    @Param('id') id: string,
    @Body() body: CambiarEntregadoValorizacionMineralDto,
    @GetUser() user: Usuario,
  ): Promise<ValorizacionMineral> {
    return await this.valorizacionEntregadoService.cambiarEntregado(
      id,
      body,
      user,
    );
  }
}
