import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Headers,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from '../service/auth.service';
import { LoginUsuarioDto } from '../dto/auth/login-usuario.dto';
import { CambiarContrasenaDto } from '../dto/auth/cambiar-contrasena.dto';
import { RefreshTokenGuard } from '../guards/refresh-token.guard';
import { Auth, GetUser, RawHeaders } from '../decorators';
import { Usuario } from '../entities/usuario.entity';
import { extractBearerToken } from '../helpers/token.helpers';

import { IncomingHttpHeaders } from 'node:http';
import { AuthResponseDto } from '../dto/auth/auth-response.dto';
import { TokenResponseDto } from '../dto/auth/token-response.dto';
import { GenericResponseDto } from '../dto/auth/generic-response.dto';

@ApiTags('Auth')
@Controller('auth')
@ApiBearerAuth() // Indica que los endpoints protegidos usan Bearer Token
export class AuthController {
  constructor(private $usuario: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: 'Autentica un usuario y devuelve los tokens JWT.',
  })
  @ApiBody({ type: LoginUsuarioDto }) // DTO de entrada
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Ingreso exitoso, se obtienen los tokens y datos del usuario.',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Credenciales inválidas o faltantes.' })
  @ApiUnauthorizedResponse({
    description: 'Usuario no autorizado (credenciales incorrectas).',
  })
  loginUser(@Body() loginUsuarioDto: LoginUsuarioDto, @Req() request: Request) {
    return this.$usuario.login(loginUsuarioDto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('refresh_token')
  @UseGuards(RefreshTokenGuard)
  @ApiOperation({
    summary: 'Refrescar token',
    description:
      'Obtiene un nuevo par de tokens usando el refresh token (rota el refresh token: el usado queda revocado).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens renovados exitosamente.',
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token inválido, expirado o ya utilizado.',
  })
  refreshToken(@GetUser() user: Usuario, @Req() request: Request) {
    const refreshTokenActual = extractBearerToken(
      request.headers.authorization,
    );
    return this.$usuario.refrescarTokens(user, refreshTokenActual, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('logout')
  @UseGuards(RefreshTokenGuard)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description:
      'Revoca el refresh token presentado (Bearer token de refresh).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Sesión cerrada correctamente.',
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token inválido o expirado.',
  })
  logout(@GetUser() user: Usuario, @Req() request: Request) {
    const refreshTokenActual = extractBearerToken(
      request.headers.authorization,
    );
    return this.$usuario.cerrarSesion(user.id, refreshTokenActual, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Get('check-status')
  @Auth() // Protege la ruta
  @ApiOperation({
    summary: 'Verificar estado de autenticación',
    description:
      'Retorna el usuario autenticado (válido para verificar token) con sus permisos de pantalla actualizados.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usuario autenticado correctamente.',
    type: Usuario,
  })
  @ApiUnauthorizedResponse({ description: 'Token inválido o ausente.' })
  checkAuthStatus(@GetUser() user: Usuario) {
    return this.$usuario.estadoSesion(user);
  }

  @Post('cambiar_contrasena')
  @Auth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Cambiar mi contraseña',
    description:
      'El usuario autenticado cambia su contraseña (pide la actual). Cierra sus sesiones en otros equipos y devuelve tokens nuevos para la sesión actual.',
  })
  @ApiBody({ type: CambiarContrasenaDto })
  @ApiResponse({ status: HttpStatus.CREATED, type: TokenResponseDto })
  @ApiBadRequestResponse({
    description: 'Contraseña actual incorrecta o la nueva no cumple las reglas.',
  })
  cambiarContrasena(
    @GetUser() user: Usuario,
    @Body() dto: CambiarContrasenaDto,
    @Req() request: Request,
  ) {
    return this.$usuario.cambiarContrasena(user.id, dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Get('private')
  @Auth()
  @ApiOperation({
    summary: 'Ruta privada de prueba',
    description:
      'Endpoint de ejemplo que devuelve información del usuario y cabeceras.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Respuesta exitosa con datos del usuario y cabeceras.',
    type: GenericResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Token inválido o ausente.' })
  testingPrivateRoute(
    @Req() request: Request,
    @GetUser() user: Usuario,
    @GetUser('usuario') usuario: string,
    @RawHeaders() rawHeaders: string[],
    @Headers() headers: IncomingHttpHeaders,
  ) {
    return {
      ok: true,
      message: 'Hola Mundo Private',
      user,
      usuario,
      rawHeaders,
      headers,
    };
  }
}
