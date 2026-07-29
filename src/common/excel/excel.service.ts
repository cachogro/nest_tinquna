import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelService {
  /**
   * Crea un Workbook
   */
  createWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Sistema Empresarial';
    workbook.company = 'Mi Empresa';
    workbook.created = new Date();
    workbook.modified = new Date();

    return workbook;
  }

  /**
   * Crea una hoja
   */
  createWorksheet(
    workbook: ExcelJS.Workbook,
    nombre: string,
  ): ExcelJS.Worksheet {
    return workbook.addWorksheet(nombre, {
      properties: {
        defaultRowHeight: 22,
      },
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
      },
      views: [
        {
          state: 'frozen',
          ySplit: 1,
        },
      ],
    });
  }

  /**
   * Título principal
   */
  addTitle(
    worksheet: ExcelJS.Worksheet,
    titulo: string,
    totalColumnas: number,
  ): void {
    worksheet.mergeCells(1, 1, 1, totalColumnas);

    const cell = worksheet.getCell(1, 1);

    cell.value = titulo;

    cell.font = {
      bold: true,
      size: 18,
      color: {
        argb: 'FFFFFF',
      },
    };

    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: '1F4E78',
      },
    };

    worksheet.getRow(1).height = 28;
  }

  /**
   * Información debajo del título
   */
  addInformation(
    worksheet: ExcelJS.Worksheet,
    informacion: Record<string, any>,
  ): number {
    let row = 3;

    Object.entries(informacion).forEach(([key, value]) => {
      worksheet.getCell(`A${row}`).value = key;

      worksheet.getCell(`A${row}`).font = {
        bold: true,
      };

      worksheet.getCell(`B${row}`).value = value;

      row++;
    });

    return row + 1;
  }

  /**
   * Encabezado
   */
  addHeader(
    worksheet: ExcelJS.Worksheet,
    headers: string[],
    row: number,
  ): void {
    const excelRow = worksheet.getRow(row);

    excelRow.values = headers;

    excelRow.height = 24;

    excelRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: {
          argb: 'FFFFFF',
        },
      };

      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: '4472C4',
        },
      };

      cell.border = {
        top: {
          style: 'thin',
        },
        left: {
          style: 'thin',
        },
        right: {
          style: 'thin',
        },
        bottom: {
          style: 'thin',
        },
      };
    });
  }

  /**
   * Agregar una fila
   */
  addRow(
    worksheet: ExcelJS.Worksheet,
    values: any[],
  ): void {
    const row = worksheet.addRow(values);

    row.eachCell((cell) => {
      cell.border = {
        top: {
          style: 'thin',
        },
        left: {
          style: 'thin',
        },
        right: {
          style: 'thin',
        },
        bottom: {
          style: 'thin',
        },
      };

      cell.alignment = {
        vertical: 'middle',
      };
    });
  }

  /**
   * Auto ajuste de columnas
   */
  autoFitColumns(
    worksheet: ExcelJS.Worksheet,
    minWidth = 12,
  ): void {
    worksheet.columns.forEach((column) => {
      let max = minWidth;

      column.eachCell({
        includeEmpty: true,
      }, (cell) => {
        const value = cell.value
          ? cell.value.toString()
          : '';

        max = Math.max(max, value.length + 3);
      });

      column.width = max;
    });
  }

  /**
   * Devuelve el archivo como Buffer
   */
  async generate(
    workbook: ExcelJS.Workbook,
  ): Promise<Buffer> {
    return Buffer.from(
      await workbook.xlsx.writeBuffer(),
    );
  }
}