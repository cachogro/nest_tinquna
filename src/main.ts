process.env.TZ = 'America/La_Paz';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Configuraciones de cors para socketIo.io
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as socketIo from 'socket.io';
import { createServer } from 'http';

export class CustomIoAdapter extends IoAdapter {
  createIOServer(
    port: number,
    options?: socketIo.ServerOptions,
  ): socketIo.Server {
    const server = createServer(
      options?.serveClient !== false ? this.httpServer : undefined,
    );
    return super.createIOServer(port, options).listen(server, { ...options });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const logger = new Logger('Bootstrap');
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Tinkuriquna Integrado - Comercio Interno')
    .setDescription('End points dcomercio interno')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/V1', app, document);

  // Habilitar todas las solicitudes de CORS en Socket.IO
  app.useWebSocketAdapter(new CustomIoAdapter(app));
  app.enableCors();

  // maquina local
  //await app.listen(process.env.PORT);
  await app.listen(process.env.PORT || 3000);

  //habilitar para el escucha red local
  // await app.listen(process.env.PORT || 3000, '0.0.0.0');

  logger.log(`Aplicación lista corriendo en el puerto: ${process.env.PORT}`);
}
bootstrap();
