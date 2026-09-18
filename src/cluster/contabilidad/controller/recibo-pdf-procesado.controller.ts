import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
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
import { ReciboService } from '../services/recibo.service';
import { ReciboPdfService } from '../services/recibo-pdf.service';

/**
 * Controlador separado de `ReciboController` (que sirve el PDF "recibo
 * generado") para que el front pueda descargar el PDF "recibo procesado"
 * de forma independiente. Mismo formato de talonario de 3 copias; la única
 * diferencia es que "Por concepto (de)" desglosa las líneas del recibo
 * (kardex personal / kardex de actor / efectivo) cuando el recibo ya tiene
 * `detalles`.
 */
@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class ReciboPdfProcesadoController {
  constructor(
    private readonly reciboService: ReciboService,
    private readonly reciboPdfService: ReciboPdfService,
  ) {}

  @Get('recibo/:id/pdf-procesado')
  @Auth()
  @ApiOperation({
    summary: 'Generar el PDF de un recibo PROCESADO (con desglose en "Por concepto")',
    description:
      'Mismo formato que `GET /contabilidad/recibo/:id/pdf` (hoja carta con 3 copias, igual al talonario físico). La única diferencia: en "Por concepto (de)" no muestra solo el texto libre del recibo, sino que lo desglosa según sus `detalles` (ej. "PAGO POR MINERAL ENTREGADO: Bs 200,00 a kardex personal, Bs 200,00 a kardex de actor y Bs 100,00 en efectivo"). Si el recibo todavía no tiene `detalles` (BORRADOR o ANULADO), el resultado es idéntico al PDF de `/pdf`. Los dos PDF se pueden descargar por separado.',
  })
  @ApiParam({ name: 'id', description: 'Id del recibo.', example: '5' })
  @ApiOkResponse({ description: 'PDF generado correctamente.' })
  @ApiNotFoundResponse({ description: 'No se encontró el recibo.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async descargarPdfProcesado(
    @Param('id') id: string,
    @GetUser() user: Usuario,
    @Res() res: Response,
  ) {
    const recibo = await this.reciboService.buscarPorId(id);
    const pdf = await this.reciboPdfService.generarProcesado(recibo, user);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=Recibo-${recibo.serie}-${recibo.numero}-procesado.pdf`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }
}
