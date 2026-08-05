import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { PersonaCi } from '../entities/persona-ci.entity';

export class PersonasPaginadasDto extends PaginadoResponseDto<PersonaCi> {
  @ApiProperty({
    type: () => [PersonaCi],
  })
  declare data: PersonaCi[];
}
