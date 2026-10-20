import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** El propio usuario cambia su contraseña desde "Mi perfil". */
export class CambiarContrasenaDto {
  @ApiProperty({ example: 'admin123', description: 'Contraseña actual' })
  @IsString()
  contrasenaActual: string;

  @ApiProperty({
    example: 'nueva2026',
    description: 'Contraseña nueva: 8 a 50 caracteres, con letras y números',
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña nueva debe tener al menos 8 caracteres' })
  @MaxLength(50, { message: 'La contraseña nueva no puede pasar de 50 caracteres' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).*$/, {
    message: 'La contraseña nueva debe tener al menos una letra y un número',
  })
  contrasenaNueva: string;
}
