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

    this.excelService.addTitle(worksheet, 'REPORTE DE RECEPCIÓN DE MINERAL', 8);

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
        'Código',
        'Fecha',
        'Documento',
        'Proveedor',
        'Codificación',
        'Estado',
        'Sacos',
        'Humedad',
      ],
      filaInicio,
    );

    //-------------------------------------------------
    // Datos
    //-------------------------------------------------

    registros.forEach((registro) => {
      this.excelService.addRow(worksheet, [
        registro.codigoOperacion,

        registro.fechaRecepcion,

        registro.persona?.numeroDocumento,

        `${registro.persona?.nombres ?? ''} ${
          registro.persona?.apellidoPaterno ?? ''
        } ${registro.persona?.apellidoMaterno ?? ''}`,

        registro.codificacion?.codigo,

        registro.estado?.nombre,

        registro.numeroSacos,

        registro.humedad,
      ]);
    });

    //-------------------------------------------------
    // Ajustar columnas
    //-------------------------------------------------

    this.excelService.autoFitColumns(worksheet);

    return this.excelService.generate(workbook);
  }
}
