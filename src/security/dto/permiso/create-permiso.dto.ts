import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePermisoDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  modulo: string;

  @IsString()
  descripcion?: string;
}