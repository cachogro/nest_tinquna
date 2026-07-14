import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CreatePersonaCiDto } from './create-persona-ci.dto';

export class UpdatePersonaCiDto extends CreatePersonaCiDto {
  @ApiPropertyOptional({
    description: 'Identificador de la persona.',
    example: '15',
  })
  @IsOptional()
  @IsString()
  id?: string;


  // @ApiProperty({
  //   description: 'Nombre(s) de la persona.',
  //   example: 'JUAN',
  // })
  // @IsString()
  // @IsOptional()
  // @MinLength(2, {
  //   message: 'El nombre debe tener al menos 2 caracteres.',
  // })
  // @MaxLength(100)
  // nombres: string;
}
