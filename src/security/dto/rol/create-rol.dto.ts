import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRolDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}