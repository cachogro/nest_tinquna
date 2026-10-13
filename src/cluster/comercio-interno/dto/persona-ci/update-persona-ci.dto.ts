import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
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


}
