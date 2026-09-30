import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateDestinoGastoDto {
  @ApiProperty({
    example: 'COMBUSTIBLE GASOLINA',
    description: 'Nombre del destino del gasto.',
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @Length(3, 80, { message: 'El nombre debe tener entre 3 y 80 caracteres.' })
  nombre: string;

  @ApiProperty({
    example: true,
    description: 'TRUE = egreso (sale dinero), FALSE = ingreso (entra dinero).',
  })
  @IsBoolean({ message: 'esEgreso debe ser verdadero o falso.' })
  esEgreso: boolean;
}
