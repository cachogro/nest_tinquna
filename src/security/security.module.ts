import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Persona } from './entities/persona.entity';
import { Usuario } from './entities/usuario.entity';
import { Rol } from './entities/rol.entity';
import { UsuarioRol } from './entities/usuario-rol.entity';
import { PersonaService } from './service/persona.service';
import { Permiso } from './entities/permiso.entity';
import { RolPermiso } from './entities/rol-permiso.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AdministradorController } from './controller/admin.controller';
import { UsuarioService } from './service/usuario.service';
import { AuthController } from './controller/auth.controller';

import { AuthService } from './service/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refreshToken.strategy';

@Module({
  controllers: [AdministradorController, AuthController],
  providers: [
    PersonaService,
    UsuarioService,
    AuthService,
    JwtStrategy,
    RefreshTokenStrategy,
  ],
  imports: [
    ConfigModule,
    HttpModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get('JWT_SECRET'),
          signOptions: {
            expiresIn: configService.get('JWT_EXPIRATION'),
          },
        };
      },
    }),
    TypeOrmModule.forFeature(
      [Persona, Usuario, Rol, UsuarioRol, Permiso, RolPermiso, RefreshToken],
      'ci',
    ),
    //forwardRef(() => ),
  ],

  exports: [
    TypeOrmModule,
    JwtStrategy,
    PassportModule,
    JwtModule,
    AuthService,
    UsuarioService,
  ],
})
export class SecurityModule {}
