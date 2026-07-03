import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): any {
    return {
      author: 'Tinkuriquna',
      project: 'Tinkuriquna Integrado - Comercio Interno',
      version: '1.0.0',
      description:
        'Sistema de gestión, para la comercializacion de minerales',
      type: 'Api Rest BackEnd',
    };
  }
}
