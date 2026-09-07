import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { ReciboService } from '../services/recibo.service';
import { ReciboPdfService } from '../services/recibo-pdf.service';
import { Recibo } from '../entities/recibo.entity';
import { CreateReciboDto } from '../dto/recibo/create-recibo.dto';
import { ProcesarReciboDto } from '../dto/recibo/procesar-recibo.dto';
import { FiltrosReciboDto } from '../dto/recibo/filtros-recibo.dto';
import { ReciboPaginadoDto } from '../dto/recibo/recibo-paginado.dto';

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
export class ReciboController {
  constructor(
    private readonly reciboService: ReciboService,
    private readonly reciboPdfService: ReciboPdfService,
  ) {}

  @Post('recibo')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generar un recibo de ingreso o egreso (BORRADOR o PROCESADO)',
    description:
      'Genera un recibo (serie R=INGRESO, serie C=EGRESO, numeración global por serie). Dos modos: sin `detalles` queda como BORRADOR (solo la cabecera: tipo, fecha, montoTotal, concepto y contraparte —una de `idPersona`, `idActorProductivoMinero` o `nombresApellidos`, obligatoria alguna de las tres, excluyentes entre sí— ya alcanza para imprimirlo) y se procesa después con `PATCH /contabilidad/recibo/:id/procesar`, o se da de baja con `PATCH /contabilidad/recibo/:id/anular`; con `detalles` se procesa en el mismo paso (queda PROCESADO) y postea automáticamente: primero sus líneas HABER en los kardex personal/actor de cada línea de `detalles` (saldan la deuda puntual); después, en la caja de flujo (Caja id=1, "CAJA PRINCIPAL", el registro maestro de la empresa), hasta DOS movimientos: un INGRESO por la suma de las porciones PERSONAL+ACTOR (valor recuperado por la empresa al saldar esas deudas) y un EGRESO por la porción EFECTIVO (dinero que realmente sale). Un mismo recibo puede generar los dos movimientos de caja a la vez, independientemente de si el recibo en sí es de tipo INGRESO o EGRESO. Al procesar (acá o en `/procesar`), requiere que cada kardex de `detalles` ya esté ABIERTO y que la Caja id=1 ya esté aperturada en BOB. La contraparte física de la cabecera (`idPersona`/`idActorProductivoMinero`/`nombresApellidos`) es solo informativa para la impresión: a quién se le salda la deuda lo definen los `idPersona`/`idActorProductivoMinero` de cada línea de `detalles`, que son independientes. Si `idFormaPago` es un medio bancario (QR, Transferencia, Cheque, Depósito), se puede indicar `idCuentaBancaria` y `nroComprobante`: quedan guardados en el recibo solo como referencia para la impresión, no generan movimiento en la libreta de bancos.',
  })
  @ApiBody({
    type: CreateReciboDto,
    examples: {
      borrador: {
        summary: 'Paso 1: crear como BORRADOR (sin detalles, ya imprimible)',
        value: {
          tipo: 'EGRESO',
          fecha: '2026-09-07',
          montoTotal: 500,
          concepto: 'PAGO POR MINERAL ENTREGADO',
          idPersona: '20',
        },
      },
      borradorConActor: {
        summary: 'Paso 1: BORRADOR con un actor productivo minero como contraparte',
        value: {
          tipo: 'EGRESO',
          fecha: '2026-09-07',
          montoTotal: 1650,
          concepto: 'ANTICIPO A CTA TRANSPORTE',
          idActorProductivoMinero: '4',
        },
      },
      ingreso: {
        summary: 'Recibo de ingreso (R-0020), persona registrada',
        value: {
          tipo: 'INGRESO',
          fecha: '2026-09-04',
          montoTotal: 15000,
          concepto: 'A CUENTA PAGO DE DEUDA',
          idFormaPago: 1,
          idPersona: '18',
          detalles: [{ destino: 'PERSONAL', idPersona: '18', monto: 15000 }],
        },
      },
      egreso: {
        summary: 'Recibo de egreso subdividido (C-932), persona registrada',
        value: {
          tipo: 'EGRESO',
          fecha: '2026-09-03',
          montoTotal: 300000,
          concepto: 'A CUENTA ANTICIPO INGENIO VILLA IMPERIAL',
          idFormaPago: 1,
          idPersona: '20',
          detalles: [
            { destino: 'PERSONAL', idPersona: '20', monto: 150000 },
            { destino: 'ACTOR', idActorProductivoMinero: '4', monto: 100000 },
            { destino: 'EFECTIVO', monto: 50000 },
          ],
        },
      },
      ingresoPorTransferencia: {
        summary: 'Recibo de ingreso pagado por transferencia bancaria',
        value: {
          tipo: 'INGRESO',
          fecha: '2026-09-04',
          montoTotal: 60000,
          concepto: 'DEPOSITO DE EFECTIVO',
          idFormaPago: 3,
          idCuentaBancaria: 1,
          nroComprobante: '4613159797',
          idPersona: '18',
          detalles: [{ destino: 'PERSONAL', idPersona: '18', monto: 60000 }],
        },
      },
      egresoDosPersonasNoRegistradas: {
        summary: 'Recibo de egreso entregado a dos personas no registradas',
        value: {
          tipo: 'EGRESO',
          fecha: '2026-09-04',
          montoTotal: 1650,
          concepto: 'ANTICIPO A CTA TRANSPORTE',
          idFormaPago: 1,
          nombresApellidos: 'JAVIER VARGAS - ROBERTO COLQUE 7MO LOTE',
          detalles: [
            { destino: 'ACTOR', idActorProductivoMinero: '4', monto: 1650 },
          ],
        },
      },
      egresoConDosMovimientosDeCaja: {
        summary: 'Egreso que genera INGRESO + EGRESO en caja a la vez',
        value: {
          tipo: 'EGRESO',
          fecha: '2026-09-04',
          montoTotal: 500,
          concepto: 'PAGO POR MINERAL ENTREGADO',
          idFormaPago: 1,
          idPersona: '20',
          detalles: [
            { destino: 'PERSONAL', idPersona: '20', monto: 200 },
            { destino: 'ACTOR', idActorProductivoMinero: '4', monto: 200 },
            { destino: 'EFECTIVO', monto: 100 },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Recibo generado correctamente, con sus líneas de kardex y hasta dos movimientos de caja de flujo (INGRESO por lo aplicado a kardex, EGRESO por la porción en efectivo).',
    type: Recibo,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, la suma de los detalles no coincide con el montoTotal, algún destinatario no tiene un kardex abierto, o la Caja id=1 todavía no fue aperturada en BOB.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró la persona, el actor, la forma de pago, la cuenta bancaria, el tipo de movimiento, el destino del gasto, o el kardex de algún destinatario.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async generar(
    @Body() body: CreateReciboDto,
    @GetUser() user: Usuario,
  ): Promise<Recibo> {
    return await this.reciboService.generar(body, user);
  }

  @Patch('recibo/:id/procesar')
  @Auth()
  @ApiOperation({
    summary: 'Procesar un recibo BORRADOR (paso 2)',
    description:
      'Solo aplica a un recibo en estado BORRADOR (creado sin `detalles`). Postea las líneas HABER en los kardex de `detalles`, los movimientos de caja de flujo correspondientes, y deja el recibo PROCESADO (terminal: no se puede volver a procesar ni anular). Los campos de pago bancario (`idFormaPago`, `idCuentaBancaria`, `nroComprobante`) son opcionales: si no se envían, se conserva lo que ya tenía el recibo desde que se creó como borrador.',
  })
  @ApiParam({ name: 'id', description: 'Id del recibo (debe estar en estado BORRADOR).', example: '7' })
  @ApiBody({
    type: ProcesarReciboDto,
    examples: {
      procesar: {
        summary: 'Procesar dividiendo entre kardex personal, actor y efectivo',
        value: {
          detalles: [
            { destino: 'PERSONAL', idPersona: '20', monto: 200 },
            { destino: 'ACTOR', idActorProductivoMinero: '4', monto: 200 },
            { destino: 'EFECTIVO', monto: 100 },
          ],
        },
      },
      procesarConBanco: {
        summary: 'Procesar e indicar el banco recién en este paso',
        value: {
          idFormaPago: 3,
          idCuentaBancaria: 1,
          nroComprobante: '4613159797',
          detalles: [{ destino: 'PERSONAL', idPersona: '20', monto: 500 }],
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Recibo procesado correctamente.',
    type: Recibo,
  })
  @ApiBadRequestResponse({
    description:
      'El recibo no está en estado BORRADOR (ya fue procesado o anulado), la suma de los detalles no coincide con el montoTotal, algún destinatario no tiene un kardex abierto, o la Caja id=1 todavía no fue aperturada en BOB.',
  })
  @ApiNotFoundResponse({
    description:
      'No se encontró el recibo, la forma de pago, la cuenta bancaria, el tipo de movimiento, el destino del gasto, o el kardex de algún destinatario.',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async procesar(
    @Param('id') id: string,
    @Body() body: ProcesarReciboDto,
    @GetUser() user: Usuario,
  ): Promise<Recibo> {
    return await this.reciboService.procesar(id, body, user);
  }

  @Patch('recibo/:id/anular')
  @Auth()
  @ApiOperation({
    summary: 'Anular un recibo BORRADOR',
    description:
      'Solo se puede anular un recibo en estado BORRADOR (todavía no generó movimientos de kardex/caja, así que no hay nada que revertir). Un recibo PROCESADO no se puede anular.',
  })
  @ApiParam({ name: 'id', description: 'Id del recibo (debe estar en estado BORRADOR).', example: '7' })
  @ApiOkResponse({
    description: 'Recibo anulado correctamente.',
    type: Recibo,
  })
  @ApiBadRequestResponse({
    description: 'El recibo ya fue procesado, o ya está anulado.',
  })
  @ApiNotFoundResponse({ description: 'No se encontró el recibo.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async anular(
    @Param('id') id: string,
    @GetUser() user: Usuario,
  ): Promise<Recibo> {
    return await this.reciboService.anular(id, user);
  }

  @Get('recibo')
  @Auth()
  @ApiOperation({
    summary: 'Listar recibos (filtrado y paginado)',
    description:
      'Devuelve los recibos paginados, filtrables por tipo, persona, estado (BORRADOR/PROCESADO/ANULADO) y rango de fecha. `busqueda` busca por concepto, nombre/apellidos de la persona, o número de recibo (ej. "R-0020", "C-0932").',
  })
  @ApiOkResponse({
    description: 'Listado de recibos obtenido correctamente.',
    type: ReciboPaginadoDto,
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listar(@Query() filtro: FiltrosReciboDto): Promise<ReciboPaginadoDto> {
    return await this.reciboService.listar(filtro);
  }

  @Get('recibo/:id')
  @Auth()
  @ApiOperation({
    summary: 'Ver el detalle de un recibo',
    description:
      'Devuelve un recibo con sus líneas de aplicación (cada una con la línea de kardex que generó) y los movimientos de caja de flujo que generó (hasta 2: INGRESO por lo aplicado a kardex, EGRESO por la porción en efectivo).',
  })
  @ApiParam({ name: 'id', description: 'Id del recibo.', example: '5' })
  @ApiOkResponse({ description: 'Recibo obtenido correctamente.', type: Recibo })
  @ApiNotFoundResponse({ description: 'No se encontró el recibo.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async buscarPorId(@Param('id') id: string): Promise<Recibo> {
    return await this.reciboService.buscarPorId(id);
  }

  @Get('recibo/:id/pdf')
  @Auth()
  @ApiOperation({
    summary: 'Generar el PDF de un recibo (3 copias en hoja carta)',
    description:
      'Devuelve una hoja carta con 3 copias del recibo apiladas (Original, Copia 1, Copia 2), igual al talonario físico: logo, N° de recibo, monto en Bs. y en letras, contraparte, concepto, forma de pago (Efectivo/Cheque/Banco) y firmas. "Entregue conforme" se llena con el usuario que pide el PDF; "Recibi conforme" con la contraparte del recibo. Funciona con el recibo en cualquier estado (BORRADOR, PROCESADO o ANULADO).',
  })
  @ApiParam({ name: 'id', description: 'Id del recibo.', example: '5' })
  @ApiOkResponse({ description: 'PDF generado correctamente.' })
  @ApiNotFoundResponse({ description: 'No se encontró el recibo.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async descargarPdf(
    @Param('id') id: string,
    @GetUser() user: Usuario,
    @Res() res: Response,
  ) {
    const recibo = await this.reciboService.buscarPorId(id);
    const pdf = await this.reciboPdfService.generar(recibo, user);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=Recibo-${recibo.serie}-${recibo.numero}.pdf`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }
}
