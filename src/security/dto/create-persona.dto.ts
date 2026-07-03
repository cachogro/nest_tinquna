import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  IsDateString,
  Matches,
} from 'class-validator';

export class CreatePersonaDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @MinLength(1, {
    message: 'El nombre de la persona debe tener al menos 1 caracter',
  })
  nombres: string;

  @IsString()
  @ValidateIf(
    (personaDTO: CreatePersonaDto) =>
      personaDTO.apellidoMaterno ? false : true,
    {
      message: 'La persona debe tener al menos 1 apellido (paterno o materno)',
    },
  )
  @MinLength(3, {
    message: 'El apellido paterno de la persona debe tener al menos 3 caracteres',
  })
  apellidoPaterno?: string;

  @IsString()
  @ValidateIf(
    (personaDTO: CreatePersonaDto) =>
      personaDTO.apellidoPaterno ? false : true,
    {
      message: 'La persona debe tener al menos 1 apellido (paterno o materno)',
    },
  )
  @MinLength(3, {
    message: 'El apellido materno de la persona debe tener al menos 3 caracteres',
  })
  apellidoMaterno?: string;

  @IsString()
  @IsOptional()
  @MinLength(1, {
    message: 'El apellido casada de la persona debe tener al menos 1 caracter',
  })
  apellidoCasada?: string;

  @IsString()
  @IsOptional()
  @MinLength(5, {
    message: 'El celular debe tener al menos 5 caracteres',
  })
  celular?: string;

  @IsEmail(
    {},
    {
      message: 'El formato del correo electrónico no es válido',
    },
  )
  //@IsOptional()
  correoElectronico?: string;

 @Matches(/^\d{2}-\d{2}-\d{4}$/, {
    message: 'La fecha debe tener el formato exacto DD-MM-YYYY (ej. 09-09-1995)',
  })
  @IsOptional()
  fechaNacimiento?: string;

  @IsString()
  @IsOptional()
  idLugarEmisionDocumento?: string;

  @IsString()
  @IsOptional()
  idTipoDocumento?: string;

  @IsString()
 // @IsOptional()
  @MinLength(5, {
    message: 'El número de documento debe tener al menos 5 caracteres',
  })
  numeroDocumento: string;
}
