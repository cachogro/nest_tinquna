import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsPositive, IsString } from 'class-validator';

export class GuardarPermisosRolDto {
  @ApiProperty({ example: 2, description: 'Identificador del rol.' })
  @Type(() => Number)
  @IsPositive({ message: 'El rol no es válido.' })
  idRol: number;

  @ApiProperty({
    example: ['contabilidad.recibos', 'contabilidad.kardex'],
    description:
      'Códigos de los permisos que tendrá el rol. Se envía la lista completa: lo que no venga se le quita.',
  })
  @IsArray({ message: 'Los permisos deben enviarse en un arreglo.' })
  @ArrayUnique({ message: 'No puede repetir permisos.' })
  @IsString({ each: true, message: 'Cada permiso debe ser un código válido.' })
  permisos: string[];
}
