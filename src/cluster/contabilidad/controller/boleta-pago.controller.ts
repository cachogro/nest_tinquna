import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

import { Auth, GetUser, RoleProtected } from 'src/security/decorators';
import { RolesModules } from 'src/security/enums/valid-roles';
import { Usuario } from 'src/security/entities/usuario.entity';
import { BoletaPagoService } from '../services/boleta-pago.service';
import { BoletaPagoPdfService } from '../services/boleta-pago-pdf.service';
import { BoletaPago } from '../entities/boleta-pago.entity';
import {
  CalcularBoletaPagoDto,
  CreateBoletaPagoDto,
} from '../dto/boleta-pago/create-boleta-pago.dto';
import {
  CalcularAguinaldoDto,
  CalcularFiniquitoDto,
  CalcularRetroactivoDto,
  EmitirAguinaldoDto,
  EmitirFiniquitoDto,
  EmitirRetroactivoDto,
} from '../dto/boleta-pago/boletas-especiales.dto';
import { FiltroBoletaPagoDto } from '../dto/boleta-pago/filtro-boleta-pago.dto';
import { ResumenBoletaPagoDto } from '../dto/boleta-pago/resumen-boleta-pago.dto';
import { PlanillaMensualDto } from '../dto/boleta-pago/planilla-mensual.dto';
import { PlanillaSueldosExcelService } from '../services/planilla-sueldos-excel.service';
import { PlanillaFirmasExcelService } from '../services/planilla-firmas-excel.service';
import { PlanillaFirmasDto } from '../dto/boleta-pago/planilla-firmas.dto';
import { ContabilidadPdfService } from '../services/contabilidad-pdf.service';
import { RequierePermisoExcel } from 'src/security/decorators/requiere-permiso.decorator';
import { PERMISO_DESCARGAR_EXCEL_CONTABILIDAD } from 'src/security/enums/permisos';

const PAGO_EJEMPLO = {
  idFormaPago: 1,
  idPersonaAutorizo: '7',
  idPlanCuentas: 45,
};

@ApiTags('Contabilidad')
@Controller('contabilidad')
@ApiBearerAuth()
@RoleProtected(...RolesModules.contabilidad)
export class BoletaPagoController {
  constructor(
    private readonly boletaPagoService: BoletaPagoService,
    private readonly boletaPagoPdfService: BoletaPagoPdfService,
    private readonly planillaSueldosExcelService: PlanillaSueldosExcelService,
    private readonly planillaFirmasExcelService: PlanillaFirmasExcelService,
    private readonly contabilidadPdfService: ContabilidadPdfService,
  ) {}

  @Post('boleta-pago/calcular')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calcular una boleta de sueldo (vista previa, no guarda)',
    description:
      'Mismos importes que POST boleta-pago. Lo que se omite se calcula con la configuración de sueldos de la persona: salario básico proporcional a los días, bono de antigüedad, horas extra, descuentos laborales y aportes patronales (detalle en `detalles`). Devuelve además `explicacion` (cómo se llegó a cada número) y los préstamos vigentes con su descuento sugerido.',
  })
  @ApiBody({
    type: CalcularBoletaPagoDto,
    examples: {
      automatico: {
        summary: 'Todo automático (mes completo)',
        value: { idPersona: '18', fechaDesde: '2026-10-01', fechaHasta: '2026-10-31' },
      },
      horasExtra: {
        summary: 'Con 6 horas extra y 28 días',
        value: { idPersona: '18', fechaDesde: '2026-10-01', fechaHasta: '2026-10-31', diasTrabajados: 28, horasExtra: 6 },
      },
    },
  })
  @ApiOkResponse({ description: 'Cálculo de la boleta.' })
  @ApiBadRequestResponse({ description: 'Persona sin salario, horas extra no habilitadas o descuentos mayores al total ganado.' })
  async calcular(@Body() body: CalcularBoletaPagoDto) {
    return await this.boletaPagoService.calcular(body);
  }

  // ------------------------------------------------------------- aguinaldo
  @Post('boleta-pago/aguinaldo/calcular')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calcular el aguinaldo (vista previa, no guarda)',
    description:
      'Solo si la persona tiene el check aplicaAguinaldo. promedio (de las últimas boletas de SUELDO de la gestión) * días trabajados en la gestión / 360; desde DIAS_MINIMOS_AGUINALDO días.',
  })
  @ApiBody({ type: CalcularAguinaldoDto, examples: { gestion: { value: { idPersona: '18', gestion: 2026 } } } })
  @ApiOkResponse({ description: 'Cálculo del aguinaldo.' })
  async calcularAguinaldo(@Body() body: CalcularAguinaldoDto) {
    return await this.boletaPagoService.calcularAguinaldo(body);
  }

  @Post('boleta-pago/aguinaldo')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir y pagar la boleta de aguinaldo',
    description:
      'Boleta tipo AGUINALDO (una por persona y gestión), sin descuentos de ley ni de préstamos; recibo de EGRESO por el total.',
  })
  @ApiBody({
    type: EmitirAguinaldoDto,
    examples: { pagar: { value: { idPersona: '18', gestion: 2026, fechaPago: '2026-12-18', ...PAGO_EJEMPLO } } },
  })
  @ApiCreatedResponse({ description: 'Aguinaldo pagado.', type: BoletaPago })
  @ApiConflictResponse({ description: 'Ya se pagó el aguinaldo de esa gestión.' })
  async emitirAguinaldo(@Body() body: EmitirAguinaldoDto, @GetUser() user: Usuario) {
    return await this.boletaPagoService.emitirAguinaldo(body, user);
  }

  // ------------------------------------------------------------- finiquito
  @Post('boleta-pago/finiquito/calcular')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calcular el finiquito (vista previa, no guarda)',
    description:
      'Cada rubro solo si la persona tiene el check y el flag no lo apaga: indemnización (promedio * días de servicio / 360, desde DIAS_MINIMOS_INDEMNIZACION), desahucio (solo con incluirDesahucio: true), aguinaldo proporcional (si no se pagó el de la gestión) y vacaciones pendientes (días * promedio / 30). `explicacion.omitidos` dice qué no se incluyó y por qué.',
  })
  @ApiBody({
    type: CalcularFiniquitoDto,
    examples: {
      retiro: {
        summary: 'Retiro voluntario',
        value: { idPersona: '18', fechaRetiro: '2026-10-15', motivoRetiro: 'RETIRO VOLUNTARIO' },
      },
      despido: {
        summary: 'Despido sin preaviso, con sueldo pendiente',
        value: {
          idPersona: '18',
          fechaRetiro: '2026-10-15',
          motivoRetiro: 'DESPIDO',
          incluirDesahucio: true,
          otrosIngresos: [{ nombre: 'Sueldo 1 al 15 de octubre', monto: 1650 }],
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Cálculo del finiquito.' })
  async calcularFiniquito(@Body() body: CalcularFiniquitoDto) {
    return await this.boletaPagoService.calcularFiniquito(body);
  }

  @Post('boleta-pago/finiquito')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir y pagar el finiquito',
    description:
      'Boleta tipo FINIQUITO (una por persona). Puede descontar préstamos (`descuentos`, si se omite no descuenta). Registra las vacaciones pagadas y, salvo registrarRetiro: false, pone la fecha de retiro como fin de labores en la ficha.',
  })
  @ApiBody({
    type: EmitirFiniquitoDto,
    examples: {
      pagar: {
        value: {
          idPersona: '18',
          fechaRetiro: '2026-10-15',
          motivoRetiro: 'RETIRO VOLUNTARIO',
          fechaPago: '2026-10-20',
          descuentos: [{ idPrestamo: '3', monto: 2500 }],
          ...PAGO_EJEMPLO,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Finiquito pagado.', type: BoletaPago })
  @ApiConflictResponse({ description: 'La persona ya tiene un finiquito pagado.' })
  async emitirFiniquito(@Body() body: EmitirFiniquitoDto, @GetUser() user: Usuario) {
    return await this.boletaPagoService.emitirFiniquito(body, user);
  }

  // ----------------------------------------------------------- retroactivo
  @Post('boleta-pago/retroactivo/calcular')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calcular un retroactivo (vista previa, no guarda)',
    description:
      'Por cada boleta de SUELDO pagada cuyo fin de periodo cae en el rango: diferencia de haber básico contra nuevoSalario (si se envía) y de bono de antigüedad contra el salario mínimo vigente (si tiene el check). Sobre el total se calculan sus descuentos y aportes.',
  })
  @ApiBody({
    type: CalcularRetroactivoDto,
    examples: {
      incremento: { value: { idPersona: '18', fechaDesde: '2026-01-01', fechaHasta: '2026-04-30', nuevoSalario: 3300 } },
    },
  })
  @ApiOkResponse({ description: 'Cálculo del retroactivo.' })
  async calcularRetroactivo(@Body() body: CalcularRetroactivoDto) {
    return await this.boletaPagoService.calcularRetroactivo(body);
  }

  @Post('boleta-pago/retroactivo')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir y pagar un retroactivo',
    description: 'Boleta tipo RETROACTIVO. Con nuevoSalario y actualizarSalario (por defecto true) guarda el nuevo salario mensual de la persona.',
  })
  @ApiBody({
    type: EmitirRetroactivoDto,
    examples: {
      pagar: {
        value: {
          idPersona: '18',
          fechaDesde: '2026-01-01',
          fechaHasta: '2026-04-30',
          nuevoSalario: 3300,
          fechaPago: '2026-05-10',
          ...PAGO_EJEMPLO,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Retroactivo pagado.', type: BoletaPago })
  async emitirRetroactivo(@Body() body: EmitirRetroactivoDto, @GetUser() user: Usuario) {
    return await this.boletaPagoService.emitirRetroactivo(body, user);
  }

  // -------------------------------------------------------- planilla mensual
  @Get('boleta-pago/planilla')
  @Auth()
  @ApiOperation({
    summary: 'Planilla mensual de sueldos y aportes',
    description:
      'Boletas PAGADAS con fecha de pago en el mes (por defecto SUELDO y RETROACTIVO). `columnas` = descuentos y aportes usados en el mes; cada fila trae `montos[codigo]`. `porEntidad` = lo que hay que pagar a cada entidad (Gestora, CNS...): descuento al trabajador + aporte de la empresa. `totales.costoEmpresa` = total ganado + aportes patronales.',
  })
  @ApiOkResponse({ description: 'Planilla obtenida correctamente.' })
  async planilla(@Query() q: PlanillaMensualDto) {
    return await this.boletaPagoService.planillaMensual(q.gestion, q.mes, q.tipos);
  }

  @RequierePermisoExcel(PERMISO_DESCARGAR_EXCEL_CONTABILIDAD)
  @Get('boleta-pago/planilla/excel')
  @Auth()
  @ApiOperation({
    summary: 'Planilla mensual de sueldos en Excel o PDF',
    description: 'La misma planilla de GET boleta-pago/planilla. Con `formato=PDF` sale en hoja carta.',
  })
  @ApiOkResponse({ description: 'Archivo generado correctamente.' })
  async planillaExcel(
    @Query() q: PlanillaMensualDto,
    @GetUser() user: Usuario,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.planillaSueldosExcelService.generar(q, user);
    const sufijo = q.gestion && q.mes ? `-${q.gestion}-${String(q.mes).padStart(2, '0')}` : '';
    // Hoja apaisada: la planilla lleva una columna por cada descuento y aporte.
    await this.contabilidadPdfService.enviar(res, buffer, `planilla-sueldos${sufijo}`, q.formato, {
      horizontal: true,
    });
  }

  // --------------------------------------------------- planilla para firmas
  @Get('boleta-pago/planilla-firmas')
  @Auth()
  @ApiOperation({
    summary: 'Planilla de sueldos para firmas',
    description:
      'Todo el personal interno activo que trabajó en el mes (sin depender de boletas), con su salario establecido: días pagados, haber básico, bono de antigüedad, total ganado, descuentos laborales (AFP), anticipos (cuota de préstamos vigentes) y líquido pagable. Horas extra, dominicales e incrementos van en la boleta, no acá. `idTipoContrato` filtra por tipo de contrato; sin él, todo el personal.',
  })
  @ApiOkResponse({ description: 'Planilla obtenida correctamente.' })
  async planillaFirmas(@Query() q: PlanillaFirmasDto) {
    return await this.boletaPagoService.planillaFirmas(q.gestion, q.mes, q.idTipoContrato);
  }

  @RequierePermisoExcel(PERMISO_DESCARGAR_EXCEL_CONTABILIDAD)
  @Get('boleta-pago/planilla-firmas/excel')
  @Auth()
  @ApiOperation({
    summary: 'Planilla de sueldos para firmas en Excel o PDF',
    description:
      'Formato de la planilla del Ministerio de Trabajo: cabecera del empleador (Paramétricas › Sueldos y planillas › Empleador), una fila por trabajador con columna en blanco para su firma y, al pie, nombre, CI y firma del representante legal. Con `formato=PDF` sale en PDF.',
  })
  @ApiOkResponse({ description: 'Archivo generado correctamente.' })
  async planillaFirmasExcel(@Query() q: PlanillaFirmasDto, @Res() res: Response): Promise<void> {
    const buffer = await this.planillaFirmasExcelService.generar(q);
    const sufijo = q.gestion && q.mes ? `-${q.gestion}-${String(q.mes).padStart(2, '0')}` : '';
    // La firma (última columna), el nombre (3ra) y los días (9na) necesitan espacio aunque la
    // firma esté vacía: el PDF reparte el ancho según el texto de cada columna.
    await this.contabilidadPdfService.enviar(res, buffer, `planilla-firmas${sufijo}`, q.formato, {
      horizontal: true,
      anchosMinimos: { 3: 0.11, 9: 0.045, [-1]: 0.12 },
    });
  }

  @Get('boleta-pago/preparar/:idPersona')
  @Auth()
  @ApiOperation({
    summary: 'Datos para armar una boleta de pago',
    description:
      'Devuelve el salario mensual registrado, el kardex PERSONAL y los préstamos VIGENTES de la persona con el descuento sugerido de cada uno (cuota pactada, o el saldo si es menor). No guarda nada.',
  })
  @ApiParam({ name: 'idPersona', description: 'Id de la persona.', example: '18' })
  @ApiOkResponse({ description: 'Datos obtenidos correctamente.' })
  @ApiBadRequestResponse({ description: 'La persona está inactiva o no es personal de la empresa.' })
  @ApiNotFoundResponse({ description: 'No se encontró la persona.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async preparar(@Param('idPersona') idPersona: string) {
    return await this.boletaPagoService.preparar(idPersona);
  }

  @Post('boleta-pago')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir y pagar una boleta de pago',
    description:
      'Boleta con el salario completo por ley (total ganado, descuentos de ley, líquido pagable). Cada importe omitido se calcula con la configuración de sueldos de la persona (ver POST boleta-pago/calcular); lo enviado a mano manda. Guarda el detalle de descuentos laborales y aportes patronales. Internamente descuenta lo indicado para préstamos: cada descuento es un HABER en el kardex PERSONAL SIN movimiento de caja/banco, más la línea DESCUENTO_SUELDO del préstamo. Solo el resto (`montoPagado`) sale de caja/banco con un recibo de EGRESO; si todo el líquido va a préstamos no se genera recibo. No se puede anular una vez pagada.',
  })
  @ApiBody({
    type: CreateBoletaPagoDto,
    examples: {
      cuotaPactada: {
        summary: 'Descontar la cuota pactada (sin enviar descuentos)',
        value: {
          idPersona: '18',
          fechaDesde: '2026-02-28',
          fechaHasta: '2026-03-28',
          fechaPago: '2026-03-28',
          idFormaPago: 1,
          idPersonaAutorizo: '7',
          idPlanCuentas: 45,
        },
      },
      pagaMas: {
        summary: 'El empleado decide descontar más este mes',
        value: {
          idPersona: '18',
          fechaDesde: '2026-03-28',
          fechaHasta: '2026-04-28',
          fechaPago: '2026-04-28',
          diasTrabajados: 30,
          bonoAntiguedad: 0,
          aporteLaboral: 0,
          descuentos: [{ idPrestamo: '3', monto: 2000 }],
          idFormaPago: 1,
          idPersonaAutorizo: '7',
          idPlanCuentas: 45,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Boleta emitida y pagada.', type: BoletaPago })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, persona sin salario, descuentos que superan el saldo del préstamo o el líquido pagable, kardex PERSONAL cerrado/inactivo, o caja/cuenta no aperturada.',
  })
  @ApiConflictResponse({ description: 'Ya existe una boleta para un periodo que se superpone.' })
  @ApiNotFoundResponse({ description: 'No se encontró la persona o un préstamo.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async emitir(
    @Body() body: CreateBoletaPagoDto,
    @GetUser() user: Usuario,
  ): Promise<BoletaPago> {
    return await this.boletaPagoService.emitir(body, user);
  }

  @Get('boleta-pago')
  @Auth()
  @ApiOperation({
    summary: 'Listar boletas de pago',
    description: 'Paginado. Filtros opcionales: persona y rango de fecha de pago.',
  })
  @ApiQuery({ name: 'idPersona', required: false, type: String })
  @ApiQuery({ name: 'tipo', required: false, enum: ['SUELDO', 'AGUINALDO', 'FINIQUITO', 'RETROACTIVO'] })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Listado paginado obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listar(@Query() filtro: FiltroBoletaPagoDto) {
    return await this.boletaPagoService.listar(filtro);
  }

  // Antes de 'boleta-pago/:id': si no, ":id" capturaría "resumen".
  @Get('boleta-pago/resumen')
  @Auth()
  @ApiOperation({
    summary: 'Resumen mensual de sueldos pagados',
    description:
      'Del personal interno que trabajaba en el mes: cuántos ya tienen boleta PAGADA (por fecha de pago) y quiénes faltan. Sin gestion/mes, el mes actual.',
  })
  @ApiOkResponse({ description: 'Resumen obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async resumen(@Query() q: ResumenBoletaPagoDto) {
    return await this.boletaPagoService.resumenMensual(q.gestion, q.mes);
  }

  @Get('boleta-pago/:id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener una boleta de pago',
    description: 'Incluye el recibo del neto y `descuentosPrestamo` (con su préstamo).',
  })
  @ApiParam({ name: 'id', description: 'Id de la boleta.', example: '5' })
  @ApiOkResponse({ description: 'Boleta obtenida correctamente.', type: BoletaPago })
  @ApiNotFoundResponse({ description: 'No se encontró la boleta.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async buscarPorId(@Param('id') id: string): Promise<BoletaPago> {
    return await this.boletaPagoService.buscarPorId(id);
  }

  @Get('boleta-pago/:id/pdf')
  @Auth()
  @ApiOperation({
    summary: 'Generar el PDF de una boleta de pago (3 copias en hoja carta)',
    description:
      'Mismo formato que el recibo vertical: hoja carta con 3 copias (Original, Copia 1, Copia 2), logo, N° de boleta, fecha de pago y N° del recibo del neto. Muestra datos del empleado, periodo, INGRESOS y DESCUENTOS DE LEY hasta el LÍQUIDO PAGABLE. Por defecto agrega la columna DESCUENTO PRÉSTAMOS y el NETO RECIBIDO (monto en letras del neto); con `interno=false` imprime solo la parte de ley (monto en letras del líquido pagable). "Entregue conforme" se llena con el usuario que pide el PDF; "Recibi conforme" con el empleado.',
  })
  @ApiParam({ name: 'id', description: 'Id de la boleta.', example: '5' })
  @ApiQuery({
    name: 'interno',
    required: false,
    type: Boolean,
    description: 'false = ocultar el descuento de préstamos. Por defecto true.',
  })
  @ApiOkResponse({ description: 'PDF generado correctamente.' })
  @ApiNotFoundResponse({ description: 'No se encontró la boleta.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async descargarPdf(
    @Param('id') id: string,
    @Query('interno') interno: string | undefined,
    @GetUser() user: Usuario,
    @Res() res: Response,
  ) {
    const boleta = await this.boletaPagoService.buscarPorId(id);
    const pdf = await this.boletaPagoPdfService.generar(boleta, user, interno !== 'false');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=Boleta-Pago-${String(boleta.numero).padStart(4, '0')}.pdf`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }
}
