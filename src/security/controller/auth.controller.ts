import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Headers,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../service/auth.service';
import { LoginUsuarioDto } from '../dto/auth/login-usuario.dto';
import { RefreshTokenGuard } from '../guards/refreshToken.guard';
import { Auth, GetUser, RawHeaders } from '../decorators';
import { Usuario } from '../entities/usuario.entity';

import { IncomingHttpHeaders } from 'node:http';

@ApiTags('Auth')
@Controller('auth')
@ApiBearerAuth()
export class AuthController {
  constructor(private $usuario: AuthService) {}

  @Post('login')
  @ApiResponse({
    status: 201,
    description: 'ingreso a sistema y obtencion de token',
    type: LoginUsuarioDto,
  })
  loginUser(@Body() loginUsuarioDto: LoginUsuarioDto) {
    return this.$usuario.login(loginUsuarioDto);
  }

  @Get('refresh_token')
  @UseGuards(RefreshTokenGuard)
  @ApiResponse({
    status: 200,
    description: 'Refrescar el Token',
  })
  refreshToken(@GetUser() user: Usuario) {
    return this.$usuario.getJwtTokens({ id: user.id });
  }

  @Get('check-status')
  @Auth()
  checkAuthStatus(@GetUser() user: Usuario) {
    return user;
  }

  @Get('private')
  @Auth()
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

  // @Post('update_pass')
  // @Auth()
  // @ApiResponse({
  //   status: 201,
  //   description: 'actualizar contrasena',
  // })
  // updateContrasena(
  //   @Body() updateContrasenaDto: UpdateContrasenaDto,
  //   @GetUser() user: Usuario,
  // ) {
  //   return this.$usuario.updatePassword(updateContrasenaDto, user);
  // }

  // // @UseGuards(AuthGuard('jwt'))
  // @Post('change_password')
  // @ApiResponse({
  //   status: 201,
  //   description: 'actualizar contrasena por primera vez',
  // })
  // changeContrasena(
  //   @Req() req,
  //   @Body() updateContrasenaDto: UpdateContrasenaDto,
  // ) {
  //   console.log(req.user, updateContrasenaDto);
  //   return updateContrasenaDto;
  // }
}
