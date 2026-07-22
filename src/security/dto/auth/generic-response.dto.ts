import { ApiProperty } from '@nestjs/swagger';
import { Usuario } from 'src/security/entities/usuario.entity';


export class GenericResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ example: 'Hola Mundo Private' })
  message: string;

  @ApiProperty({ type: Usuario })
  user: Usuario;

  @ApiProperty({ example: 'admin' })
  usuario: string;

  @ApiProperty({ example: ['Bearer eyJ...'] })
  rawHeaders: string[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  headers: Record<string, string>;
}