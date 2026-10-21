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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { Auth, GetUser, RoleProtected } from 'src/security/decorators';
import { RolesModules } from 'src/security/enums/valid-roles';
import { Usuario } from 'src/security/entities/usuario.entity';
import { MemorandumService } from '../services/memorandum.service';
import { MemorandumPdfService } from '../services/memorandum-pdf.service';
import {
  AnularMemorandumDto,
  CrearMemorandumDto,
  FiltroMemorandumDto,
} from '../dto/memorandum/memorandum.dto';

@ApiTags('Contabilidad - Sueldos y planillas')
@Controller('contabilidad')
@ApiBearerAuth()
@RoleProtected(...RolesModules.contabilidad)
export class MemorandumController {
  constructor(
    private readonly memorandumService: MemorandumService,
    private readonly memorandumPdfService: MemorandumPdfService,
  ) {}

  @Get('memorandum/preparar/:idPersona')
  @Auth()
  @ApiOperation({
    summary: 'Datos para armar un memorándum',
    description:
      'CITE que tendría (siguiente de la gestión de `fecha`), número de llamada sugerido (memorándums EMITIDOS previos + 1) con su ordinal, tratamiento y cargo, haber diario (salario / 30, para la sanción en días), lugar, `firmantes` (personas autorizadas con su tratamiento y cargo según sus roles) e historial con el estado del descuento (SIN_SANCION, PENDIENTE, DESCONTADO). No guarda nada.',
  })
  @ApiParam({ name: 'idPersona', example: '18' })
  @ApiQuery({ name: 'fecha', required: false, example: '2026-10-20' })
  @ApiOkResponse({ description: 'Datos obtenidos correctamente.' })
  async preparar(@Param('idPersona') idPersona: string, @Query('fecha') fecha?: string) {
    return await this.memorandumService.preparar(idPersona, fecha);
  }

  @Post('memorandum')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir un memorándum de llamada de atención',
    description:
      'Genera el CITE correlativo de la gestión. Motivo en mayúsculas. Tratamiento de destinatario y firmante desde persona_ci (o Sr./Sra. según el sexo); cargo del firmante = sus roles. Sanción DIAS: importe = salario mensual / 30 * días (o el enviado); MONTO: multa en Bs. La sanción se descuenta en la siguiente boleta de SUELDO. `numero` solo para cargar memorándums ya emitidos en papel.',
  })
  @ApiBody({
    type: CrearMemorandumDto,
    examples: {
      atencion: {
        summary: 'Solo llamada de atención',
        value: {
          idPersona: '18',
          fecha: '2026-10-20',
          motivo: 'LLEGAR TARDE A OFICINA EN HORARIOS DE TRABAJO',
          idPersonaEmisor: '7',
        },
      },
      dias: {
        summary: 'Con sanción de 1 día de haber',
        value: {
          idPersona: '18',
          fecha: '2026-10-20',
          motivo: 'MINUTOS DE RETRASO ACUMULADOS DE 00:54:00 EN EL CORTE DEL 21/09/2026 AL 20/10/2026',
          tipoSancion: 'DIAS',
          diasSancion: 1,
          idPersonaEmisor: '7',
        },
      },
      multa: {
        summary: 'Multa en bolivianos',
        value: {
          idPersona: '18',
          fecha: '2026-10-20',
          motivo: 'MAL MANEJO DE EFECTIVO Y NO REPORTARLO',
          idPersonaEmisor: '7',
          tipoSancion: 'MONTO',
          importeSancion: 10000,
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Memorándum emitido.' })
  @ApiBadRequestResponse({ description: 'Persona inactiva o externa, sanción incompleta, firmante no autorizado o sin lugar.' })
  @ApiConflictResponse({ description: 'El número indicado ya existe en la gestión.' })
  async crear(@Body() body: CrearMemorandumDto, @GetUser() user: Usuario) {
    return await this.memorandumService.crear(body, user);
  }

  @Get('memorandum')
  @Auth()
  @ApiOperation({ summary: 'Listar memorándums', description: 'Paginado; por persona, gestión y estado.' })
  @ApiOkResponse({ description: 'Listado obtenido correctamente.' })
  async listar(@Query() filtro: FiltroMemorandumDto) {
    return await this.memorandumService.listar(filtro);
  }

  @Get('memorandum/:id')
  @Auth()
  @ApiOperation({ summary: 'Obtener un memorándum' })
  @ApiParam({ name: 'id', example: '1' })
  @ApiNotFoundResponse({ description: 'No se encontró el memorándum.' })
  async buscarPorId(@Param('id') id: string) {
    return await this.memorandumService.buscarPorId(id);
  }

  @Patch('memorandum/anular/:id')
  @Auth()
  @ApiOperation({
    summary: 'Anular un memorándum',
    description: 'El CITE no se reutiliza; deja de contar para el número de llamada y su sanción ya no se descuenta. No se puede si la sanción ya se descontó en una boleta pagada. El PDF sale con sello ANULADO.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiBody({ type: AnularMemorandumDto })
  @ApiOkResponse({ description: 'Memorándum anulado.' })
  async anular(@Param('id') id: string, @Body() body: AnularMemorandumDto, @GetUser() user: Usuario) {
    return await this.memorandumService.anular(id, body, user);
  }

  @Get('memorandum/:id/pdf')
  @Auth()
  @ApiOperation({
    summary: 'PDF del memorándum (hoja carta)',
    description: 'Título, asunto, destinatario, CITE, lugar y fecha, tabla de observación y sanción, texto de cierre y firmas de quien emite y de quien recibe.',
  })
  @ApiParam({ name: 'id', example: '1' })
  @ApiOkResponse({ description: 'PDF generado correctamente.' })
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const memo = await this.memorandumService.buscarPorId(id);
    const pdf = await this.memorandumPdfService.generar(memo);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=Memorandum-${memo.gestion}-${String(memo.numero).padStart(3, '0')}.pdf`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }
}
