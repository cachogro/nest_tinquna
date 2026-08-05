import {
  Body,
  Controller,
  Get,
  HttpStatus,
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
  ApiHeader,
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiResponse,
  ApiParam,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiInternalServerErrorResponse,
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
import { UsuarioResponseDto } from '../dto/usuario/usuario-response.dto';
import { UsuariosPaginadosDto } from '../dto/usuario/usuario-paginacion.dto';

@ApiTags('Administrador')
@Controller('administrador')
@ApiBearerAuth()
export class AdministradorController {
  constructor(
    private $usuario: UsuarioService,
    // private $trayUsers: TrayUsersService,
  ) {}

  @Post('registrar_usuario')
  @Auth(ValidRoles.administrador)
  @ApiOperation({
    summary: 'Registrar un nuevo usuario',
    description:
      'Crea un usuario con sus datos personales, contraseña inicial y rol asignado. Solo accesible para administradores.',
  })
  @ApiCreatedResponse({
    description: 'Usuario creado exitosamente.',
    type: UsuarioResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos (validaciones fallidas).',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de autenticación ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description:
      'El usuario autenticado no tiene permisos para crear usuarios.',
  })
  registerUser(
    @Body() registerUsuarioDto: CreateUsuarioDto,
    @GetUser() user: Usuario,
  ) {
    return this.$usuario.create(registerUsuarioDto, user);
  }

  @Put('actualizar_usuario/:id')
  @Auth(ValidRoles.administrador)
  @ApiOperation({
    summary: 'Actualizar un usuario existente',
    description:
      'Actualiza parcialmente los datos de un usuario (usuario, contraseña, rol y/o persona asociada); ' +
      'solo se modifican los campos enviados en el body, por lo que basta con enviar únicamente ' +
      '"contrasena" para resetear solo la clave sin tocar el resto. Solo accesible para administradores.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario a actualizar',
    example: 'usr-123',
    required: true,
  })
  @ApiOkResponse({
    description: 'Usuario actualizado exitosamente.',
    type: UsuarioResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos (validaciones fallidas).',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de autenticación ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description:
      'El usuario autenticado no tiene permisos para actualizar este usuario.',
  })
  @ApiNotFoundResponse({
    description: 'No se encontró un usuario con el ID proporcionado.',
  })
  updateUser(
    @Param('id') id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @GetUser() user: Usuario,
  ) {
    return this.$usuario.update(id, updateUsuarioDto, user);
  }

  @Get('usuarioby_id/:id')
  @Auth(ValidRoles.administrador, ValidRoles.operador)
  @ApiOperation({
    summary: 'Obtener un usuario por ID',
    description:
      'Retorna los datos de un usuario específico, incluyendo sus roles y persona asociada. Solo accesible para administradores y operadores.',
  })
  @ApiOkResponse({
    description: 'Usuario encontrado exitosamente.',
    type: Usuario,
  })
  @ApiNotFoundResponse({
    description: 'No se encontró un usuario con el ID proporcionado.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token de autenticación ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description:
      'El usuario autenticado no tiene permisos (requiere administrador u operador).',
  })
  findUserById(@Param('id') id: string): Promise<Usuario> {
    return this.$usuario.getUserById(id);
  }

  @Get('listar_usuarios')
  @Auth()
  @ApiOperation({
    summary: 'Listado paginado de usuarios',
    description:
      'Obtiene un listado paginado de usuarios permitiendo filtrar por nombre, usuario, rol y estado.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'idRol',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'activo',
    required: false,
    type: Boolean,
  })
  @ApiOkResponse({
    description: 'Listado obtenido correctamente.',
    type: UsuariosPaginadosDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async listarUsuarios(@Query() filtros: FiltrosListarUsuariosDto) {
    return await this.$usuario.listarPaginado(filtros);
  }

  // @Patch('cambiar_estado_usuario/:id')
  // async cambiarEstadoUsuario(
  //   @Param('id') id: string,
  //   @Body('activo', ParseBoolPipe) activo: boolean, // Valida que el body contenga un booleano real
  // ) {
  //   return this.$usuario.cambiarEstado(id, activo);
  // }

  @Get('roles')
  @Auth()
  @ApiOperation({
    summary: 'Obtener todos los roles',
    description:
      'Retorna la lista de roles disponibles. Requiere autenticación.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de roles obtenida exitosamente.',
    type: [RolResponseDto], // Arreglo de DTOs
  })
  @ApiUnauthorizedResponse({
    description: 'Token de autenticación ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'El usuario autenticado no tiene permisos para ver los roles.',
  })
  findAllRoles(@GetUser() user: Usuario): Promise<RolResponseDto[]> {
    return this.$usuario.findAllRolesByAdmin(user);
  }

  //   @Patch('cambiar_estado_usuario/:id')
  //   @Auth(ValidRoles.administrador)
  //   @ApiResponse({
  //     status: 201,
  //     description: 'Servicio para cambiar de estado un usuario',
  //   })
  //   changeStateUser(
  //     @Param('id') id: string,
  //     @Body('activo', ParseBoolPipe) activo: boolean,
  //     @GetUser() user: Usuario,
  //   ) {
  //     return this.$usuario.cambiarEstadoUser(id, activo, user);
  //   }

  //   import { Patch, Param, Body, ParseBoolPipe, HttpStatus } from '@nestjs/common';
  // import { EstadoUsuarioResponseDto } from './dto/estado-usuario-response.dto';

  @Patch('cambiar_estado_usuario/:id')
  @Auth(ValidRoles.administrador)
  @ApiOperation({
    summary: 'Cambiar estado (activo/inactivo) de un usuario',
    description:
      'Permite a un administrador habilitar o deshabilitar un usuario.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario a modificar',
    example: '12345',
    type: String,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        activo: {
          type: 'boolean',
          example: true,
          description: 'Nuevo estado del usuario',
        },
      },
      required: ['activo'],
    },
  })
  @ApiOkResponse({
    description: 'Estado actualizado correctamente',
    // type: EstadoUsuarioResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'El ID o el estado proporcionado no son válidos',
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  @ApiForbiddenResponse({
    description: 'No tiene permisos para realizar esta acción',
  })
  @ApiUnauthorizedResponse({ description: 'Token inválido o ausente' })
  changeStateUser(
    @Param('id') id: string,
    @Body('activo', ParseBoolPipe) activo: boolean,
    @GetUser() user: Usuario,
  ) {
    return this.$usuario.cambiarEstadoUser(id, activo, user);
  }
}
