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
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { Auth, GetUser } from 'src/security/decorators';
import { Usuario } from 'src/security/entities/usuario.entity';
import { PagoValorizacionService } from '../services/pago-valorizacion.service';
import { PagoValorizacion } from '../entities/pago-valorizacion.entity';
import { CreatePagoValorizacionDto } from '../dto/pago-valorizacion/create-pago-valorizacion.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class PagoValorizacionController {
  constructor(private readonly pagoService: PagoValorizacionService) {}

  @Get('pago-valorizacion/preparar/:idValorizacion')
  @Auth()
  @ApiOperation({
    summary: 'Datos para registrar el pago de una valorización',
    description:
      'Líquido pagable, anticipo y otros anticipos de la valorización; en qué kardex se cancelará el anticipo de la recepción (donde su recibo lo cargó como deuda) y el pago vigente si ya se registró.',
  })
  @ApiParam({ name: 'idValorizacion', example: '12' })
  preparar(@Param('idValorizacion') idValorizacion: string) {
    return this.pagoService.preparar(idValorizacion);
  }

  @Post('pago-valorizacion')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar el pago de una valorización (sin recibo)',
    description:
      'Transacción interna: el respaldo es el PDF de la valorización firmado. La valorización debe estar VALORIZADA y no tener otro pago vigente. Lo que se paga (líquido − abonos) sale como EGRESO de la caja de flujo (efectivo) o de la libreta bancaria (QR, transferencia, cheque, depósito: exige `idCuentaBancaria` y `nroComprobante`), con concepto "VALORIZACIÓN <código>", y NO se anota en ningún kardex. `abonos` (opcional) deja parte del líquido en uno o más kardex abiertos como HABER. Además se anotan como HABER los anticipos que la valorización ya descontó: el de la recepción, automáticamente en el kardex donde su recibo lo cargó; los "otros anticipos", en `kardexOtrosAnticipos` (obligatorio si los hay).',
  })
  registrar(
    @Body() dto: CreatePagoValorizacionDto,
    @GetUser() user: Usuario,
  ): Promise<PagoValorizacion> {
    return this.pagoService.registrar(dto, user);
  }

  @Get('pago-valorizacion/:id')
  @Auth()
  @ApiOperation({ summary: 'Obtener un pago de valorización con sus líneas de kardex' })
  @ApiParam({ name: 'id', example: '3' })
  buscarPorId(@Param('id') id: string): Promise<PagoValorizacion> {
    return this.pagoService.buscarPorId(id);
  }

  @Patch('pago-valorizacion/:id/anular')
  @Auth()
  @ApiOperation({
    summary: 'Anular el pago de una valorización',
    description:
      'Da de baja el movimiento de caja o de libreta y las líneas de kardex del pago, y recalcula saldos. Falla si alguno cayó en un período cerrado o en un kardex ya cerrado. La valorización queda libre para registrar el pago de nuevo.',
  })
  @ApiParam({ name: 'id', example: '3' })
  anular(
    @Param('id') id: string,
    @GetUser() user: Usuario,
  ): Promise<PagoValorizacion> {
    return this.pagoService.anular(id, user);
  }
}
