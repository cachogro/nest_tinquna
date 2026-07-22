import { ApiProperty } from '@nestjs/swagger';
import { Persona } from 'src/security/entities/persona.entity';
import { Rol } from 'src/security/entities/rol.entity';

export class UsuarioListadoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  usuario: string;

  @ApiProperty()
  cambioClave?: boolean;

  @ApiProperty()
  bloqueadoHasta?: Date;

  @ApiProperty()
  ultimoAcceso?: Date;

  @ApiProperty()
  activo?: boolean;

  @ApiProperty({
    type: () => Persona,
  })
  persona?: Persona;

  @ApiProperty({
    type: () => [Rol],
  })
  roles: Rol[];
}
