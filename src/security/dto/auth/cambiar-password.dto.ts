import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty()
  passwordActual: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 30)
  passwordNueva: string;
}