import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Info')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
