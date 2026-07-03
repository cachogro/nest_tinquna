import { ArrayNotEmpty, IsArray } from 'class-validator';

export class AsignarPermisosDto {
  @IsArray()
  @ArrayNotEmpty()
  permisos: string[];
}