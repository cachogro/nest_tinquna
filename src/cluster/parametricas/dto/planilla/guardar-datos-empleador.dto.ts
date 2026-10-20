import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Datos de la empresa como empleador (cabecera y pie de la planilla de sueldos). */
export class GuardarDatosEmpleadorDto {
  @ApiProperty({ example: 'EMPRESA TINKURIQUNA MINERALS S.R.L.' })
  @IsString()
  @IsNotEmpty({ message: 'La razón social es obligatoria.' })
  @MaxLength(150)
  razonSocial: string;

  @ApiPropertyOptional({ example: '677815027', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  nit?: string | null;

  @ApiPropertyOptional({ example: '95093', nullable: true, description: 'Registro Único de Exportadores.' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ruex?: string | null;

  @ApiPropertyOptional({ example: '05-1389-04', nullable: true, description: 'Número de Identificación Minera.' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  nim?: string | null;

  @ApiPropertyOptional({ example: 'CASA MATRIZ', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sucursal?: string | null;

  @ApiPropertyOptional({ example: '0', nullable: true, description: 'N° de punto de venta.' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  puntoVenta?: string | null;

  @ApiPropertyOptional({ example: 'ZONA: SAN MARTIN, CALLE: OMISTE, NRO.: 294', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string | null;

  @ApiPropertyOptional({ example: '77456512', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string | null;

  @ApiPropertyOptional({ example: 'POTOSI', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  ciudad?: string | null;

  @ApiPropertyOptional({ example: '677815027-1', nullable: true, description: 'N° de empleador del Ministerio de Trabajo.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  numeroEmpleadorMteps?: string | null;

  @ApiPropertyOptional({ example: '01-123-4567', nullable: true, description: 'N° de empleador de la Caja Nacional de Salud.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  numeroEmpleadorCns?: string | null;

  @ApiPropertyOptional({ example: 'JHYMALIA ANDREA CALLAHUANCA CHACON', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  representanteLegal?: string | null;

  @ApiPropertyOptional({ example: '6671122', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ciRepresentanteLegal?: string | null;
}
