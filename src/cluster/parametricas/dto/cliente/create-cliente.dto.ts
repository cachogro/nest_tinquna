import {
  MODALIDADES_VENTA_CLIENTE,
  ModalidadVentaCliente,
} from '../../entities/cliente.entity';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClienteDto {
  @IsNotEmpty({
    message: 'El nombre es obligatorio.',
  })
  @IsString({
    message: 'El nombre debe ser una cadena de texto.',
  })
  @MaxLength(150, {
    message: 'El nombre no puede exceder los 150 caracteres.',
  })
  nombre: string;

  @IsNotEmpty({
    message: 'La dirección es obligatoria.',
  })
  @IsString({
    message: 'La dirección debe ser una cadena de texto.',
  })
  @MaxLength(250, {
    message: 'La dirección no puede exceder los 250 caracteres.',
  })
  direccion: string;

  @IsOptional()
  @IsString({
    message: 'El teléfono debe ser una cadena de texto.',
  })
  @MaxLength(30, {
    message: 'El teléfono no puede exceder los 30 caracteres.',
  })
  telefono?: string;

  @IsOptional()
  @Type(() => Number)
  @IsPositive({
    message: 'El municipio seleccionado no es válido.',
  })
  idMunicipio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsPositive({
    message: 'El tipo de cliente seleccionado no es válido.',
  })
  idTipoActorProductivoMinero?: number;

  /**
   * Cómo se le cobra: COMERCIO_INTERNO (cuenta corriente, por defecto) o
   * EXPORTACION (lote por lote).
   */
  @IsOptional()
  @IsIn(MODALIDADES_VENTA_CLIENTE, {
    message: 'La modalidad de venta debe ser COMERCIO_INTERNO o EXPORTACION.',
  })
  modalidadVenta?: ModalidadVentaCliente;

  @IsOptional()
  @IsString({
    message: 'El NIT debe ser una cadena de texto.',
  })
  @MaxLength(20, {
    message: 'El NIT no puede exceder los 20 caracteres.',
  })
  nit?: string;

  @IsOptional()
  @IsString({
    message: 'Las observaciones deben ser una cadena de texto.',
  })
  @MaxLength(255, {
    message: 'Las observaciones no pueden exceder los 255 caracteres.',
  })
  observaciones?: string;

  /**
   * Fecha de inicio de operaciones con la empresa (YYYY-MM-DD). Si el front
   * la envía vacía, el servicio la completa con la fecha actual. Para
   * migrar datos históricos del Excel, enviar la fecha real acá.
   */
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'La fecha de inicio de operaciones debe tener el formato YYYY-MM-DD.',
    },
  )
  fechaInicioOperaciones?: string;
}
