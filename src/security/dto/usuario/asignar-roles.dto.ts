import { ArrayNotEmpty, IsArray } from 'class-validator';

export class AsignarRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  roles: string[];
}