import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
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
import { Auth, GetUser } from '../decorators';
import { ValidRoles } from '../models/interfaces/valid-roles';
import { Rol } from '../entities/rol.entity';
import { RolResponseDto } from '../dto/roles-response.dto';
import { FiltrosListarUsuariosDto } from '../dto/filtros-listar-usuarios.dto';


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

  @Get('usuarioby_id/:id')
  @Auth(ValidRoles.administrador, ValidRoles.operador)
  @ApiResponse({
    status: 201,
    description: 'Obtener todos los roles existentes',
  })
  findUserById(@Param('id') id: string): Promise<Usuario> {
    return this.$usuario.getUserById(id);
  }

  @Get('listar_usuarios')
    async listarUsuarios(@Query() filtros: FiltrosListarUsuariosDto) {
    return this.$usuario.listarPaginado(filtros);
  }


  // @Patch('cambiar_estado_usuario/:id')
  // async cambiarEstadoUsuario(
  //   @Param('id') id: string,
  //   @Body('activo', ParseBoolPipe) activo: boolean, // Valida que el body contenga un booleano real
  // ) {
  //   return this.$usuario.cambiarEstado(id, activo);
  // }

  @Get('roles')
  @Auth(ValidRoles.administrador, ValidRoles.operador)
  @ApiResponse({
    status: 201,
    description: 'Obtener todos los roles existentes',
  })
  findAllRoles(@GetUser() user: Usuario): Promise<RolResponseDto[]> {
    return this.$usuario.findAllRolesByAdmin(user);
  }


  
  @Patch('cambiar_estado_usuario/:id')
  @Auth(ValidRoles.administrador)
  @ApiResponse({
    status: 201,
    description: 'Servicio para cambiar de estado un usuario',
  })
  changeStateUser(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
    return this.$usuario.cambiarEstadoUser(id, activo, user);
  }
}
