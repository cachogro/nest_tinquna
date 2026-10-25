import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EscalaPrecioMineral } from '../entities/escala-precio-mineral.entity';
import { Mineral } from '../entities/mineral.entity';
import { CreateEscalaPrecioMineralDto } from '../dto/escala-precio-mineral/create-escala-precio-mineral.dto';
import { UpdateEscalaPrecioMineralDto } from '../dto/escala-precio-mineral/update-escala-precio-mineral.dto';
import { Usuario } from 'src/security/entities/usuario.entity';
import { validarFechaMinimaPrecios } from '../precios-fecha-minima.util';

// Bolivia no tiene horario de verano: el offset respecto a UTC es siempre -04:00.
const OFFSET_BOLIVIA = '-04:00';

@Injectable()
export class EscalaPrecioMineralService {
  constructor(
    @InjectRepository(EscalaPrecioMineral, 'ci')
    private readonly escalaPrecioRepository: Repository<EscalaPrecioMineral>,

    @InjectRepository(Mineral, 'ci')
    private readonly mineralRepository: Repository<Mineral>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Crea en bloque todos los tramos de ley de un mineral que comparten la
   * misma vigencia (idMineral, fechaVigenciaInicial y fechaVigenciaFinal son
   * un solo valor para toda la carga; cada fila solo aporta
   * ley/precioPunto/precioTm).
   *
   * Si el mineral ya tiene una tabla activa que empieza el mismo día, esa
   * tabla se desactiva (activo=false) completa y queda reemplazada por la
   * nueva. Las tablas de otros días no se tocan.
   */
  async create(
    createDto: CreateEscalaPrecioMineralDto,
    user: Usuario,
  ): Promise<EscalaPrecioMineral[]> {
    const mineral = await this.mineralRepository.findOne({
      where: { id: String(createDto.idMineral), activo: true },
    });

    if (!mineral) {
      throw new NotFoundException(
        'No existe el mineral seleccionado o se encuentra inactivo.',
      );
    }

    validarFechaMinimaPrecios(this.diaBolivia(createDto.fechaVigenciaInicial));

    if (
      createDto.fechaVigenciaFinal &&
      new Date(createDto.fechaVigenciaFinal) <=
        new Date(createDto.fechaVigenciaInicial)
    ) {
      throw new BadRequestException(
        'La fecha de vigencia final no puede ser menor o igual a la fecha de vigencia inicial.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock por mineral: serializa cargas concurrentes de la tabla de un mismo mineral.
      await queryRunner.manager.query('SELECT pg_advisory_xact_lock($1)', [
        createDto.idMineral,
      ]);

      const tramosExistentes = await queryRunner.manager
        .createQueryBuilder(EscalaPrecioMineral, 'escala')
        .setLock('pessimistic_write')
        .where('escala.id_mineral = :idMineral', {
          idMineral: createDto.idMineral,
        })
        .andWhere('escala.activo = true')
        .getMany();

      // Sin control de vigencias por ahora (migración): una tabla aplica
      // desde su día de vigencia inicial hasta que haya otra con fecha
      // posterior (ver findVigenteByMineral). Solo se reemplaza la tabla que
      // empieza el MISMO día; las de otros días quedan intactas, para poder
      // seguir valorizando las recepciones de esas fechas.
      const diaNuevo = this.diaBolivia(createDto.fechaVigenciaInicial);
      const tramosASuperar = tramosExistentes.filter(
        (t) => this.diaBolivia(t.fechaVigenciaInicial) === diaNuevo,
      );

      if (tramosASuperar.length) {
        for (const tramo of tramosASuperar) {
          tramo.activo = false;
          tramo.usuarioUltimaModificacion = user.usuario;
        }
        await queryRunner.manager.save(tramosASuperar);
      }

      const nuevas = createDto.filas.map((fila) =>
        queryRunner.manager.create(EscalaPrecioMineral, {
          idMineral: createDto.idMineral,
          ley: fila.ley,
          precioPunto: fila.precioPunto,
          precioTm: fila.precioTm,
          fechaVigenciaInicial: createDto.fechaVigenciaInicial,
          fechaVigenciaFinal: createDto.fechaVigenciaFinal,
          usuarioRegistro: user.usuario,
        }),
      );

      const guardadas = await queryRunner.manager.save(nuevas);
      await queryRunner.commitTransaction();
      return guardadas;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Actualiza en bloque uno o varios tramos, identificados cada uno por su "id".
   */
  async update(
    updateDto: UpdateEscalaPrecioMineralDto,
    user: Usuario,
  ): Promise<EscalaPrecioMineral[]> {
    const ids = updateDto.filas.map((f) => f.id);
    const tramos = await this.escalaPrecioRepository.find({
      where: { id: In(ids), activo: true },
    });

    if (tramos.length !== ids.length) {
      const encontrados = new Set(tramos.map((t) => t.id));
      const faltantes = ids.filter((id) => !encontrados.has(id));
      throw new NotFoundException(
        `No se encontraron los tramos con id: ${faltantes.join(', ')}.`,
      );
    }

    const tramosPorId = new Map(tramos.map((t) => [t.id, t]));

    // Sin control de vigencias por ahora (migración): se puede corregir
    // cualquier tramo activo, también los de tablas de días pasados.
    for (const fila of updateDto.filas) {
      const tramo = tramosPorId.get(fila.id)!;

      tramo.usuarioUltimaModificacion = user.usuario;
      if (fila.ley !== undefined) tramo.ley = fila.ley;
      if (fila.precioPunto !== undefined) tramo.precioPunto = fila.precioPunto;
      if (fila.precioTm !== undefined) tramo.precioTm = fila.precioTm;
      if (fila.fechaVigenciaInicial !== undefined) {
        validarFechaMinimaPrecios(this.diaBolivia(fila.fechaVigenciaInicial));
        tramo.fechaVigenciaInicial = new Date(fila.fechaVigenciaInicial);
      }
      if (fila.fechaVigenciaFinal !== undefined)
        tramo.fechaVigenciaFinal = new Date(fila.fechaVigenciaFinal);

      if (
        tramo.fechaVigenciaFinal &&
        new Date(tramo.fechaVigenciaFinal) <= new Date(tramo.fechaVigenciaInicial)
      ) {
        throw new BadRequestException(
          `El tramo con id ${fila.id}: la fecha de vigencia final no puede ser menor o igual a la inicial.`,
        );
      }
    }

    return await this.escalaPrecioRepository.save(tramos);
  }

  /**
   * Tabla de precios que aplica a un mineral en una fecha (YYYY-MM-DD, hora
   * de Bolivia; sin fecha, hoy): la activa más reciente cuya vigencia
   * inicial no pase del fin de ese día, con todos sus tramos (los que
   * empiezan ese mismo día), ordenados por ley. La vigencia final no se
   * controla por ahora (migración): rige hasta que se registre otra tabla
   * con fecha posterior.
   */
  async findVigenteByMineral(
    idMineral: number,
    fecha?: string,
  ): Promise<EscalaPrecioMineral[]> {
    const limite = fecha ? this.finDeDiaBolivia(fecha) : new Date();

    if (isNaN(limite.getTime())) {
      throw new BadRequestException('La fecha indicada no es válida.');
    }

    const ultima = await this.escalaPrecioRepository
      .createQueryBuilder('escala')
      .where('escala.idMineral = :idMineral', { idMineral })
      .andWhere('escala.activo = true')
      .andWhere('escala.fechaVigenciaInicial <= :limite', { limite })
      .orderBy('escala.fechaVigenciaInicial', 'DESC')
      .getOne();

    if (!ultima) {
      throw new NotFoundException(
        fecha
          ? 'El mineral no tiene una tabla de precios registrada a la fecha indicada o antes.'
          : 'El mineral no tiene una tabla de precios registrada.',
      );
    }

    // Todos los tramos de esa tabla: los activos que empiezan el mismo día.
    const dia = this.diaBolivia(ultima.fechaVigenciaInicial);
    return await this.escalaPrecioRepository
      .createQueryBuilder('escala')
      .where('escala.idMineral = :idMineral', { idMineral })
      .andWhere('escala.activo = true')
      .andWhere('escala.fechaVigenciaInicial >= :desde', {
        desde: this.inicioDeDiaBolivia(dia),
      })
      .andWhere('escala.fechaVigenciaInicial <= :hasta', {
        hasta: this.finDeDiaBolivia(dia),
      })
      .orderBy('escala.ley', 'ASC')
      .getMany();
  }

  /**
   * Tablas activas registradas de un mineral, una por día de vigencia
   * inicial (de la más nueva a la más vieja), con su cantidad de tramos.
   * Para elegir con qué tabla valorizar (ej. la actual en vez de la de la
   * fecha de recepción). Los tramos de cada una se piden con
   * findVigenteByMineral(idMineral, dia).
   */
  async listarTablasByMineral(idMineral: number): Promise<
    Array<{
      dia: string;
      fechaVigenciaInicial: Date;
      fechaVigenciaFinal: Date | null;
      tramos: number;
    }>
  > {
    const filas = await this.escalaPrecioRepository
      .createQueryBuilder('escala')
      .select(
        "to_char(escala.fechaVigenciaInicial AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')",
        'dia',
      )
      .addSelect('MIN(escala.fechaVigenciaInicial)', 'fechaVigenciaInicial')
      .addSelect('MAX(escala.fechaVigenciaFinal)', 'fechaVigenciaFinal')
      .addSelect('COUNT(*)', 'tramos')
      .where('escala.idMineral = :idMineral', { idMineral })
      .andWhere('escala.activo = true')
      .groupBy('dia')
      .orderBy('dia', 'DESC')
      .getRawMany<{
        dia: string;
        fechaVigenciaInicial: Date;
        fechaVigenciaFinal: Date | null;
        tramos: string;
      }>();
    return filas.map((f) => ({ ...f, tramos: Number(f.tramos) }));
  }

  /** Día calendario en Bolivia ("YYYY-MM-DD") de un instante o fecha ISO. */
  private diaBolivia(instante: Date | string): string {
    const bolivia = new Date(new Date(instante).getTime() - 4 * 3600 * 1000);
    return bolivia.toISOString().slice(0, 10);
  }

  /** Fin (23:59:59.999) de la fecha calendario en hora de Bolivia. */
  private finDeDiaBolivia(fecha: string): Date {
    return new Date(`${String(fecha).slice(0, 10)}T23:59:59.999${OFFSET_BOLIVIA}`);
  }

  /**
   * Convierte una fecha calendario ("YYYY-MM-DD") en el instante correspondiente
   * al inicio de ese día (00:00:00.000) en hora de Bolivia (UTC-4 fijo). Si ya
   * viene con hora/offset (ISO completo), se respeta tal cual.
   */
  private inicioDeDiaBolivia(fecha: string): Date {
    const esSoloFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
    return esSoloFecha
      ? new Date(`${fecha}T00:00:00.000${OFFSET_BOLIVIA}`)
      : new Date(fecha);
  }
}
