import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * DTO para PATCH /comercio_interno/valorizacion_mineral/:id/entregado
 *
 * Endpoint dedicado exclusivamente a marcar/desmarcar si el material de la
 * valorización ya salió del ingenio. Pensado para un botón de alternado
 * (toggle) en el front.
 *
 * Solo se puede activar (entregado = true) cuando la valorización está en
 * estado PRE-VALORIZADO (2) o VALORIZADO (3).
 */
export class CambiarEntregadoValorizacionMineralDto {
  @ApiProperty({
    description:
      'Nuevo valor del campo entregado. true = el material salió del ingenio; ' +
      'false = revierte la marca.',
    example: true,
  })
  @IsBoolean()
  entregado: boolean;
}
