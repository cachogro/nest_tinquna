import { Injectable } from '@nestjs/common';
import { Usuario } from 'src/security/entities/usuario.entity';
import { FiltroCajaFlujoExcelDto } from '../dto/movimiento-caja/filtro-caja-flujo-excel.dto';
import {
  ColumnaContable,
  ContabilidadExcelService,
  MESES,
  PALETAS,
} from './contabilidad-excel.service';
import { MovimientoCajaService } from './movimiento-caja.service';

/**
 * Genera el Excel provisional de la caja de flujo (hoja "CAJA DE FLUJO" del
 * modelo "caja de flujo y kardex.xlsx"), sin las columnas de bancos por
 * ahora: solo los registros de ingreso/egreso en efectivo de la moneda
 * pedida.
 */
@Injectable()
export class CajaFlujoExcelService {
  constructor(
    private readonly contabilidadExcel: ContabilidadExcelService,
    private readonly movimientoCajaService: MovimientoCajaService,
  ) {}

  async generar(filtro: FiltroCajaFlujoExcelDto, user: Usuario): Promise<Buffer> {
    const { caja, periodos, movimientos: todosLosMovimientos } =
      await this.movimientoCajaService.listar(filtro);
    // El listado general incluye movimientos dados de baja (para el
    // historial); el reporte impreso solo debe reflejar los vigentes, igual
    // que el saldo por período que calcula el servicio.
    const movimientos = todosLosMovimientos.filter((m) => m.activo !== false);
    // gestión + mes ya vienen filtrados, así que `periodos` trae a lo sumo
    // el único período mensual pedido (o ninguno si todavía no se cargó
    // ningún movimiento en ese mes).
    const saldoInicialPeriodo = periodos[0]
      ? Number(periodos[0].saldoInicial)
      : Number(caja.saldoInicial);

    const simbolo = filtro.moneda === 'USD' ? '$us.' : 'Bs.';
    const columnas: ColumnaContable[] = [
      { titulo: 'FECHA', ancho: 12, fecha: true },
      { titulo: 'CONCEPTO', ancho: 40 },
      { titulo: 'ENTREGA DE FONDOS A', ancho: 28 },
      { titulo: 'FACTURA Y/O RECIBO', ancho: 15, alineacion: 'center' },
      { titulo: 'Nº CPTE', ancho: 14, alineacion: 'center' },
      { titulo: 'DESTINO DEL GASTO', ancho: 28, alineacion: 'center' },
      { titulo: `INGRESO ${simbolo}`, ancho: 15, importe: true },
      { titulo: `EGRESO ${simbolo}`, ancho: 15, importe: true },
      { titulo: `SALDO ${simbolo}`, ancho: 16, importe: true },
    ];
    const totalColumnas = columnas.length;
    const paleta = PALETAS.cajaFlujo;
    const excel = this.contabilidadExcel;

    const workbook = excel.crearLibro();
    const worksheet = excel.crearHoja(workbook, 'CAJA DE FLUJO', columnas);

    excel.agregarTitulos(
      worksheet,
      totalColumnas,
      `CAJA DE FLUJO - ${caja.nombre?.toUpperCase() ?? ''}`,
      filtro.moneda === 'USD' ? '(Expresado en Dólares)' : '(Expresado en Bolivianos)',
    );
    excel.agregarDatoCabecera(worksheet, 5, 1, 3, {
      etiqueta: 'RESPONSABLE',
      valor: user.usuario?.toUpperCase() ?? '',
    });
    excel.agregarDatoCabecera(
      worksheet,
      5,
      4,
      6,
      { etiqueta: 'PERÍODO', valor: `${MESES[filtro.mes - 1]} DE ${filtro.gestion}` },
      'center',
    );
    excel.agregarDatoCabecera(
      worksheet,
      5,
      7,
      totalColumnas,
      { etiqueta: 'GESTIÓN', valor: String(filtro.gestion) },
      'center',
    );

    const filaEncabezado = 7;
    excel.agregarEncabezado(worksheet, filaEncabezado, columnas, paleta);

    let fila = filaEncabezado + 1;
    if (movimientos.length === 0) {
      excel.agregarFila(
        worksheet,
        fila++,
        columnas,
        [
          excel.fecha(`${filtro.gestion}-${String(filtro.mes).padStart(2, '0')}-01`),
          'SALDO DE APERTURA',
          '',
          '',
          '',
          'SALDO INICIAL',
          null,
          null,
          saldoInicialPeriodo,
        ],
        { relleno: paleta.suave, negrita: true },
      );
    }

    movimientos.forEach((mov) => {
      excel.agregarFila(worksheet, fila++, columnas, [
        excel.fecha(mov.fecha),
        mov.concepto,
        mov.entregaFondosA ?? '',
        mov.facturaRecibo || '',
        mov.nroComprobante || '',
        mov.destinoGasto?.nombre ?? '',
        Number(mov.ingreso) > 0 ? Number(mov.ingreso) : null,
        Number(mov.egreso) > 0 ? Number(mov.egreso) : null,
        Number(mov.saldo),
      ]);
    });

    const totalIngreso = movimientos.reduce((acc, m) => acc + Number(m.ingreso), 0);
    const totalEgreso = movimientos.reduce((acc, m) => acc + Number(m.egreso), 0);
    const saldoFinal =
      movimientos.length > 0
        ? Number(movimientos[movimientos.length - 1].saldo)
        : saldoInicialPeriodo;

    excel.agregarTotal(
      worksheet,
      fila,
      totalColumnas,
      6,
      'SUMAS TOTALES',
      { 7: this.r2(totalIngreso), 8: this.r2(totalEgreso), 9: this.r2(saldoFinal) },
      paleta,
    );

    return excel.generar(workbook);
  }

  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
}
