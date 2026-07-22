import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUsuarioDto {
  @ApiProperty({
    example: 'admin.admin',
    description: 'nombre de usuario',
  })
  @IsString()
  usuario: string;

  @ApiProperty({
    example: 'admin123',
    description: 'referencia a contraseña',
  })
  @IsString()
  @MinLength(6, {
    message: 'La contraseña debe tener almenos 6 caracteres',
  })
  @MaxLength(50, {
    message: 'La contraseña debe tener almenos 50 caracteres',
  })
  // @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
  //   message:
  //     'La contraseña debe tener una letra mayúscula, minúscula y un número',
  // })
  contrasena: string;
}
