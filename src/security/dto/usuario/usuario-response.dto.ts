import { ApiProperty } from '@nestjs/swagger';
import { Persona } from 'src/security/entities/persona.entity';

export class UsuarioResponseDto {
  @ApiProperty({ example: 'usr-123' })
  id: string;

  @ApiProperty({ example: 'jperez' })
  usuario: string;

  @ApiProperty({ description: 'Rol asignado', example: 'admin' })
  rol: string; // o un objeto Rol según tu modelo

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2025-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Datos de la persona asociada',
    type: () => Persona,
  })
  persona: Persona;

  // Opcional: si quieres ocultar la contraseña (no se incluye)
}
