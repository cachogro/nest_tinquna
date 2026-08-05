import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, MaxLength } from 'class-validator';

export class CreateValorizacionCalculoAporteDto {
  @ApiProperty({
    description: 'Id de la entidad de aporte (parametrica.entidad_aporte).',
    example: 6,
  })
  @IsInt()
  idEntidadAporte: number;

  @ApiProperty({
    description: 'Tipo de base de aporte aplicado (ej. VBV, VNP, etc), según configuración de la entidad.',
    example: 'VBV',
  })
  @IsString()
  @MaxLength(10)
  tipoBaseAporte: string;

  @ApiProperty({
    description: 'Porcentaje/alícuota aplicado, calculado por el front según configuración de la entidad.',
    example: 0.35,
  })
  @IsNumber()
  porcentajeAporte: number;

  @ApiProperty({
    description: 'Base sobre la que se calculó el aporte.',
    example: 45250.5,
  })
  @IsNumber()
  baseCalculo: number;

  @ApiProperty({
    description: 'Importe en bolivianos ya calculado por el front.',
    example: 158.38,
  })
  @IsNumber()
  importeBolivianos: number;
}
