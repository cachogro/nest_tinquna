import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { UsuarioService } from '../service/usuario.service';
import { Usuario } from '../entities/usuario.entity';
import { CreateUsuarioDto } from '../dto/usuario/create-usuario.dto';
import { UpdateUsuarioDto } from '../dto/usuario/update-usuario.dto';

@ApiTags('Administrador')
@Controller('administrador')
@ApiBearerAuth()
export class AdministradorController {
  constructor(
    private $usuario: UsuarioService,
    // private $trayUsers: TrayUsersService,
  ) {}

  @Post('registrar_usuario')
  @ApiHeader({
    name: 'Authorization',
    description: 'Se requiere Token de Autenticación',
    required: true,
  })
  // @Auth(ValidRoles.administrador, ...) // Comentado para pruebas
  @ApiResponse({ status: 201, description: 'crear un nuevo usuario' })
  registerUser(@Body() registerUsuarioDto: CreateUsuarioDto) {
    // Crear un usuario ficticio para pruebas (solo para el registro de auditoría)
    const user = new Usuario();
    user.usuario = 'admin_grover'; // Asignar el nombre de usuario que se usará en los campos de auditoría
    // Opcional: user.id = '1';

    return this.$usuario.create(registerUsuarioDto, user);
  }




  @Put('actualizar_usuario/:id')
  @ApiHeader({
    name: 'Authorization',
    description: 'Se requiere Token de Autenticación',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Usuario actualizado con éxito' })
  updateUser(
    @Param('id') id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    // Crear el usuario ficticio para pruebas de auditoría (igual que en tu Post)
    const user = new Usuario();
    user.usuario = 'admin_grover';

    return this.$usuario.update(id, updateUsuarioDto, user);
  }


}
