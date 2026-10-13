import { ApiProperty } from '@nestjs/swagger';

export class RolMatrizDto {
  @ApiProperty({ example: '2' })
  id: string;

  @ApiProperty({ example: 'ROLE_OPERADOR' })
  codigo: string;

  @ApiProperty({ example: 'OPERADOR' })
  nombre: string;

  @ApiProperty({
    example: false,
    description:
      'El administrador tiene siempre todos los permisos y no se puede editar.',
  })
  esAdministrador: boolean;
}

export class PermisoMatrizDto {
  @ApiProperty({ example: 'contabilidad.recibos' })
  codigo: string;

  @ApiProperty({ example: 'Recibos' })
  nombre: string;

  @ApiProperty({ example: null, nullable: true })
  descripcion: string | null;

  @ApiProperty({
    example: ['ROLE_ADMINISTRADOR', 'ROLE_OPERADOR'],
    description:
      'Roles a los que se les puede otorgar el permiso (los que el back deja usar las rutas de esa pantalla).',
  })
  rolesPermitidos: string[];

  @ApiProperty({
    example: ['ROLE_ADMINISTRADOR', 'ROLE_OPERADOR'],
    description: 'Roles que hoy tienen el permiso.',
  })
  rolesAsignados: string[];
}

export class ModuloMatrizDto {
  @ApiProperty({ example: 'CONTABILIDAD' })
  modulo: string;

  @ApiProperty({ type: [PermisoMatrizDto] })
  permisos: PermisoMatrizDto[];
}

export class MatrizPermisosDto {
  @ApiProperty({ type: [RolMatrizDto] })
  roles: RolMatrizDto[];

  @ApiProperty({ type: [ModuloMatrizDto] })
  modulos: ModuloMatrizDto[];
}
