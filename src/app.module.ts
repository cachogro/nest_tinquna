import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SecurityModule } from './security/security.module';
import { CommonModule } from './common/common.module';
import { ClusterModule } from './cluster/cluster.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forRoot({
      name: 'ci',
      type: 'postgres',
      host: process.env.CI_HOST,
      port: +(process.env.CI_PORT || 5432),
      database: process.env.CI_NAME,
      username: process.env.CI_USERNAME,
      password: process.env.CI_PASSWORD,
      autoLoadEntities: true,
      synchronize: false,
    }),
    SecurityModule,
    CommonModule,
    ClusterModule,
    ConfigModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
