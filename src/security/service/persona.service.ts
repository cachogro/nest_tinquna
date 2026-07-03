import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from '../entities/persona.entity';
import { CreatePersonaDto } from '../dto/create-persona.dto';
import { UpdatePersonaDto } from '../dto/update-persona.dto';
import { Usuario } from '../entities/usuario.entity';

@Injectable()
export class PersonaService {
  constructor(
    @InjectRepository(Persona, 'ci')
    private readonly personaRepository: Repository<Persona>,
  ) {}

async create(createPersonaDto: CreatePersonaDto, user: Usuario) {
  try {
    // Validar duplicados
    if (createPersonaDto.numeroDocumento) {
      await this.existeNumeroDocumento(createPersonaDto.numeroDocumento); // lanza ConflictException
    }
    if (createPersonaDto.correoElectronico) {
      await this.existeCorreo(createPersonaDto.correoElectronico);
    }

    const nuevaPersona = this.personaRepository.create({
      usuarioRegistro: user.usuario,
      ...createPersonaDto,
    });

    return await this.personaRepository.save(nuevaPersona);
  } catch (error) {
    // Si ya es una excepción controlada, relanzar
    if (error instanceof ConflictException) {
      throw error;
    }
    throw new ConflictException(`Error al crear la persona: ${error}`);
  }
}

   async update(id: string, updatePersonaDto: UpdatePersonaDto, user: Usuario) {
    try {
      // 1. Cargar la entidad existente con preload
      const personaActualizada = await this.personaRepository.preload({
        id,
        ...updatePersonaDto,
        usuarioUltimaModificacion: user.usuario,
      });

      if (!personaActualizada) {
        throw new NotFoundException(`La persona con el id: ${id} no existe`);
      }
      // 2. Validar duplicados si se está intentando cambiar el documento o correo
      const personaExistente = await this.findOne(id); // para comparar valores antiguos (opcional)
      if (
        updatePersonaDto.numeroDocumento &&
        updatePersonaDto.numeroDocumento !== personaExistente.numeroDocumento
      ) {
        await this.existeNumeroDocumento(updatePersonaDto.numeroDocumento);
      }
      if (
        updatePersonaDto.correoElectronico &&
        updatePersonaDto.correoElectronico !==
          personaExistente.correoElectronico
      ) {
        await this.existeCorreo(updatePersonaDto.correoElectronico);
      }

      // 3. Guardar la entidad actualizada
      return await this.personaRepository.save(personaActualizada);
    } catch (error) {
      // Manejar errores específicos (duplicados, not found, etc.)
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error interno al actualizar la persona',
      );
    }
  }



  async findAll(): Promise<Persona[]> {
    return await this.personaRepository.find({
      where: { activo: true },
      order: { id: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Persona> {
    const persona = await this.personaRepository.findOne({
      where: { id, activo: true },
    });

    if (!persona) {
      throw new NotFoundException(
        `La persona con ID ${id} no existe o fue dada de baja`,
      );
    }

    return persona;
  }

 

  async remove(id: string): Promise<{ message: string }> {
    const persona = await this.findOne(id);
    // Eliminación lógica usando el método softRemove de TypeORM.
    await this.personaRepository.softRemove(persona);

    return { message: `Persona con ID ${id} eliminada lógicamente con éxito` };
  }

  async existeNumeroDocumento(numeroDocumento: string): Promise<any> {
    const existe = await this.personaRepository.findOne({
      where: { numeroDocumento, activo: true },
    });
    if (existe) {
      throw new ConflictException(
        `El número de documento '${numeroDocumento}' ya está registrado en el sistema`,
      );
    }
    return existe;
  }

  async existeCorreo(correoElectronico: string): Promise<void> {
    const existe = await this.personaRepository.findOne({
      where: { correoElectronico, activo: true },
    });
    if (existe) {
      throw new ConflictException(
        `El correo electrónico '${correoElectronico}' ya está registrado en el sistema`,
      );
    }
  }
}
