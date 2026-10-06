import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormaPago } from '../entities/forma-pago.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreateFormaPagoDto } from '../dto/forma-pago/create-forma-pago.dto';
import { UpdateFormaPagoDto } from '../dto/forma-pago/update-forma-pago.dto';

@Injectable()
export class FormaPagoService {
  constructor(
    @InjectRepository(FormaPago, 'ci')
    private readonly formaPagoRepository: Repository<FormaPago>,
  ) {}

  private async obtenerFormaPago(id: number): Promise<FormaPago> {
    const formaPago = await this.formaPagoRepository.findOne({
      where: {
        id,
      },
    });

    if (!formaPago) {
      throw new NotFoundException(
        'No se encontró la forma de pago solicitada.',
      );
    }

    return formaPago;
  }

  // El POST recibe "crear o actualizar" en un mismo body, así que el
  // ValidationPipe no aplica los decoradores del DTO: se valida aquí.
  private normalizarTexto(
    valor: unknown,
    campo: string,
    max: number,
    patron?: RegExp,
  ): string {
    const texto = typeof valor === 'string' ? valor.trim().toUpperCase() : '';

    if (texto.length < 2 || texto.length > max) {
      throw new BadRequestException(
        `El ${campo} es obligatorio y debe tener entre 2 y ${max} caracteres.`,
      );
    }
    if (patron && !patron.test(texto)) {
      throw new BadRequestException(
        `El ${campo} solo admite letras, números y guion bajo.`,
      );
    }

    return texto;
  }

  async create(
    createFormaPagoDto: CreateFormaPagoDto,
    user: Usuario,
  ): Promise<FormaPago> {
    const codigo = this.normalizarTexto(
      createFormaPagoDto.codigo,
      'código',
      20,
      /^[A-Z0-9_]+$/,
    );
    const nombre = this.normalizarTexto(createFormaPagoDto.nombre, 'nombre', 40);

    const existe = await this.formaPagoRepository.findOne({
      where: { codigo },
    });

    if (existe) {
      throw new ConflictException(
        `Ya existe una forma de pago registrada con el código "${codigo}".`,
      );
    }

    const formaPago = this.formaPagoRepository.create({
      codigo,
      nombre,
      afectaFondo: createFormaPagoDto.afectaFondo !== false,
      usuarioRegistro: user.usuario,
    });

    return await this.formaPagoRepository.save(formaPago);
  }

  // El código no se actualiza: recibos, pagos de valorización y bienes en
  // dación deciden por código si la forma de pago exige cuenta bancaria.
  async update(
    updateFormaPagoDto: UpdateFormaPagoDto,
    user: Usuario,
  ): Promise<FormaPago> {
    const nombre = this.normalizarTexto(updateFormaPagoDto.nombre, 'nombre', 40);
    const formaPago = await this.obtenerFormaPago(Number(updateFormaPagoDto.id));

    formaPago.nombre = nombre;
    if (typeof updateFormaPagoDto.afectaFondo === 'boolean') {
      formaPago.afectaFondo = updateFormaPagoDto.afectaFondo;
    }
    formaPago.usuarioUltimaModificacion = user.usuario;

    return await this.formaPagoRepository.save(formaPago);
  }

  async cambiarEstado(
    id: number,
    estado: boolean,
    user: Usuario,
  ): Promise<FormaPago> {
    const formaPago = await this.obtenerFormaPago(id);

    formaPago.activo = estado;
    formaPago.usuarioUltimaModificacion = user.usuario;

    return await this.formaPagoRepository.save(formaPago);
  }

  /** Activas e inactivas: es el listado del panel de paramétricas. */
  async findAllFormaPago(): Promise<FormaPago[]> {
    return await this.formaPagoRepository.find({
      order: {
        id: 'ASC',
      },
    });
  }
}
