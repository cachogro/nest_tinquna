import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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

import { Auth, GetUser, RoleProtected } from 'src/security/decorators';
import { RolesModules } from 'src/security/enums/valid-roles';
import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonalPlanillaService } from '../services/personal-planilla.service';
import {
  FiltroVacacionDto,
  GuardarPersonalPlanillaDto,
  RegistrarRetiroDto,
  RegistrarVacacionDto,
} from '../dto/personal-planilla/personal-planilla.dto';
import { FiltroAsistenciaDto, GuardarAsistenciaLoteDto } from '../dto/asistencia/asistencia.dto';
import { GuardarPersonalBeneficioDto } from '../dto/personal-planilla/personal-beneficio.dto';
import { AsistenciaService } from '../services/asistencia.service';

@ApiTags('Contabilidad - Sueldos y planillas')
@Controller('contabilidad')
@ApiBearerAuth()
@RoleProtected(...RolesModules.contabilidad)
export class PersonalPlanillaController {
  constructor(
    private readonly personalPlanillaService: PersonalPlanillaService,
    private readonly asistenciaService: AsistenciaService,
  ) {}

  @Get('personal-planilla')
  @Auth()
  @ApiOperation({
    summary: 'Personal interno con su configuración de sueldo',
    description: 'Personal activo de la empresa. `configuracion` es null si todavía no se configuró.',
  })
  @ApiOkResponse({ description: 'Listado obtenido correctamente.' })
  @ApiUnauthorizedResponse({ description: 'No autorizado.' })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor.' })
  async listar() {
    return await this.personalPlanillaService.listar();
  }

  @Get('personal-planilla/:idPersona')
  @Auth()
  @ApiOperation({
    summary: 'Configuración de sueldo de una persona',
    description:
      'Checks de lo que le corresponde, datos de planilla (cargo, NUA/CUA, matrícula CNS), TODOS los descuentos/aportes activos con `aplica` true/false, antigüedad y bono del mes, y saldo de vacaciones a hoy.',
  })
  @ApiParam({ name: 'idPersona', example: '18' })
  @ApiOkResponse({ description: 'Configuración obtenida correctamente.' })
  @ApiBadRequestResponse({ description: 'La persona no es personal de la empresa o está inactiva.' })
  @ApiNotFoundResponse({ description: 'No se encontró la persona.' })
  async obtener(@Param('idPersona') idPersona: string) {
    return await this.personalPlanillaService.obtener(idPersona);
  }

  // ------------------------------------------------------------------ retiro
  @Post('personal-planilla/:idPersona/retiro')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar el retiro de una persona (despido, renuncia...)',
    description:
      'Guarda el último día trabajado (`fechaFinLabores`) y el motivo. Admite fecha pasada (baja acordada días después). La persona sigue activa: su boleta de sueldo y la planilla para firmas cortan los días en esa fecha, y después se le paga el finiquito. Rechaza si ya hay una boleta de sueldo pagada que empieza después del retiro; si una boleta pagada cubre días posteriores, lo avisa en `avisos`. Devuelve lo mismo que GET personal-planilla/:idPersona más `avisos`.',
  })
  @ApiParam({ name: 'idPersona', example: '18' })
  @ApiBody({
    type: RegistrarRetiroDto,
    examples: {
      despido: { summary: 'Despido a medio mes', value: { fechaRetiro: '2026-10-15', motivoRetiro: 'DESPIDO' } },
      acordado: {
        summary: 'Renuncia acordada después',
        value: { fechaRetiro: '2026-10-10', motivoRetiro: 'RENUNCIA', observacion: 'ACORDADO EL 31/10' },
      },
    },
  })
  @ApiOkResponse({ description: 'Retiro registrado.' })
  @ApiBadRequestResponse({ description: 'Fecha anterior al ingreso o a una boleta de sueldo ya pagada.' })
  async registrarRetiro(
    @Param('idPersona') idPersona: string,
    @Body() body: RegistrarRetiroDto,
    @GetUser() user: Usuario,
  ) {
    return await this.personalPlanillaService.registrarRetiro(idPersona, body, user);
  }

  @Delete('personal-planilla/:idPersona/retiro')
  @Auth()
  @ApiOperation({
    summary: 'Anular el retiro de una persona',
    description: 'Borra la fecha y el motivo del retiro (reincorporación o error). No se puede si ya se le pagó el finiquito.',
  })
  @ApiParam({ name: 'idPersona', example: '18' })
  @ApiOkResponse({ description: 'Retiro anulado.' })
  @ApiBadRequestResponse({ description: 'No tiene retiro registrado o ya tiene finiquito pagado.' })
  async anularRetiro(@Param('idPersona') idPersona: string, @GetUser() user: Usuario) {
    return await this.personalPlanillaService.anularRetiro(idPersona, user);
  }

  @Post('personal-planilla')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Guardar la configuración de sueldo de una persona',
    description:
      'Crea o actualiza (una por persona). Al crear, los checks e idsConceptos omitidos se copian del tipo de contrato. Al actualizar, lo omitido no cambia; `usarDefectosContrato: true` vuelve a copiar todo del tipo de contrato. Devuelve lo mismo que GET personal-planilla/:idPersona.',
  })
  @ApiBody({
    type: GuardarPersonalPlanillaDto,
    examples: {
      porContrato: {
        summary: 'Asignar contrato y copiar sus valores por defecto',
        value: { idPersona: '18', idTipoContrato: 1, cargo: 'CONTADOR', nuaCua: '41234567', matriculaCns: '85-0412-ABC' },
      },
      aMano: {
        summary: 'Marcar a mano qué le corresponde',
        value: {
          idPersona: '18',
          aplicaBonoAntiguedad: true,
          aplicaHorasExtra: false,
          aplicaAguinaldo: true,
          aplicaVacaciones: true,
          aplicaIndemnizacion: true,
          aplicaDesahucio: false,
          idsConceptos: [1, 2, 3, 4, 8, 9, 10, 11],
        },
      },
      consultor: {
        summary: 'Consultor: sin aportes ni beneficios',
        value: { idPersona: '25', idTipoContrato: 3, usarDefectosContrato: true },
      },
    },
  })
  @ApiOkResponse({ description: 'Configuración guardada.' })
  @ApiNotFoundResponse({ description: 'No existe la persona, el tipo de contrato o algún concepto.' })
  async guardar(@Body() body: GuardarPersonalPlanillaDto, @GetUser() user: Usuario) {
    return await this.personalPlanillaService.guardar(body, user);
  }

  // -------------------------------------------------------------- asistencia
  @Get('asistencia/:idPersona')
  @Auth()
  @ApiOperation({
    summary: 'Asistencia de una persona en un rango de fechas',
    description:
      'Todos los días del rango con el horario que rige (incluido el de temporada, ej. invierno), las marcaciones registradas, `minutosAtraso` / `minutosSalidaAnticipada` (cada uno cuenta solo si supera la tolerancia de paramétricas) y `marcasFaltantes`. `resumen` suma solo los días NO justificados.',
  })
  @ApiParam({ name: 'idPersona', example: '3' })
  @ApiOkResponse({ description: 'Asistencia obtenida correctamente.' })
  async asistencia(@Param('idPersona') idPersona: string, @Query() q: FiltroAsistenciaDto) {
    return await this.asistenciaService.listar(idPersona, q.desde.slice(0, 10), q.hasta.slice(0, 10));
  }

  @Post('asistencia/lote')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar o actualizar marcaciones (varios días)',
    description:
      'Solo para personas con control de asistencia. Un registro por fecha: las 4 horas (opcionales, HH:MM), `falta` (faltó todo el día) y `justificado` + `justificacion` (ese día no se descuenta). Un día sin marcas, falta ni justificación se borra. Devuelve la asistencia del rango guardado.',
  })
  @ApiBody({
    type: GuardarAsistenciaLoteDto,
    examples: {
      semana: {
        value: {
          idPersona: '3',
          registros: [
            { fecha: '2026-10-13', horaIngreso: '08:42', horaSalidaAlmuerzo: '12:30', horaRetornoAlmuerzo: '14:30', horaSalida: '18:30' },
            { fecha: '2026-10-14', falta: true, justificado: true, justificacion: 'CERTIFICADO MÉDICO' },
          ],
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Marcaciones guardadas.' })
  @ApiBadRequestResponse({ description: 'La persona no controla asistencia, horas inválidas o fechas repetidas.' })
  async guardarAsistencia(@Body() body: GuardarAsistenciaLoteDto, @GetUser() user: Usuario) {
    return await this.asistenciaService.guardarLote(body, user);
  }

  // ------------------------------------------- beneficios (lactancia...)
  @Get('personal-beneficio/:idPersona')
  @Auth()
  @ApiOperation({
    summary: 'Beneficios asignados a la persona',
    description:
      'Lactancia, natalidad... con su rango de meses (`fechaInicio` a `fechaFin`), importe mensual a hoy, cuotas pagadas (boletas PAGADAS) y `estado`: POR_INICIAR | VIGENTE | CONCLUIDO | ANULADO.',
  })
  @ApiParam({ name: 'idPersona', example: '18' })
  @ApiOkResponse({ description: 'Beneficios obtenidos correctamente.' })
  async beneficios(@Param('idPersona') idPersona: string) {
    return await this.personalPlanillaService.beneficios(idPersona);
  }

  @Post('personal-beneficio')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Asignar o actualizar un beneficio de la persona',
    description:
      'Sin `id` asigna: lo que no se envíe (meses, porcentaje/monto, base, cotiza) se copia del catálogo. Con `id` actualiza. Se paga una cuota completa en cada boleta de SUELDO cuyo mes (fecha hasta) esté en el rango. Con cuotas ya pagadas no se cambia el beneficio ni el mes de inicio. Devuelve la lista actualizada.',
  })
  @ApiBody({
    type: GuardarPersonalBeneficioDto,
    examples: {
      lactancia: {
        summary: 'Lactancia desde noviembre, valores del catálogo',
        value: { idPersona: '18', idBeneficioPlanilla: 1, fechaInicio: '2026-11-01', observaciones: 'HIJA NACIDA EL 28/10/2026' },
      },
      montoPropio: {
        summary: 'Con monto fijo propio por 6 meses',
        value: { idPersona: '18', idBeneficioPlanilla: 3, fechaInicio: '2026-11-01', meses: 6, porcentaje: null, monto: 400 },
      },
    },
  })
  @ApiOkResponse({ description: 'Beneficio guardado.' })
  async guardarBeneficio(@Body() body: GuardarPersonalBeneficioDto, @GetUser() user: Usuario) {
    return await this.personalPlanillaService.guardarBeneficio(body, user);
  }

  @Patch('personal-beneficio/anular/:id')
  @Auth()
  @ApiOperation({
    summary: 'Anular un beneficio de la persona',
    description: 'Deja de pagarse desde la próxima boleta; las cuotas ya pagadas quedan en sus boletas.',
  })
  @ApiParam({ name: 'id', example: '3' })
  @ApiOkResponse({ description: 'Beneficio anulado; devuelve la lista actualizada.' })
  async anularBeneficio(@Param('id') id: string, @GetUser() user: Usuario) {
    return await this.personalPlanillaService.anularBeneficio(id, user);
  }

  // -------------------------------------------------------------- vacaciones
  @Get('vacacion/:idPersona')
  @Auth()
  @ApiOperation({
    summary: 'Saldo y movimientos de vacaciones',
    description:
      'saldo = ganados (escala VACACION por cada año cumplido) + ajustes - tomadas - pagadas. `proporcionalAnioEnCurso` = días del año que corre (lo usa el finiquito).',
  })
  @ApiParam({ name: 'idPersona', example: '18' })
  @ApiOkResponse({ description: 'Saldo obtenido correctamente.' })
  async vacaciones(@Param('idPersona') idPersona: string, @Query() q: FiltroVacacionDto) {
    return await this.personalPlanillaService.vacaciones(idPersona, q.fecha);
  }

  @Post('vacacion')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar vacación tomada o ajuste de saldo',
    description: 'Solo si la persona tiene el check aplicaVacaciones. Devuelve el saldo actualizado.',
  })
  @ApiBody({
    type: RegistrarVacacionDto,
    examples: {
      tomada: {
        summary: 'Salió 10 días',
        value: { idPersona: '18', tipo: 'TOMADA', fechaDesde: '2026-11-02', fechaHasta: '2026-11-13', dias: 10 },
      },
      saldoInicial: {
        summary: 'Saldo que ya traía antes del sistema',
        value: { idPersona: '18', tipo: 'AJUSTE', fechaDesde: '2026-10-14', dias: -15, observaciones: 'YA TOMÓ LA GESTIÓN 2025' },
      },
    },
  })
  @ApiOkResponse({ description: 'Vacación registrada.' })
  async registrarVacacion(@Body() body: RegistrarVacacionDto, @GetUser() user: Usuario) {
    return await this.personalPlanillaService.registrarVacacion(body, user);
  }

  @Patch('vacacion/anular/:id')
  @Auth()
  @ApiOperation({ summary: 'Anular un registro de vacación (TOMADA o AJUSTE)' })
  @ApiParam({ name: 'id', example: '4' })
  @ApiOkResponse({ description: 'Registro anulado; devuelve el saldo actualizado.' })
  async anularVacacion(@Param('id') id: string, @GetUser() user: Usuario) {
    return await this.personalPlanillaService.anularVacacion(id, user);
  }
}
