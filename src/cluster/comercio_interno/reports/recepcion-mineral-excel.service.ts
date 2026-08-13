import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ExcelService } from 'src/common/excel/excel.service';
import { ComercioInternoService } from '../services/comercio_interno.service';
import { FiltrosRegistroMineralDto } from '../dto/recepcion_mineral/filtros-registro-mineral.dto';

@Injectable()
export class RecepcionMineralExcelService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly comercioInternoService: ComercioInternoService,
  ) {}

  async generar(filtros: FiltrosRegistroMineralDto): Promise<Buffer> {
    const registros =
      await this.comercioInternoService.findAllRMReporte(filtros);

    const workbook: Workbook = this.excelService.createWorkbook();

    const worksheet = this.excelService.createWorksheet(
      workbook,
      'Recepción Mineral',
    );

    //-------------------------------------------------
    // Título
    //-------------------------------------------------

    this.excelService.addTitle(worksheet, 'REPORTE DE RECEPCIÓN DE MINERAL', 9);

    //-------------------------------------------------
    // Información
    //-------------------------------------------------

    const filaInicio = this.excelService.addInformation(worksheet, {
      'Fecha de generación': new Date().toLocaleString('es-BO'),

      'Cantidad de registros': registros.length,
    });

    //-------------------------------------------------
    // Encabezados
    //-------------------------------------------------

    this.excelService.addHeader(
      worksheet,
      [
        'ID',
        'Código / Lote',
        'Proveedor',
        'N° Sacos',
        'Peso Bruto (Kg)',
        'Anticipo',
        'Fecha y Hora',
        'Observación',
        'Estado',
      ],
      filaInicio,
    );

    //-------------------------------------------------
    // Datos
    //-------------------------------------------------

    registros.forEach((registro) => {
      this.excelService.addRow(
        worksheet,
        [
          registro.id,

          registro.codigoOperacion,

          `${registro.persona?.nombres ?? ''} ${
            registro.persona?.apellidoPaterno ?? ''
          } ${registro.persona?.apellidoMaterno ?? ''}`,

          registro.numeroSacos,

          this.formatEntero(registro.balanzaL),

          this.formatEntero(registro.anticipo),

          this.formatFechaHora(registro.fechaRecepcion),

          registro.observaciones,

          registro.estado?.nombre,
        ],
        [
          undefined,
          undefined,
          undefined,
          undefined,
          'right',
          'right',
          undefined,
          undefined,
          undefined,
        ],
      );
    });

    //-------------------------------------------------
    // Ajustar columnas
    //-------------------------------------------------

    this.excelService.autoFitColumns(
      worksheet,
      12,
      {
        1: 6,
        2: 10,
      },
      filaInicio,
    );

    return this.excelService.generate(workbook);
  }

  private formatFechaHora(fecha?: string): string {
    if (!fecha) {
      return '';
    }

    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

    if (!match) {
      return fecha;
    }

    const [, anio, mes, dia, horas, minutos] = match;

    return `${horas}:${minutos} - ${dia}-${mes}-${anio}`;
  }

  private formatEntero(valor?: number | string): number | null {
    if (valor === null || valor === undefined) {
      return null;
    }

    return Math.round(Number(valor));
  }
}
