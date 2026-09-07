import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { Caja } from 'src/cluster/parametricas/entities/caja.entity';
import { aplicarOrden } from 'src/common/utils/query-orden.util';
import { Kardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { MonedaCaja } from '../entities/periodo-caja.entity';
import { Recibo, TipoRecibo, SerieRecibo } from '../entities/recibo.entity';
import { ReciboDetalle } from '../entities/recibo-detalle.entity';
import { CreateReciboDto } from '../dto/recibo/create-recibo.dto';
import { ProcesarReciboDto } from '../dto/recibo/procesar-recibo.dto';
import { ReciboDetalleDto } from '../dto/recibo/recibo-detalle.dto';
import { FiltrosReciboDto } from '../dto/recibo/filtros-recibo.dto';
import { ReciboPaginadoDto } from '../dto/recibo/recibo-paginado.dto';
import { MovimientoCajaService } from './movimiento-caja.service';

// La caja de flujo (Caja id=1, "CAJA PRINCIPAL") es el registro maestro de
// la empresa: todo recibo, además de postear en los kardex de sus detalles,
// se refleja acá por el TOTAL. El kardex no maneja moneda, así que un
// recibo siempre postea en bolivianos.
const ID_CAJA_EMPRESA = 1;
const MONEDA_RECIBO: MonedaCaja = 'BOB';

const RELACIONES = {
  persona: true,
  actorProductivoMinero: true,
  formaPago: true,
  cuentaBancaria: { entidadFinanciera: true },
  destinoGasto: true,
  movimientosCaja: { destinoGasto: true },
  detalles: { persona: true, actorProductivoMinero: true },
} as const;

@Injectable()
export class ReciboService {
  constructor(
    @InjectRepository(Recibo, 'ci')
    private readonly reciboRepository: Repository<Recibo>,

    @InjectRepository(ReciboDetalle, 'ci')
    private readonly detalleRepository: Repository<ReciboDetalle>,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(ActorProductivoMinero, 'ci')
    private readonly actorRepository: Repository<ActorProductivoMinero>,

    @InjectRepository(FormaPago, 'ci')
    private readonly formaPagoRepository: Repository<FormaPago>,

    @InjectRepository(DestinoGasto, 'ci')
    private readonly destinoGastoRepository: Repository<DestinoGasto>,

    @InjectRepository(CuentaBancaria, 'ci')
    private readonly cuentaBancariaRepository: Repository<CuentaBancaria>,

    private readonly movimientoCajaService: MovimientoCajaService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /**
   * Resuelve la contraparte física del recibo ("Recibí de" / "Entregué a"):
   * UNA de estas tres, excluyentes entre sí —
   *   - `idPersona`: valida que exista en persona_ci y usa su nombre (o el
   *     texto manual si vino);
   *   - `idActorProductivoMinero`: valida que exista y usa su nombre (o el
   *     texto manual si vino);
   *   - ninguna de las dos: guarda solo el texto libre `nombresApellidos`
   *     (recibo entregado a dos personas, o a alguien no registrado).
   */
  private async resolverBeneficiario(dto: CreateReciboDto): Promise<{
    idPersona: string | null;
    idActorProductivoMinero: string | null;
    nombresApellidos: string | null;
  }> {
    const textoManual = dto.nombresApellidos?.trim() || null;

    if (dto.idPersona && dto.idActorProductivoMinero) {
      throw new BadRequestException(
        'La contraparte del recibo no puede ser una persona y un actor productivo minero a la vez.',
      );
    }

    if (!dto.idPersona && !dto.idActorProductivoMinero && !textoManual) {
      throw new BadRequestException(
        'Debe indicar la contraparte del recibo: idPersona, idActorProductivoMinero o nombresApellidos.',
      );
    }

    if (dto.idActorProductivoMinero) {
      const actor = await this.actorRepository.findOne({
        where: { id: String(dto.idActorProductivoMinero) },
      });
      if (!actor) {
        throw new NotFoundException('No se encontró el actor productivo minero indicado.');
      }
      if (!actor.activo) {
        throw new BadRequestException('El actor productivo minero indicado está inactivo.');
      }

      return {
        idPersona: null,
        idActorProductivoMinero: actor.id,
        nombresApellidos: textoManual || actor.nombre.toUpperCase(),
      };
    }

    if (!dto.idPersona) {
      return { idPersona: null, idActorProductivoMinero: null, nombresApellidos: textoManual };
    }

    const persona = await this.personaRepository.findOne({
      where: { id: String(dto.idPersona) },
    });
    if (!persona) {
      throw new NotFoundException('No se encontró la persona indicada.');
    }
    if (!persona.activo) {
      throw new BadRequestException('La persona indicada está inactiva.');
    }

    const nombreDerivado = [
      persona.nombres,
      persona.apellidoPaterno,
      persona.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toUpperCase();

    return {
      idPersona: persona.id,
      idActorProductivoMinero: null,
      nombresApellidos: textoManual || nombreDerivado || null,
    };
  }

  private serieDeTipo(tipo: TipoRecibo): SerieRecibo {
    return tipo === 'INGRESO' ? 'R' : 'C';
  }

  private formatearNroComprobante(serie: SerieRecibo, numero: number): string {
    return `REC:${serie}-${String(numero).padStart(4, '0')}`;
  }

  private async siguienteNumero(
    manager: EntityManager,
    serie: SerieRecibo,
  ): Promise<number> {
    const { max } = await manager
      .createQueryBuilder(Recibo, 'r')
      .select('COALESCE(MAX(r.numero), 0)', 'max')
      .where('r.serie = :serie', { serie })
      .getRawOne<{ max: string }>();
    return Number(max ?? 0) + 1;
  }

  private async siguienteNumeroLinea(
    manager: EntityManager,
    idKardex: string,
  ): Promise<number> {
    const { max } = await manager
      .createQueryBuilder(MovimientoKardex, 'm')
      .select('COALESCE(MAX(m.numeroLinea), 0)', 'max')
      .where('m.idKardex = :id', { id: idKardex })
      .getRawOne<{ max: string }>();
    return Number(max ?? 0) + 1;
  }

  /** Mismo algoritmo que MovimientoKardexService.recalcularKardex. */
  private async recalcularKardex(
    manager: EntityManager,
    idKardex: string,
  ): Promise<void> {
    const kardex = await manager.findOne(Kardex, { where: { id: idKardex } });
    if (!kardex) return;

    const movs = await manager.find(MovimientoKardex, {
      where: { idKardex, activo: true },
      order: { fecha: 'ASC', id: 'ASC' },
    });

    let running = this.r2(Number(kardex.saldoInicial));
    for (const mov of movs) {
      running = this.r2(running + Number(mov.debe) - Number(mov.haber));
      if (this.r2(Number(mov.saldo)) !== running) {
        await manager.update(MovimientoKardex, mov.id, { saldo: running });
      }
    }

    await manager.update(Kardex, kardex.id, { saldoActual: running });
  }

  private async obtenerKardexAbiertoPersonal(idPersona: string): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({
      where: { tipo: 'PERSONAL', idPersona, estado: 'ABIERTO' },
    });
    if (!kardex) {
      throw new NotFoundException(
        `La persona ${idPersona} no tiene un kardex personal abierto. Abrilo primero.`,
      );
    }
    return kardex;
  }

  private async obtenerKardexAbiertoActor(
    idActorProductivoMinero: string,
  ): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({
      where: {
        tipo: 'ACTOR',
        idActorProductivoMinero,
        estado: 'ABIERTO',
      },
    });
    if (!kardex) {
      throw new NotFoundException(
        `El actor productivo minero ${idActorProductivoMinero} no tiene un kardex abierto. Abrilo primero.`,
      );
    }
    return kardex;
  }

  private async resolverIdDestinoGasto(
    idDestinoGasto?: number,
  ): Promise<number | null> {
    if (!idDestinoGasto) {
      return null;
    }
    const destinoGasto = await this.destinoGastoRepository.findOne({
      where: { id: idDestinoGasto },
    });
    if (!destinoGasto) {
      throw new NotFoundException('No existe el destino del gasto seleccionado.');
    }
    return destinoGasto.id;
  }

  private async resolverIdFormaPagoOpcional(
    idFormaPago?: number,
  ): Promise<number | null> {
    if (!idFormaPago) {
      return null;
    }
    const formaPago = await this.formaPagoRepository.findOne({
      where: { id: idFormaPago },
    });
    if (!formaPago) {
      throw new NotFoundException('No existe la forma de pago seleccionada.');
    }
    return formaPago.id;
  }

  private async resolverIdCuentaBancariaOpcional(
    idCuentaBancaria?: number,
  ): Promise<number | null> {
    if (!idCuentaBancaria) {
      return null;
    }
    const cuentaBancaria = await this.cuentaBancariaRepository.findOne({
      where: { id: idCuentaBancaria },
    });
    if (!cuentaBancaria) {
      throw new NotFoundException('No existe la cuenta bancaria seleccionada.');
    }
    return cuentaBancaria.id;
  }

  /** Valida solo la cabecera: no requiere `detalles` (puede ser un borrador). */
  private async validarCabecera(dto: CreateReciboDto): Promise<{
    idFormaPago: number | null;
    idDestinoGasto: number | null;
    idCuentaBancaria: number | null;
  }> {
    const idFormaPago = await this.resolverIdFormaPagoOpcional(dto.idFormaPago);
    const idDestinoGasto = await this.resolverIdDestinoGasto(dto.idDestinoGasto);
    const idCuentaBancaria = await this.resolverIdCuentaBancariaOpcional(
      dto.idCuentaBancaria,
    );

    return { idFormaPago, idDestinoGasto, idCuentaBancaria };
  }

  private validarDetalle(detalle: ReciboDetalleDto): void {
    if (detalle.destino === 'PERSONAL' && !detalle.idPersona) {
      throw new BadRequestException(
        'Una línea con destino PERSONAL requiere idPersona.',
      );
    }
    if (detalle.destino === 'ACTOR' && !detalle.idActorProductivoMinero) {
      throw new BadRequestException(
        'Una línea con destino ACTOR requiere idActorProductivoMinero.',
      );
    }
  }

  /**
   * Valida y resuelve todo lo necesario para PROCESAR un recibo (sea en el
   * mismo paso de creación, o al procesar un borrador): la suma de
   * `detalles` contra el `montoTotal`, cada línea de detalle, la caja de la
   * empresa (aperturada) y el kardex ABIERTO de cada línea PERSONAL/ACTOR.
   * El destino del gasto se resuelve aparte, en `validarCabecera` (aplica a
   * toda la cabecera, no solo a los detalles). Falla rápido, antes de abrir
   * la transacción.
   */
  private async validarYPrepararDetalles(
    montoTotal: number,
    detalles: ReciboDetalleDto[] | undefined,
  ): Promise<{
    cajaEmpresa: Caja;
    kardexPorDetalle: Map<number, Kardex>;
  }> {
    if (!detalles || detalles.length === 0) {
      throw new BadRequestException(
        'El recibo debe tener al menos una línea de detalle para procesarse.',
      );
    }

    const sumaDetalles = this.r2(
      detalles.reduce((s, d) => s + Number(d.monto), 0),
    );
    if (sumaDetalles !== this.r2(Number(montoTotal))) {
      throw new BadRequestException(
        `La suma de los detalles (${sumaDetalles}) no coincide con el monto total del recibo (${montoTotal}).`,
      );
    }

    for (const detalle of detalles) {
      this.validarDetalle(detalle);
    }

    const cajaEmpresa = await this.movimientoCajaService.obtenerCajaAperturada(
      ID_CAJA_EMPRESA,
      MONEDA_RECIBO,
    );

    const kardexPorDetalle = new Map<number, Kardex>();
    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i];
      if (detalle.destino === 'PERSONAL') {
        kardexPorDetalle.set(
          i,
          await this.obtenerKardexAbiertoPersonal(String(detalle.idPersona)),
        );
      } else if (detalle.destino === 'ACTOR') {
        kardexPorDetalle.set(
          i,
          await this.obtenerKardexAbiertoActor(String(detalle.idActorProductivoMinero)),
        );
      }
    }

    return { cajaEmpresa, kardexPorDetalle };
  }

  /**
   * Postea las líneas de kardex de cada detalle y los movimientos de caja
   * de flujo (hasta 2). Reusado tanto por `generar` (un solo paso) como por
   * `procesar` (segundo paso de un borrador).
   */
  private async procesarDetalles(
    manager: EntityManager,
    recibo: Recibo,
    detalles: ReciboDetalleDto[],
    idFormaPago: number | null,
    idDestinoGasto: number | null,
    cajaEmpresa: Caja,
    kardexPorDetalle: Map<number, Kardex>,
    user: Usuario,
  ): Promise<void> {
    const nroComprobanteInterno = this.formatearNroComprobante(recibo.serie, recibo.numero);

    for (let i = 0; i < detalles.length; i++) {
      const detalleDto = detalles[i];
      const monto = this.r2(Number(detalleDto.monto));
      let idMovimientoKardex: string | null = null;

      const kardex = kardexPorDetalle.get(i);
      if (kardex) {
        const numeroLinea = await this.siguienteNumeroLinea(manager, kardex.id);
        const mov = await manager.save(
          manager.create(MovimientoKardex, {
            idKardex: kardex.id,
            numeroLinea,
            fecha: recibo.fecha,
            nroComprobante: nroComprobanteInterno,
            detalle: recibo.concepto,
            idFormaPago,
            idDestinoGasto,
            idRecibo: recibo.id,
            debe: 0,
            haber: monto,
            saldo: 0,
            usuarioRegistro: user.usuario,
          }),
        );
        await this.recalcularKardex(manager, kardex.id);
        idMovimientoKardex = mov.id;
      }

      await manager.save(
        manager.create(ReciboDetalle, {
          idRecibo: recibo.id,
          destino: detalleDto.destino,
          idPersona:
            detalleDto.destino === 'PERSONAL' ? String(detalleDto.idPersona) : null,
          idActorProductivoMinero:
            detalleDto.destino === 'ACTOR'
              ? String(detalleDto.idActorProductivoMinero)
              : null,
          monto,
          idMovimientoKardex,
          usuarioRegistro: user.usuario,
        }),
      );
    }

    // Movimientos en la caja de flujo (Caja id=1, "CAJA PRINCIPAL"), el
    // registro maestro de la empresa. La porción aplicada a kardex
    // (PERSONAL + ACTOR) siempre representa valor recuperado por la
    // empresa -> INGRESO. La porción EFECTIVO es dinero que realmente
    // sale -> EGRESO. Un mismo recibo puede generar los dos a la vez
    // (independiente de si el recibo en sí es de tipo INGRESO o EGRESO).
    const montoKardex = this.r2(
      detalles
        .filter((d) => d.destino === 'PERSONAL' || d.destino === 'ACTOR')
        .reduce((s, d) => s + Number(d.monto), 0),
    );
    const montoEfectivo = this.r2(
      detalles
        .filter((d) => d.destino === 'EFECTIVO')
        .reduce((s, d) => s + Number(d.monto), 0),
    );

    const datosBaseCaja = {
      moneda: MONEDA_RECIBO,
      fecha: recibo.fecha,
      nroComprobante: nroComprobanteInterno,
      idFormaPago,
      idPersona: recibo.idPersona,
      nombresApellidos: recibo.nombresApellidos,
      concepto: recibo.concepto,
      idDestinoGasto,
      idRecibo: recibo.id,
    };

    if (montoKardex > 0) {
      await this.movimientoCajaService.crearMovimientoEnTransaccion(
        manager,
        cajaEmpresa,
        { ...datosBaseCaja, ingreso: montoKardex, egreso: 0 },
        user,
      );
    }

    if (montoEfectivo > 0) {
      await this.movimientoCajaService.crearMovimientoEnTransaccion(
        manager,
        cajaEmpresa,
        { ...datosBaseCaja, ingreso: 0, egreso: montoEfectivo },
        user,
      );
    }
  }

  // ------------------------------------------------------------------ CRUD
  /**
   * Sin `detalles`: crea el recibo como BORRADOR (solo cabecera).
   * Con `detalles`: crea y procesa el recibo en el mismo paso (PROCESADO).
   */
  async generar(dto: CreateReciboDto, user: Usuario): Promise<Recibo> {
    const { idFormaPago, idDestinoGasto, idCuentaBancaria } =
      await this.validarCabecera(dto);
    const beneficiario = await this.resolverBeneficiario(dto);
    const serie = this.serieDeTipo(dto.tipo);

    const tieneDetalles = !!dto.detalles && dto.detalles.length > 0;
    const previo = tieneDetalles
      ? await this.validarYPrepararDetalles(dto.montoTotal, dto.detalles)
      : null;

    return this.dataSource.transaction(async (manager) => {
      const numero = await this.siguienteNumero(manager, serie);

      const recibo = await manager.save(
        manager.create(Recibo, {
          tipo: dto.tipo,
          serie,
          numero,
          fecha: dto.fecha,
          montoTotal: this.r2(Number(dto.montoTotal)),
          concepto: dto.concepto.trim(),
          idFormaPago,
          idCuentaBancaria,
          nroComprobante: dto.nroComprobante?.trim() || null,
          idPersona: beneficiario.idPersona,
          idActorProductivoMinero: beneficiario.idActorProductivoMinero,
          nombresApellidos: beneficiario.nombresApellidos,
          idDestinoGasto,
          estado: tieneDetalles ? 'PROCESADO' : 'BORRADOR',
          usuarioRegistro: user.usuario,
        }),
      );

      if (tieneDetalles) {
        await this.procesarDetalles(
          manager,
          recibo,
          dto.detalles,
          idFormaPago,
          idDestinoGasto,
          previo.cajaEmpresa,
          previo.kardexPorDetalle,
          user,
        );
      }

      return manager.findOne(Recibo, {
        where: { id: recibo.id },
        relations: RELACIONES,
      });
    });
  }

  /**
   * Segundo paso de un recibo BORRADOR: postea las líneas de kardex y los
   * movimientos de caja de flujo, y lo deja PROCESADO (terminal). Los
   * campos de pago bancario son opcionales: si no se envían, se conserva lo
   * que ya tenía el recibo desde que se creó como borrador.
   */
  async procesar(
    id: string,
    dto: ProcesarReciboDto,
    user: Usuario,
  ): Promise<Recibo> {
    const recibo = await this.reciboRepository.findOne({ where: { id } });
    if (!recibo) {
      throw new NotFoundException('No se encontró el recibo solicitado.');
    }
    if (recibo.estado !== 'BORRADOR') {
      throw new BadRequestException(
        `El recibo no se puede procesar: está ${recibo.estado === 'PROCESADO' ? 'ya procesado' : 'anulado'}.`,
      );
    }

    const idFormaPago = dto.idFormaPago
      ? await this.resolverIdFormaPagoOpcional(dto.idFormaPago)
      : (recibo.idFormaPago ?? null);
    const idCuentaBancaria = dto.idCuentaBancaria
      ? await this.resolverIdCuentaBancariaOpcional(dto.idCuentaBancaria)
      : (recibo.idCuentaBancaria ?? null);
    const idDestinoGasto = dto.idDestinoGasto
      ? await this.resolverIdDestinoGasto(dto.idDestinoGasto)
      : (recibo.idDestinoGasto ?? null);
    const nroComprobante = dto.nroComprobante?.trim() || recibo.nroComprobante || null;

    const previo = await this.validarYPrepararDetalles(
      recibo.montoTotal,
      dto.detalles,
    );

    return this.dataSource.transaction(async (manager) => {
      await manager.update(Recibo, recibo.id, {
        idFormaPago,
        idCuentaBancaria,
        nroComprobante,
        idDestinoGasto,
        estado: 'PROCESADO',
        usuarioUltimaModificacion: user.usuario,
      });

      const reciboActualizado: Recibo = Object.assign(recibo, {
        idFormaPago,
        idCuentaBancaria,
        nroComprobante,
        idDestinoGasto,
      });

      await this.procesarDetalles(
        manager,
        reciboActualizado,
        dto.detalles,
        idFormaPago,
        idDestinoGasto,
        previo.cajaEmpresa,
        previo.kardexPorDetalle,
        user,
      );

      return manager.findOne(Recibo, {
        where: { id: recibo.id },
        relations: RELACIONES,
      });
    });
  }

  /**
   * Anula un recibo BORRADOR (nunca uno PROCESADO: no hay nada que revertir
   * en kardex/caja porque un borrador todavía no generó movimientos).
   */
  async anular(id: string, user: Usuario): Promise<Recibo> {
    const recibo = await this.reciboRepository.findOne({ where: { id } });
    if (!recibo) {
      throw new NotFoundException('No se encontró el recibo solicitado.');
    }
    if (recibo.estado !== 'BORRADOR') {
      throw new BadRequestException(
        recibo.estado === 'PROCESADO'
          ? 'No se puede anular un recibo ya procesado.'
          : 'El recibo ya está anulado.',
      );
    }

    await this.reciboRepository.update(recibo.id, {
      estado: 'ANULADO',
      usuarioUltimaModificacion: user.usuario,
    });

    return this.reciboRepository.findOne({
      where: { id: recibo.id },
      relations: RELACIONES,
    });
  }

  async listar(filtro: FiltrosReciboDto): Promise<ReciboPaginadoDto> {
    const {
      page = 1,
      limit = 10,
      tipo,
      idPersona,
      estado,
      fechaDesde,
      fechaHasta,
      busqueda,
      orderBy = 'fecha',
      orderDirection = 'DESC',
    } = filtro;

    const qb = this.reciboRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.persona', 'persona')
      .leftJoinAndSelect('r.formaPago', 'formaPago');

    if (tipo) {
      qb.andWhere('r.tipo = :tipo', { tipo });
    }
    if (idPersona) {
      qb.andWhere('r.idPersona = :idPersona', { idPersona });
    }
    if (estado) {
      qb.andWhere('r.estado = :estado', { estado });
    }
    if (fechaDesde) {
      qb.andWhere('r.fecha >= :desde', { desde: fechaDesde });
    }
    if (fechaHasta) {
      qb.andWhere('r.fecha <= :hasta', { hasta: fechaHasta });
    }
    if (busqueda) {
      qb.andWhere(
        `(
          r.concepto ILIKE :busqueda
          OR r.nombresApellidos ILIKE :busqueda
          OR persona.nombres ILIKE :busqueda
          OR persona.apellidoPaterno ILIKE :busqueda
          OR persona.apellidoMaterno ILIKE :busqueda
          OR (r.serie || '-' || LPAD(r.numero::text, 4, '0')) ILIKE :busqueda
        )`,
        { busqueda: `%${busqueda}%` },
      );
    }

    aplicarOrden(
      qb,
      {
        id: 'r.id',
        numero: 'r.numero',
        fecha: 'r.fecha',
        montoTotal: 'r.montoTotal',
      },
      orderBy,
      orderDirection,
    );
    qb.addOrderBy('r.id', orderDirection);

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

  async buscarPorId(id: string): Promise<Recibo> {
    const recibo = await this.reciboRepository.findOne({
      where: { id },
      relations: RELACIONES,
    });
    if (!recibo) {
      throw new NotFoundException('No se encontró el recibo solicitado.');
    }
    return recibo;
  }
}
