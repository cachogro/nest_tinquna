import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { aplicarOrden } from 'src/common/utils/query-orden.util';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { PlanCuentas } from 'src/cluster/parametricas/entities/plan-cuentas.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { MovimientoCaja } from '../entities/movimiento-caja.entity';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { Traspaso } from '../entities/traspaso.entity';
import { CreateTraspasoDto } from '../dto/traspaso/create-traspaso.dto';
import { FiltroTraspasoDto } from '../dto/traspaso/filtro-traspaso.dto';
import { TraspasoPaginadoDto } from '../dto/traspaso/traspaso-paginado.dto';
import { FiltroTraspasoExcelDto } from '../dto/traspaso/filtro-traspaso-excel.dto';
import { MovimientoCajaService } from './movimiento-caja.service';
import { LibretaBancoService } from './libreta-banco.service';
import { monedaDeCuenta, resolverTipoCambio } from '../moneda.util';
import { resolverPersonaAutorizo } from '../persona-autorizo.util';
import { validarMesEnCurso } from '../mes-en-curso.util';
import { obtenerCuentaImputable } from 'src/cluster/parametricas/plan-cuentas.util';

const RELACIONES = {
  caja: true,
  cuentaBancaria: { entidadFinanciera: true },
  planCuentas: true,
  movimientosCaja: { periodoCaja: true },
  movimientosBanco: { periodoBanco: true },
} as const;

// La caja de flujo (Caja id=1, "CAJA PRINCIPAL") es el registro maestro de
// la empresa: un traspaso siempre la usa, no se le pide al front (mismo
// criterio que ReciboService y MovimientoKardexService).
const ID_CAJA_EMPRESA = 1;

/**
 * Traspaso interno de fondos propios de la empresa entre la caja de flujo y
 * una cuenta bancaria (ver `Traspaso`). Genera atómicamente un movimiento en
 * `MovimientoCaja` y otro en `LibretaBanco`, enlazados por `idTraspaso`, y
 * los mantiene sincronizados: activar/desactivar el traspaso hace lo mismo
 * en ambos lados a la vez.
 */
@Injectable()
export class TraspasoService {
  constructor(
    @InjectRepository(Traspaso, 'ci')
    private readonly traspasoRepository: Repository<Traspaso>,

    @InjectRepository(MovimientoCaja, 'ci')
    private readonly movimientoCajaRepository: Repository<MovimientoCaja>,

    @InjectRepository(LibretaBanco, 'ci')
    private readonly libretaBancoRepository: Repository<LibretaBanco>,

    @InjectRepository(CuentaBancaria, 'ci')
    private readonly cuentaBancariaRepository: Repository<CuentaBancaria>,

    @InjectRepository(PlanCuentas, 'ci')
    private readonly planCuentasRepository: Repository<PlanCuentas>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    private readonly movimientoCajaService: MovimientoCajaService,
    private readonly libretaBancoService: LibretaBancoService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private async obtenerCuentaBancaria(id: number): Promise<CuentaBancaria> {
    const cuenta = await this.cuentaBancariaRepository.findOne({
      where: { id },
      relations: { entidadFinanciera: true },
    });
    if (!cuenta) {
      throw new NotFoundException('No existe la cuenta bancaria seleccionada.');
    }
    return cuenta;
  }

  private etiquetaCuenta(cuenta: CuentaBancaria): string {
    return cuenta.alias?.trim() || cuenta.numeroCuenta;
  }

  /**
   * Valida el plan de cuentas igual que en un recibo/movimiento de caja: una
   * cuenta imputable (tipo D) activa. La dirección (depósito o retiro) la da el
   * traspaso, no la cuenta.
   */
  private async resolverPlanCuentas(
    idPlanCuentas: number | undefined,
  ): Promise<number | null> {
    if (!idPlanCuentas) {
      return null;
    }
    return (
      await obtenerCuentaImputable(this.planCuentasRepository.manager, idPlanCuentas)
    ).id;
  }

  // ------------------------------------------------------------------ CRUD
  async guardar(dto: CreateTraspasoDto, user: Usuario): Promise<Traspaso> {
    return dto.id ? this.actualizar(dto, user) : this.crear(dto, user);
  }

  private async crear(
    dto: CreateTraspasoDto,
    user: Usuario,
  ): Promise<Traspaso> {
    const cuentaBancaria = await this.obtenerCuentaBancaria(dto.idCuentaBancaria);
    const moneda = monedaDeCuenta(cuentaBancaria);
    const tipoCambio = resolverTipoCambio(moneda, dto.tipoCambio);

    // Ambos lados deben estar aperturados antes de aceptar el traspaso: no
    // habría desde qué saldo arrastrar en ninguno de los dos.
    const cajaEmpresa = await this.movimientoCajaService.obtenerCajaAperturada(
      ID_CAJA_EMPRESA,
      moneda,
    );
    await this.libretaBancoService.obtenerCuentaAperturada(cuentaBancaria.id);
    const idPlanCuentas = await this.resolverPlanCuentas(dto.idPlanCuentas);
    const personaAutorizo = await resolverPersonaAutorizo(
      this.personaRepository,
      dto.idPersonaAutorizo,
      'el traspaso',
    );

    const monto = this.r2(Number(dto.monto));
    const concepto = dto.concepto.trim();
    const nroComprobante = dto.nroComprobante?.trim() || null;
    const esDeposito = dto.tipo === 'DEPOSITO';

    return this.dataSource.transaction(async (manager) => {
      const traspaso = await manager.save(
        manager.create(Traspaso, {
          tipo: dto.tipo,
          fecha: dto.fecha,
          idCaja: cajaEmpresa.id,
          moneda,
          tipoCambio,
          idCuentaBancaria: cuentaBancaria.id,
          nroComprobante,
          concepto,
          monto,
          idPlanCuentas,
          personaAutorizo,
          usuarioRegistro: user.usuario,
        }),
      );

      // DEPOSITO: sale de caja (EGRESO) y entra al banco (HABER).
      // RETIRO:   sale del banco (DEBE) y entra a caja (INGRESO).
      await this.movimientoCajaService.crearMovimientoEnTransaccion(
        manager,
        cajaEmpresa,
        {
          moneda,
          tipoCambio,
          fecha: dto.fecha,
          nroComprobante,
          concepto,
          entregaFondosA: `TRASPASO ${dto.tipo} - CTA ${this.etiquetaCuenta(cuentaBancaria)}`,
          idPlanCuentas,
          idTraspaso: traspaso.id,
          ingreso: esDeposito ? 0 : monto,
          egreso: esDeposito ? monto : 0,
        },
        user,
      );

      await this.libretaBancoService.crearMovimientoEnTransaccion(
        manager,
        cuentaBancaria,
        {
          fecha: dto.fecha,
          nroTransaccion: nroComprobante,
          tipoTransaccion: dto.tipo,
          concepto,
          idPlanCuentas,
          nombresApellidos: `TRASPASO ${dto.tipo} - ${cajaEmpresa.nombre}`,
          idTraspaso: traspaso.id,
          tipoCambio,
          debe: esDeposito ? 0 : monto,
          haber: esDeposito ? monto : 0,
        },
        user,
      );

      return manager.findOne(Traspaso, {
        where: { id: traspaso.id },
        relations: RELACIONES,
      });
    });
  }

  /**
   * Solo permite corregir fecha / concepto / N° de comprobante / plan de cuentas del
   * gasto / monto / tipo de cambio:
   * `tipo` e `idCuentaBancaria` quedan fijos (cambiarlos exigiría borrar y
   * recrear los dos movimientos ya posteados; la caja de flujo siempre es
   * la de la empresa, no se puede cambiar). Falla si alguno de los dos
   * períodos (caja o banco) ya está cerrado.
   */
  private async actualizar(
    dto: CreateTraspasoDto,
    user: Usuario,
  ): Promise<Traspaso> {
    const traspaso = await this.traspasoRepository.findOne({
      where: { id: String(dto.id) },
    });
    if (!traspaso) {
      throw new NotFoundException('No se encontró el traspaso.');
    }
    if (Number(traspaso.idCuentaBancaria) !== Number(dto.idCuentaBancaria)) {
      throw new BadRequestException(
        'No se puede cambiar la cuenta bancaria del traspaso.',
      );
    }
    if (traspaso.tipo !== dto.tipo) {
      throw new BadRequestException(
        'No se puede cambiar el tipo (DEPOSITO/RETIRO) del traspaso.',
      );
    }

    const movCaja = await this.movimientoCajaRepository.findOne({
      where: { idTraspaso: traspaso.id },
      relations: { periodoCaja: true },
    });
    const movBanco = await this.libretaBancoRepository.findOne({
      where: { idTraspaso: traspaso.id },
      relations: { periodoBanco: true },
    });
    if (!movCaja || !movBanco) {
      throw new NotFoundException(
        'No se encontraron los movimientos generados por este traspaso.',
      );
    }
    if (movCaja.periodoCaja.estado === 'CERRADO') {
      throw new BadRequestException(
        'El movimiento de caja de este traspaso pertenece a un período cerrado y no puede modificarse.',
      );
    }
    if (movBanco.periodoBanco.estado === 'CERRADO') {
      throw new BadRequestException(
        'El movimiento de banco de este traspaso pertenece a un período cerrado y no puede modificarse.',
      );
    }

    const idPlanCuentas = await this.resolverPlanCuentas(dto.idPlanCuentas);
    // Mismo autorizador => se conserva el snapshot original (no se pisa con
    // los datos actuales de persona_ci); otro autorizador => snapshot nuevo.
    const personaAutorizo =
      traspaso.personaAutorizo &&
      String(traspaso.personaAutorizo.id) === String(dto.idPersonaAutorizo)
        ? traspaso.personaAutorizo
        : await resolverPersonaAutorizo(
            this.personaRepository,
            dto.idPersonaAutorizo,
            'el traspaso',
          );
    // La cuenta no cambia en un update, así que la moneda tampoco: en USD el
    // tipo de cambio se exige también acá (los traspasos en USD anteriores a
    // la 084 no lo tienen y hay que completarlo al editarlos).
    const tipoCambio = resolverTipoCambio(traspaso.moneda, dto.tipoCambio);
    const monto = this.r2(Number(dto.monto));
    const concepto = dto.concepto.trim();
    const nroComprobante = dto.nroComprobante?.trim() || null;
    const esDeposito = dto.tipo === 'DEPOSITO';

    return this.dataSource.transaction(async (manager) => {
      await manager.update(Traspaso, traspaso.id, {
        fecha: dto.fecha,
        concepto,
        nroComprobante,
        monto,
        tipoCambio,
        idPlanCuentas,
        personaAutorizo,
        usuarioUltimaModificacion: user.usuario,
      });

      await manager.update(MovimientoCaja, movCaja.id, {
        tipoCambio,
        fecha: dto.fecha,
        nroComprobante,
        concepto,
        idPlanCuentas,
        ingreso: esDeposito ? 0 : monto,
        egreso: esDeposito ? monto : 0,
        usuarioUltimaModificacion: user.usuario,
      });
      await manager.update(LibretaBanco, movBanco.id, {
        fecha: dto.fecha,
        nroTransaccion: nroComprobante,
        concepto,
        idPlanCuentas,
        tipoCambio,
        debe: esDeposito ? 0 : monto,
        haber: esDeposito ? monto : 0,
        usuarioUltimaModificacion: user.usuario,
      });

      // Recalcula ambos lados; nota: si la fecha cambió de mes/gestión, el
      // folio/período de cada movimiento no se reubica acá (a diferencia de
      // `MovimientoCajaService.actualizar` / `LibretaBancoService.actualizar`).
      // Para mover un traspaso a otro período, desactivalo y registrá uno
      // nuevo en la fecha correcta.
      await this.movimientoCajaService.recalcularSaldosEnTransaccion(
        manager,
        movCaja.idCaja,
        movCaja.moneda,
      );
      await this.libretaBancoService.recalcularSaldosEnTransaccion(
        manager,
        movBanco.idCuentaBancaria,
      );

      return manager.findOne(Traspaso, {
        where: { id: traspaso.id },
        relations: RELACIONES,
      });
    });
  }

  async cambiarEstado(
    id: number,
    activo: boolean,
    user: Usuario,
  ): Promise<Traspaso> {
    const traspaso = await this.traspasoRepository.findOne({
      where: { id: String(id) },
    });
    if (!traspaso) {
      throw new NotFoundException('No se encontró el traspaso.');
    }
    validarMesEnCurso(traspaso.fecha, activo ? 'No se puede reactivar el traspaso' : 'No se puede anular el traspaso');

    const movCaja = await this.movimientoCajaRepository.findOne({
      where: { idTraspaso: traspaso.id },
      relations: { periodoCaja: true },
    });
    const movBanco = await this.libretaBancoRepository.findOne({
      where: { idTraspaso: traspaso.id },
      relations: { periodoBanco: true },
    });
    if (!movCaja || !movBanco) {
      throw new NotFoundException(
        'No se encontraron los movimientos generados por este traspaso.',
      );
    }
    if (movCaja.periodoCaja.estado === 'CERRADO') {
      throw new BadRequestException(
        'El movimiento de caja de este traspaso pertenece a un período cerrado.',
      );
    }
    if (movBanco.periodoBanco.estado === 'CERRADO') {
      throw new BadRequestException(
        'El movimiento de banco de este traspaso pertenece a un período cerrado.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.update(Traspaso, traspaso.id, {
        activo,
        usuarioUltimaModificacion: user.usuario,
      });
      await this.movimientoCajaService.cambiarEstadoEnTransaccion(
        manager,
        movCaja,
        activo,
        user,
      );
      await this.libretaBancoService.cambiarEstadoEnTransaccion(
        manager,
        movBanco,
        activo,
        user,
      );

      return manager.findOne(Traspaso, {
        where: { id: traspaso.id },
        relations: RELACIONES,
      });
    });
  }

  async listar(filtro: FiltroTraspasoDto): Promise<TraspasoPaginadoDto> {
    const {
      page = 1,
      limit = 10,
      busqueda,
      orderBy = 'fecha',
      orderDirection = 'DESC',
    } = filtro;

    const qb = this.traspasoRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.caja', 'caja')
      .leftJoinAndSelect('t.cuentaBancaria', 'cuenta')
      .leftJoinAndSelect('cuenta.entidadFinanciera', 'entidad')
      .leftJoinAndSelect('t.planCuentas', 'destino')
      // usuarioRegistro tiene select:false en Auditoria; la bandeja muestra
      // quién generó cada traspaso (igual que en recibos).
      .addSelect('t.usuarioRegistro');

    if (filtro.idCaja) {
      qb.andWhere('t.idCaja = :idCaja', { idCaja: filtro.idCaja });
    }
    if (filtro.idCuentaBancaria) {
      qb.andWhere('t.idCuentaBancaria = :idCuentaBancaria', {
        idCuentaBancaria: filtro.idCuentaBancaria,
      });
    }
    if (filtro.tipo) {
      qb.andWhere('t.tipo = :tipo', { tipo: filtro.tipo });
    }
    if (filtro.gestion) {
      qb.andWhere('EXTRACT(YEAR FROM t.fecha) = :gestion', { gestion: filtro.gestion });
    }
    if (busqueda) {
      qb.andWhere(
        `(
          t.concepto ILIKE :busqueda
          OR t.nroComprobante ILIKE :busqueda
          OR (t.personaAutorizo ->> 'nombres') ILIKE :busqueda
          OR (t.personaAutorizo ->> 'apellidoPaterno') ILIKE :busqueda
          OR (t.personaAutorizo ->> 'apellidoMaterno') ILIKE :busqueda
        )`,
        { busqueda: `%${busqueda}%` },
      );
    }

    aplicarOrden(
      qb,
      { fecha: 't.fecha', id: 't.id', monto: 't.monto' },
      orderBy,
      orderDirection,
    );
    qb.addOrderBy('t.id', orderDirection);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Traspasos para el reporte Excel: todos los que cumplan los filtros (sin
   * paginar), en orden cronológico, con quién los registró.
   */
  async listarParaReporte(filtro: FiltroTraspasoExcelDto): Promise<Traspaso[]> {
    const qb = this.traspasoRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.caja', 'caja')
      .leftJoinAndSelect('t.cuentaBancaria', 'cuenta')
      .leftJoinAndSelect('cuenta.entidadFinanciera', 'entidad')
      .leftJoinAndSelect('t.planCuentas', 'destino')
      // usuarioRegistro tiene select:false en Auditoria; el reporte lo imprime.
      .addSelect('t.usuarioRegistro');

    if (filtro.idCuentaBancaria) {
      qb.andWhere('t.idCuentaBancaria = :idCuentaBancaria', {
        idCuentaBancaria: filtro.idCuentaBancaria,
      });
    }
    if (filtro.tipo) {
      qb.andWhere('t.tipo = :tipo', { tipo: filtro.tipo });
    }
    if (filtro.moneda) {
      qb.andWhere('t.moneda = :moneda', { moneda: filtro.moneda });
    }
    if (filtro.estado) {
      qb.andWhere('t.activo = :activo', { activo: filtro.estado === 'ACTIVO' });
    }
    if (filtro.fechaDesde) {
      qb.andWhere('t.fecha >= :desde', { desde: filtro.fechaDesde });
    }
    if (filtro.fechaHasta) {
      qb.andWhere('t.fecha <= :hasta', { hasta: filtro.fechaHasta });
    }
    if (filtro.busqueda) {
      qb.andWhere('(t.concepto ILIKE :busqueda OR t.nroComprobante ILIKE :busqueda)', {
        busqueda: `%${filtro.busqueda}%`,
      });
    }

    qb.orderBy('t.fecha', 'ASC').addOrderBy('t.id', 'ASC');
    return qb.getMany();
  }

  async buscarPorId(id: string): Promise<Traspaso> {
    const traspaso = await this.traspasoRepository.findOne({
      where: { id },
      relations: RELACIONES,
    });
    if (!traspaso) {
      throw new NotFoundException('No se encontró el traspaso.');
    }
    // usuarioRegistro y fechaRegistro tienen select:false en Auditoria;
    // `findOne` con `relations` no admite reincorporarlos sin listar a mano
    // el resto de columnas, así que se traen aparte (mismo criterio que recibos).
    const auditoria = await this.traspasoRepository
      .createQueryBuilder('t')
      .select('t.usuarioRegistro', 'usuarioRegistro')
      .addSelect('t.fechaRegistro', 'fechaRegistro')
      .where('t.id = :id', { id })
      .getRawOne<{ usuarioRegistro: string | null; fechaRegistro: Date | null }>();
    traspaso.usuarioRegistro = auditoria?.usuarioRegistro ?? undefined;
    traspaso.fechaRegistro = auditoria?.fechaRegistro ?? undefined;
    return traspaso;
  }
}
