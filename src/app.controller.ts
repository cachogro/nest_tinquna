import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Info')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('hora-servidor')
  @ApiOperation({
    summary: 'Fecha y hora del servidor',
    description:
      'Hora oficial del sistema para el reloj de la barra superior. El front la usa para corregir la hora de la PC del usuario. No requiere autenticación.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        fechaHora: '2026-10-20T19:42:10.123Z',
        epoch: 1792525330123,
        zonaHoraria: 'America/La_Paz',
      },
    },
  })
  horaServidor(): { fechaHora: string; epoch: number; zonaHoraria: string } {
    const ahora = new Date();
    return {
      fechaHora: ahora.toISOString(),
      epoch: ahora.getTime(),
      zonaHoraria: process.env.TZ ?? 'America/La_Paz',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Información general de la API',
    description:
      'Endpoint público de salud/información del backend. No requiere autenticación.',
  })
  @ApiOkResponse({
    description: 'Información de la API obtenida correctamente.',
    schema: {
      example: {
        author: 'Tinkuriquna',
        project: 'Tinkuriquna Integrado - Comercio Interno',
        version: '1.0.0',
        description:
          'Sistema de gestión, para la comercializacion de minerales',
        type: 'Api Rest BackEnd',
      },
    },
  })
  getHello(): any {
    return {
      author: 'Tinkuriquna',
      project: 'Tinkuriquna Integrado - Comercio Interno',
      version: '1.0.0',
      description: 'Sistema de gestión, para la comercializacion de minerales',
      type: 'Api Rest BackEnd',
    };
  }
}
