import { Injectable } from '@nestjs/common';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { Kardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import {
  ColumnaContable,
  ContabilidadExcelService,
  PALETAS,
} from './contabilidad-excel.service';
import { KardexService } from './kardex.service';
import { MovimientoKardexService } from './movimiento-kardex.service';

const COLUMNAS: ColumnaContable[] = [
  { titulo: 'N°', ancho: 6, alineacion: 'center' },
  { titulo: 'FECHA', ancho: 12, fecha: true },
  { titulo: 'N° DE COMP.', ancho: 16, alineacion: 'center' },
  { titulo: 'DETALLE', ancho: 45 },
  // Quién aprobó el recibo que originó la línea (primer nombre y apellido).
  { titulo: 'APROBADO POR', ancho: 28 },
  // Medio de pago con banco y comprobante: "QR - UNION - 123578955".
  { titulo: 'TIPO DE PAGO', ancho: 32 },
  { titulo: 'LOTE', ancho: 16, alineacion: 'center' },
  // Importe original de los movimientos en dólares (remesas, etc.).
  { titulo: 'DEBE $us', ancho: 14, importe: true },
  { titulo: 'HABER $us', ancho: 14, importe: true },
  { titulo: 'T.C.', ancho: 9, alineacion: 'center' },
  // El kardex lleva su saldo en Bs.: un movimiento en USD entra convertido.
  { titulo: 'DEBE Bs.', ancho: 16, importe: true },
  { titulo: 'HABER Bs.', ancho: 16, importe: true },
  { titulo: 'SALDO Bs.', ancho: 17, importe: true },
  { titulo: 'COBRADOR', ancho: 28 },
];
const TOTAL_COLUMNAS = COLUMNAS.length;
const COL_SALDO = COLUMNAS.findIndex((c) => c.titulo === 'SALDO Bs.') + 1;

/**
 * Genera el Excel del kardex actual (actor, persona o cliente), con el mismo
 * formato del modelo "caja de flujo y kardex.xlsx" (hoja de kardex):
 * cabecera con proveedor/cuenta/gestión, detalle de movimientos y el total
 * de anticipos por cobrar.
 */
@Injectable()
export class KardexExcelService {
  constructor(
    private readonly contabilidadExcel: ContabilidadExcelService,
    private readonly kardexService: KardexService,
    private readonly movimientoKardexService: MovimientoKardexService,
  ) {}

  async generar(idKardex: string): Promise<{ buffer: Buffer; codigo: string }> {
    const kardex = await this.kardexService.buscarPorId(idKardex);
    const todosLosMovimientos =
      await this.movimientoKardexService.listarParaExcel(idKardex);
    // El listado general incluye líneas dadas de baja; el reporte impreso
    // solo debe reflejar las vigentes, igual que `saldoActual` del kardex.
    const movimientos = todosLosMovimientos.filter((m) => m.activo !== false);

    const paleta = PALETAS.kardex;
    const excel = this.contabilidadExcel;
    const workbook = excel.crearLibro();
    const worksheet = excel.crearHoja(workbook, `KARDEX ${kardex.codigo}`, COLUMNAS);

    const hoy = new Date();
    const practicadoAl = [
      String(hoy.getDate()).padStart(2, '0'),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      hoy.getFullYear(),
    ].join('/');
    excel.agregarTitulos(worksheet, TOTAL_COLUMNAS, 'KARDEX DE ANTICIPOS', `PRACTICADO AL ${practicadoAl}`);
    excel.agregarDatoCabecera(worksheet, 5, 1, 6, {
      etiqueta: 'PROVEEDOR',
      valor: this.nombreTitular(kardex),
    });
    excel.agregarDatoCabecera(
      worksheet,
      5,
      7,
      TOTAL_COLUMNAS,
      {
        etiqueta: `KARDEX ${kardex.codigo}  -  N° ${kardex.numero}  -  GESTIÓN`,
        valor: String(kardex.gestion),
      },
      'center',
    );
    excel.agregarDatoCabecera(worksheet, 6, 1, TOTAL_COLUMNAS, {
      etiqueta: 'CUENTA',
      valor: this.descripcionCuenta(kardex),
    });

    const filaEncabezado = 8;
    excel.agregarEncabezado(worksheet, filaEncabezado, COLUMNAS, paleta);

    let fila = filaEncabezado + 1;
    movimientos.forEach((mov) => {
      excel.agregarFila(worksheet, fila++, COLUMNAS, [
        mov.numeroLinea,
        excel.fecha(mov.fecha),
        mov.facturaRecibo || mov.nroComprobante || '',
        mov.detalle,
        this.nombreCorto(mov.recibo?.personaAutorizo),
        this.tipoPago(mov),
        mov.lote || mov.recibo?.ventaLote?.codigoLote || '',
        Number(mov.debeUsd) > 0 ? Number(mov.debeUsd) : null,
        Number(mov.haberUsd) > 0 ? Number(mov.haberUsd) : null,
        mov.moneda === 'USD' && mov.tipoCambio ? Number(mov.tipoCambio) : null,
        Number(mov.debe) > 0 ? Number(mov.debe) : null,
        Number(mov.haber) > 0 ? Number(mov.haber) : null,
        Number(mov.saldo),
        this.nombreCompleto(mov.cobrador),
      ]);
    });

    excel.agregarTotal(
      worksheet,
      fila,
      TOTAL_COLUMNAS,
      COL_SALDO - 1,
      'TOTAL ANTICIPOS POR COBRAR (Bs.)',
      { [COL_SALDO]: Number(kardex.saldoActual) },
      paleta,
    );

    return { buffer: await excel.generar(workbook), codigo: kardex.codigo };
  }

  /**
   * "EFECTIVO" tal cual; un medio bancario lleva la sigla del banco y el N°
   * de comprobante: "QR - UNION - 123578955".
   */
  private tipoPago(mov: MovimientoKardex): string {
    const forma = mov.formaPago?.nombre?.toUpperCase() ?? '';
    if (!mov.cuentaBancaria) {
      return forma;
    }
    const entidad = mov.cuentaBancaria.entidadFinanciera;
    const banco = (entidad?.sigla || entidad?.nombre || '').toUpperCase();
    return [forma, banco, mov.nroComprobante?.trim()].filter(Boolean).join(' - ');
  }

  private descripcionCuenta(kardex: Kardex): string {
    if (kardex.descripcion) {
      return kardex.descripcion;
    }
    switch (kardex.tipo) {
      case 'ACTOR':
        return 'Anticipos - Actor Productivo Minero';
      case 'CLIENTE':
        return 'Cuenta por Cobrar - Cliente';
      case 'ASOCIADO':
        return 'Anticipos - Persona Asociada';
      default:
        return 'Anticipos - Cuenta Personal';
    }
  }

  private nombreTitular(kardex: Kardex): string {
    if ((kardex.tipo === 'PERSONAL' || kardex.tipo === 'ASOCIADO') && kardex.persona) {
      return this.nombreCompleto(kardex.persona) || 'S/N';
    }
    if (kardex.tipo === 'ACTOR' && kardex.actorProductivoMinero) {
      return kardex.actorProductivoMinero.nombre?.toUpperCase() ?? 'S/N';
    }
    if (kardex.tipo === 'CLIENTE' && kardex.cliente) {
      return kardex.cliente.nombre?.toUpperCase() ?? 'S/N';
    }
    return 'S/N';
  }

  /** Primer nombre y primer apellido: "JUAN CARLOS PEREZ LOPEZ" -> "JUAN PEREZ". */
  private nombreCorto(
    persona?: Pick<PersonaCi, 'nombres' | 'apellidoPaterno' | 'apellidoMaterno'> | null,
  ): string {
    if (!persona) {
      return '';
    }
    const primerNombre = persona.nombres?.trim().split(/\s+/)[0];
    const primerApellido = persona.apellidoPaterno?.trim() || persona.apellidoMaterno?.trim();
    return [primerNombre, primerApellido].filter(Boolean).join(' ');
  }

  private nombreCompleto(
    persona?: Pick<PersonaCi, 'nombres' | 'apellidoPaterno' | 'apellidoMaterno'> | null,
  ): string {
    if (!persona) {
      return '';
    }
    return [persona.nombres, persona.apellidoPaterno, persona.apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .trim();
  }
}
