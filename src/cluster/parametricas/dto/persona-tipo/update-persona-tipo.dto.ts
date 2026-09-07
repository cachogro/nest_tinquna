import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';
import { CreatePersonaTipoDto } from './create-persona-tipo.dto';

/**
 * Se usa como cuerpo único del `POST /parametricas/persona-tipo`:
 * sin `id` registra, con `id` actualiza. Al ser un solo tipo (no una unión)
 * el ValidationPipe global sí valida `codigo`, `nombre` y `descripcion`.
 */
export class UpdatePersonaTipoDto extends CreatePersonaTipoDto {
  @ApiPropertyOptional({
    example: 3,
    description:
      'Identificador del tipo de persona. Si se envía, se actualiza; si no, se crea.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador del tipo de persona no es válido.',
  })
  id?: number;
}
