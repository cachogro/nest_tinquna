import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CuentaBancariaDto } from './cuenta-bancaria.dto';

export class CreateEntidadFinancieraDto {
  @ApiProperty({
    example: 'BANCO UNION',
    description: 'Nombre de la entidad financiera. Se guarda en MAYÚSCULAS.',
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(80, { message: 'El nombre no puede exceder los 80 caracteres.' })
  nombre: string;

  @ApiPropertyOptional({
    example: 'UNION S.A.',
    description:
      'Sigla como aparece en el comprobante bancario. Se guarda en MAYÚSCULAS.',
  })
  @IsOptional()
  @IsString({ message: 'La sigla debe ser una cadena de texto.' })
  @MaxLength(20, { message: 'La sigla no puede exceder los 20 caracteres.' })
  sigla?: string;

  @ApiPropertyOptional({
    description:
      'Cuentas de la entidad. Se pueden asignar desde la creación. Al actualizar: cada cuenta con id se modifica, sin id se agrega (no se borran las que no vengan).',
    type: [CuentaBancariaDto],
  })
  @IsOptional()
  @IsArray({ message: 'Las cuentas deben enviarse en un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => CuentaBancariaDto)
  cuentas?: CuentaBancariaDto[];
}
