import { IntersectionType } from '@nestjs/swagger';

import { FormatoReporteDto } from '../reporte/formato-reporte.dto';
import { FiltroLibretaBancoDto } from './filtro-libreta-banco.dto';

/**
 * Filtro del reporte de la libreta de bancos: los mismos filtros del listado
 * más el formato de salida (Excel o PDF).
 */
export class FiltroLibretaBancoReporteDto extends IntersectionType(
  FiltroLibretaBancoDto,
  FormatoReporteDto,
) {}
