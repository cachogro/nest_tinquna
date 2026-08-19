import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

/**
 * DTO para el ÚNICO propósito de crear el borrador (BORRADOR) inicial
 * de una valorización de mineral.
 *
 * En esta primera etapa SOLO se registra la relación con la recepción
 * de mineral. Todo lo demás (laboratorio, pesos, económicos, detalles,
 * aportes) se completa después mediante:
 *   PATCH /comercio_interno/valorizacion_mineral/:id
 */
export class CreateValorizacionMineralDto {
  @ApiProperty({
    description:
      'Id de la recepción de mineral que se va a valorizar. Debe estar en estado APROBADO (2) o REMUESTREO (6).',
    example: 30,
  })
  @IsInt()
  idRecepcionMineral: number;
}
