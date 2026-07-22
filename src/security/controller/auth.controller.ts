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

import { AuthGuard } from '@nestjs/passport';

import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from '../service/auth.service';
import { LoginUsuarioDto } from '../dto/auth/login-usuario.dto';
import { RefreshTokenGuard } from '../guards/refreshToken.guard';
import { Auth, GetUser, RawHeaders } from '../decorators';
import { Usuario } from '../entities/usuario.entity';

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
  @ApiOperation({ summary: 'Iniciar sesión', description: 'Autentica un usuario y devuelve los tokens JWT.' })
  @ApiBody({ type: LoginUsuarioDto }) // DTO de entrada
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Ingreso exitoso, se obtienen los tokens y datos del usuario.',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Credenciales inválidas o faltantes.' })
  @ApiUnauthorizedResponse({ description: 'Usuario no autorizado (credenciales incorrectas).' })
  loginUser(@Body() loginUsuarioDto: LoginUsuarioDto) {
    return this.$usuario.login(loginUsuarioDto);
  }

  @Post('refresh_token')
  @UseGuards(RefreshTokenGuard)
  @ApiOperation({ summary: 'Refrescar token', description: 'Obtiene un nuevo par de tokens usando el refresh token.' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens renovados exitosamente.',
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token inválido o expirado.' })
  refreshToken(@GetUser() user: Usuario) {
    return this.$usuario.getJwtTokens({ id: user.id });
  }

  @Get('check-status')
  @Auth() // Protege la ruta
  @ApiOperation({ summary: 'Verificar estado de autenticación', description: 'Retorna el usuario autenticado (válido para verificar token).' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usuario autenticado correctamente.',
    type: Usuario,
  })
  @ApiUnauthorizedResponse({ description: 'Token inválido o ausente.' })
  checkAuthStatus(@GetUser() user: Usuario) {
    return user;
  }

  @Get('private')
  @Auth()
  @ApiOperation({ summary: 'Ruta privada de prueba', description: 'Endpoint de ejemplo que devuelve información del usuario y cabeceras.' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Respuesta exitosa con datos del usuario y cabeceras.',
    type: GenericResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Token inválido o ausente.' })
  testingPrivateRoute(
    @Req() request: Express.Request,
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