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
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Auth, GetUser } from 'src/security/decorators';
import { RolesModules } from 'src/security/enums/valid-roles';
import { Usuario } from 'src/security/entities/usuario.entity';
import { PlanillaConfigService } from '../services/planilla-config.service';
import { GuardarParametrosPlanillaDto } from '../dto/planilla/guardar-parametros-planilla.dto';
import { GuardarConceptoPlanillaDto } from '../dto/planilla/guardar-concepto-planilla.dto';
import { GuardarEscalaPlanillaDto } from '../dto/planilla/guardar-escala-planilla.dto';
import { GuardarTipoContratoDto } from '../dto/planilla/guardar-tipo-contrato.dto';
import { GuardarHorarioTrabajoDto } from '../dto/planilla/guardar-horario-trabajo.dto';
import { GuardarDatosEmpleadorDto } from '../dto/planilla/guardar-datos-empleador.dto';
import { GuardarBeneficioPlanillaDto } from '../dto/planilla/guardar-beneficio-planilla.dto';
import { TipoEscalaPlanilla } from '../entities/escala-planilla.entity';

const ESTADO_BODY = {
  schema: { type: 'object', properties: { activo: { type: 'boolean', example: false } } },
};

/**
 * Panel "Sueldos y planillas" de Paramétricas: parámetros, descuentos y
 * aportes, escalas por antigüedad y tipos de contrato. Leer es libre para
 * cualquier usuario autenticado (lo usa la boleta de pago); modificar,
 * solo Configuraciones.
 */
@ApiTags('Paramétricas - Sueldos y planillas')
@Controller('parametricas')
@ApiBearerAuth()
export class PlanillaConfigController {
  constructor(private readonly planillaConfigService: PlanillaConfigService) {}

  @Get('planilla/configuracion')
  @Auth()
  @ApiOperation({
    summary: 'Configuración completa de sueldos y planillas',
    description:
      'Todo el panel en una llamada: `parametros`, `conceptos` (descuentos laborales y aportes patronales, activos e inactivos), `beneficios` (lactancia, natalidad...), `escalas.bonoAntiguedad`, `escalas.vacacion`, `escalas.atraso`, `tiposContrato` (con sus conceptos por defecto) y `horarios` (con sus días).',
  })
  @ApiOkResponse({ description: 'Configuración obtenida correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async configuracion() {
    return await this.planillaConfigService.configuracion();
  }

  // ------------------------------------------------------ datos del empleador
  @Get('planilla/empleador')
  @Auth()
  @ApiOperation({
    summary: 'Datos del empleador',
    description: 'Razón social, NIT, RUEX, NIM, N° de empleador (Ministerio de Trabajo y CNS) y representante legal: cabecera y pie de la planilla de sueldos.',
  })
  @ApiOkResponse({ description: 'Datos obtenidos correctamente.' })
  async datosEmpleador() {
    return await this.planillaConfigService.datosEmpleador();
  }

  @Post('planilla/empleador')
  @Auth(...RolesModules.configuraciones)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Guardar los datos del empleador', description: 'Se guarda en mayúsculas; los campos vacíos quedan en null.' })
  @ApiBody({ type: GuardarDatosEmpleadorDto })
  @ApiOkResponse({ description: 'Datos guardados.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  async guardarDatosEmpleador(@Body() body: GuardarDatosEmpleadorDto, @GetUser() user: Usuario) {
    return await this.planillaConfigService.guardarDatosEmpleador(body, user);
  }

  // -------------------------------------------------------------- parámetros
  @Get('planilla/parametros')
  @Auth()
  @ApiOperation({ summary: 'Listar parámetros de planilla (salario mínimo, recargos...)' })
  @ApiOkResponse({ description: 'Parámetros obtenidos correctamente.' })
  async listarParametros() {
    return await this.planillaConfigService.listarParametros();
  }

  @Post('planilla/parametros')
  @Auth(...RolesModules.configuraciones)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambiar valores de parámetros de planilla',
    description:
      'Solo cambia el `valor` de los parámetros indicados por `codigo` (los códigos los define el sistema). Devuelve la lista completa.',
  })
  @ApiBody({
    type: GuardarParametrosPlanillaDto,
    examples: {
      salarioMinimo: {
        summary: 'Nuevo salario mínimo',
        value: { parametros: [{ codigo: 'SALARIO_MINIMO_NACIONAL', valor: 3300 }] },
      },
    },
  })
  @ApiOkResponse({ description: 'Parámetros actualizados.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  @ApiNotFoundResponse({ description: 'Algún código no existe.' })
  async guardarParametros(
    @Body() body: GuardarParametrosPlanillaDto,
    @GetUser() user: Usuario,
  ) {
    return await this.planillaConfigService.guardarParametros(body, user);
  }

  // ------------------------------------------------- descuentos y aportes
  @Get('planilla/conceptos')
  @Auth()
  @ApiOperation({
    summary: 'Listar descuentos y aportes (activos e inactivos)',
    description:
      'DESCUENTO_LABORAL: se descuenta al trabajador. APORTE_PATRONAL: lo paga la empresa. monto = max(0, totalGanado - montoDesde) * porcentaje / 100.',
  })
  @ApiOkResponse({ description: 'Conceptos obtenidos correctamente.' })
  async listarConceptos() {
    return await this.planillaConfigService.listarConceptos();
  }

  @Post('planilla/conceptos')
  @Auth(...RolesModules.configuraciones)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un descuento / aporte',
    description: 'Sin `id` registra uno nuevo; con `id` lo actualiza. Código y entidad se guardan en mayúsculas.',
  })
  @ApiBody({
    type: GuardarConceptoPlanillaDto,
    examples: {
      crear: {
        summary: 'Nuevo aporte patronal',
        value: {
          codigo: 'APORTE_MINERO_SOLIDARIO',
          nombre: 'Aporte patronal minero solidario',
          tipo: 'APORTE_PATRONAL',
          entidad: 'GESTORA',
          porcentaje: 2,
          montoDesde: 0,
          orden: 150,
        },
      },
      actualizar: {
        summary: 'Cambiar el porcentaje',
        value: {
          id: 8,
          codigo: 'CNS_SALUD',
          nombre: 'Caja Nacional de Salud',
          tipo: 'APORTE_PATRONAL',
          entidad: 'CNS',
          porcentaje: 10,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Concepto guardado.' })
  @ApiConflictResponse({ description: 'Código repetido.' })
  @ApiNotFoundResponse({ description: 'No existe el concepto (al actualizar).' })
  async guardarConcepto(
    @Body() body: GuardarConceptoPlanillaDto,
    @GetUser() user: Usuario,
  ) {
    return await this.planillaConfigService.guardarConcepto(body, user);
  }

  @Patch('planilla/conceptos/cambiar_estado/:id')
  @Auth(...RolesModules.configuraciones)
  @ApiOperation({
    summary: 'Activar / desactivar un descuento o aporte',
    description: 'Un concepto inactivo deja de calcularse en las boletas nuevas aunque la persona lo tenga marcado.',
  })
  @ApiParam({ name: 'id', example: 11 })
  @ApiBody(ESTADO_BODY)
  @ApiOkResponse({ description: 'Estado actualizado.' })
  async cambiarEstadoConcepto(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
    return await this.planillaConfigService.cambiarEstadoConcepto(id, activo, user);
  }

  // ---------------------------------------------- beneficios (lactancia...)
  @Get('planilla/beneficios')
  @Auth()
  @ApiOperation({
    summary: 'Listar beneficios (activos e inactivos)',
    description:
      'Bonos extra que se pagan en la boleta de sueldo durante `meses` meses (lactancia, natalidad...). Importe mensual = `porcentaje` % del salario mensual de la persona, o el `monto` fijo si no hay porcentaje.',
  })
  @ApiOkResponse({ description: 'Beneficios obtenidos correctamente.' })
  async listarBeneficios() {
    return await this.planillaConfigService.listarBeneficios();
  }

  @Post('planilla/beneficios')
  @Auth(...RolesModules.configuraciones)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un beneficio',
    description:
      'Sin `id` registra uno nuevo; con `id` lo actualiza. Va `porcentaje` o `monto`, uno de los dos. Son los valores por defecto: al asignarlo a una persona se copian y ahí se pueden cambiar; cambiar el catálogo no modifica lo ya asignado.',
  })
  @ApiBody({
    type: GuardarBeneficioPlanillaDto,
    examples: {
      porcentaje: {
        summary: 'Lactancia: 100% del salario por 12 meses',
        value: { nombre: 'SUBSIDIO DE LACTANCIA', porcentaje: 100, monto: null, meses: 12, cotiza: false },
      },
      monto: {
        summary: 'Monto fijo por 1 mes',
        value: { nombre: 'BONO POR MATRIMONIO', porcentaje: null, monto: 500, meses: 1 },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Beneficio guardado.' })
  @ApiBadRequestResponse({ description: 'Falta el porcentaje o el monto, o vinieron los dos.' })
  @ApiConflictResponse({ description: 'Nombre repetido.' })
  @ApiNotFoundResponse({ description: 'No existe el beneficio (al actualizar).' })
  async guardarBeneficio(@Body() body: GuardarBeneficioPlanillaDto, @GetUser() user: Usuario) {
    return await this.planillaConfigService.guardarBeneficio(body, user);
  }

  @Patch('planilla/beneficios/cambiar_estado/:id')
  @Auth(...RolesModules.configuraciones)
  @ApiOperation({
    summary: 'Activar / desactivar un beneficio',
    description: 'Un beneficio inactivo ya no se puede asignar; lo ya asignado a las personas se sigue pagando.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody(ESTADO_BODY)
  @ApiOkResponse({ description: 'Estado actualizado.' })
  async cambiarEstadoBeneficio(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
    return await this.planillaConfigService.cambiarEstadoBeneficio(id, activo, user);
  }

  // --------------------------------------------------------------- escalas
  @Get('planilla/escalas')
  @Auth()
  @ApiOperation({
    summary: 'Escala por años de antigüedad',
    description: 'BONO_ANTIGUEDAD: valor = %. VACACION: valor = días hábiles por año. Años cumplidos, ambos extremos inclusive.',
  })
  @ApiQuery({ name: 'tipo', enum: ['BONO_ANTIGUEDAD', 'VACACION', 'ATRASO'] })
  @ApiOkResponse({ description: 'Tramos obtenidos correctamente.' })
  async listarEscala(@Query('tipo') tipo: TipoEscalaPlanilla) {
    return await this.planillaConfigService.listarEscala(
      tipo === 'VACACION' || tipo === 'ATRASO' ? tipo : 'BONO_ANTIGUEDAD',
    );
  }

  @Post('planilla/escalas')
  @Auth(...RolesModules.configuraciones)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Guardar la escala completa (reemplaza todos los tramos del tipo)',
  })
  @ApiBody({
    type: GuardarEscalaPlanillaDto,
    examples: {
      bono: {
        summary: 'Bono de antigüedad',
        value: {
          tipo: 'BONO_ANTIGUEDAD',
          tramos: [
            { aniosDesde: 2, aniosHasta: 4, valor: 5 },
            { aniosDesde: 5, aniosHasta: 7, valor: 11 },
            { aniosDesde: 8, aniosHasta: 10, valor: 18 },
            { aniosDesde: 11, aniosHasta: 14, valor: 26 },
            { aniosDesde: 15, aniosHasta: 19, valor: 34 },
            { aniosDesde: 20, aniosHasta: 24, valor: 42 },
            { aniosDesde: 25, aniosHasta: null, valor: 50 },
          ],
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Escala guardada.' })
  @ApiBadRequestResponse({ description: 'Tramos superpuestos o inválidos.' })
  async guardarEscala(
    @Body() body: GuardarEscalaPlanillaDto,
    @GetUser() user: Usuario,
  ) {
    return await this.planillaConfigService.guardarEscala(body, user);
  }

  // --------------------------------------------------- horarios de trabajo
  @Get('horario-trabajo')
  @Auth()
  @ApiOperation({
    summary: 'Listar horarios de trabajo (activos e inactivos)',
    description:
      'Cada horario con sus `dias` (1 = lunes ... 7 = domingo) y las 4 horas. Un día sin almuerzo es horario continuo. Un horario de temporada (invierno) trae `idHorarioReemplaza` y su vigencia.',
  })
  @ApiOkResponse({ description: 'Horarios obtenidos correctamente.' })
  async listarHorarios() {
    return await this.planillaConfigService.listarHorarios();
  }

  @Post('horario-trabajo')
  @Auth(...RolesModules.configuraciones)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un horario de trabajo',
    description:
      'Sin `id` registra; con `id` actualiza. `dias` reemplaza todos los días (los que no figuran son no laborables). Horario de invierno: `idHorarioReemplaza` (el horario base) + `vigenciaDesde` / `vigenciaHasta`; en ese rango se usa en lugar del base para todas las personas que lo tienen.',
  })
  @ApiBody({
    type: GuardarHorarioTrabajoDto,
    examples: {
      discontinuo: {
        summary: 'Discontinuo lunes a viernes + sábado medio día',
        value: {
          descripcion: 'OFICINA DISCONTINUO',
          dias: [
            ...[1, 2, 3, 4, 5].map((d) => ({ diaSemana: d, horaIngreso: '08:30', horaSalidaAlmuerzo: '12:30', horaRetornoAlmuerzo: '14:30', horaSalida: '18:30' })),
            { diaSemana: 6, horaIngreso: '08:30', horaSalida: '12:30' },
          ],
        },
      },
      invierno: {
        summary: 'Horario de invierno (continuo) que reemplaza al discontinuo',
        value: {
          descripcion: 'INVIERNO 2026',
          idHorarioReemplaza: 1,
          vigenciaDesde: '2026-07-01',
          vigenciaHasta: '2026-07-31',
          dias: [1, 2, 3, 4, 5].map((d) => ({ diaSemana: d, horaIngreso: '09:00', horaSalida: '17:00' })),
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Horario guardado.' })
  @ApiBadRequestResponse({ description: 'Horas fuera de orden, almuerzo incompleto o vigencia inválida.' })
  @ApiConflictResponse({ description: 'Descripción repetida.' })
  async guardarHorario(@Body() body: GuardarHorarioTrabajoDto, @GetUser() user: Usuario) {
    return await this.planillaConfigService.guardarHorario(body, user);
  }

  @Patch('horario-trabajo/cambiar_estado/:id')
  @Auth(...RolesModules.configuraciones)
  @ApiOperation({ summary: 'Activar / desactivar un horario de trabajo' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody(ESTADO_BODY)
  @ApiOkResponse({ description: 'Estado actualizado.' })
  async cambiarEstadoHorario(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
    return await this.planillaConfigService.cambiarEstadoHorario(id, activo, user);
  }

  // ---------------------------------------------------- tipos de contrato
  @Get('tipo-contrato')
  @Auth()
  @ApiOperation({
    summary: 'Listar tipos de contrato (activos e inactivos)',
    description: 'Cada uno con sus checks por defecto y `conceptos` (descuentos/aportes que le corresponden por defecto).',
  })
  @ApiOkResponse({ description: 'Tipos de contrato obtenidos correctamente.' })
  async listarTiposContrato() {
    return await this.planillaConfigService.listarTiposContrato();
  }

  @Post('tipo-contrato')
  @Auth(...RolesModules.configuraciones)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o actualizar un tipo de contrato',
    description:
      'Sin `id` registra; con `id` actualiza. `idsConceptos` reemplaza la lista de descuentos/aportes por defecto (si se omite, no se toca). Cambiar un tipo de contrato NO cambia a las personas ya configuradas: los valores por defecto se copian solo al asignarlo.',
  })
  @ApiBody({
    type: GuardarTipoContratoDto,
    examples: {
      consultor: {
        summary: 'Consultor (sin aportes ni beneficios)',
        value: {
          descripcion: 'CONSULTOR EN LÍNEA',
          aplicaBonoAntiguedad: false,
          aplicaHorasExtra: false,
          aplicaAguinaldo: false,
          aplicaVacaciones: false,
          aplicaIndemnizacion: false,
          aplicaDesahucio: false,
          idsConceptos: [],
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Tipo de contrato guardado.' })
  @ApiConflictResponse({ description: 'Descripción repetida.' })
  @ApiNotFoundResponse({ description: 'No existe el tipo de contrato o algún concepto.' })
  async guardarTipoContrato(
    @Body() body: GuardarTipoContratoDto,
    @GetUser() user: Usuario,
  ) {
    return await this.planillaConfigService.guardarTipoContrato(body, user);
  }

  @Patch('tipo-contrato/cambiar_estado/:id')
  @Auth(...RolesModules.configuraciones)
  @ApiOperation({ summary: 'Activar / desactivar un tipo de contrato' })
  @ApiParam({ name: 'id', example: 3 })
  @ApiBody(ESTADO_BODY)
  @ApiOkResponse({ description: 'Estado actualizado.' })
  async cambiarEstadoTipoContrato(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
    return await this.planillaConfigService.cambiarEstadoTipoContrato(id, activo, user);
  }
}
