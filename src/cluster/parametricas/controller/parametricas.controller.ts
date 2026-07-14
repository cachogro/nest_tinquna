import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateCodificacionDto } from '../dto/create-codificacion.dto';
import { Codificacion } from '../entities/codificacion.entity';
import { CodificacionService } from '../services/codificacion.service';
import { Auth } from 'src/security/decorators';
import { UpdateCodificacionDto } from '../dto/update-codificacion.dto';
import {
  EmisionDocumentoResponseDto,
  TipoDocumentoResponseDto,
} from '../dto/parametrica-response.dto';
import { ParametricasService } from '../services/parametricas.service';
import { Mineral } from '../entities/mineral.entity';
import { PersonaTipo } from '../entities/persona-tipo.entity';

@ApiTags('Paramétrica - Codificación')
@Controller('parametricas')
export class ParametricasController {
  constructor(
    private readonly codificacionService: CodificacionService,
    private readonly parametricaService: ParametricasService,
  ) {}

  // @Post('codificacion')
  // @Auth()
  // @HttpCode(HttpStatus.CREATED)
  // @ApiOperation({
  //   summary: 'Registrar una nueva codificación',
  //   description:
  //     'Permite registrar una nueva codificación asociando uno o varios minerales existentes. El sistema valida que el código no exista previamente y que todos los minerales enviados correspondan a registros válidos. La información de los minerales se almacena como un JSON dentro de la codificación.',
  // })
  // @ApiBody({
  //   type: CreateCodificacionDto,
  //   description: 'Datos necesarios para registrar una nueva codificación.',
  //   examples: {
  //     ejemplo: {
  //       summary: 'Registro de una codificación',
  //       value: {
  //         codigo: 'BZI',
  //         nombre: 'PLATA Y ZINC',
  //         minerales: [1, 3],
  //       },
  //     },
  //   },
  // })
  // @ApiCreatedResponse({
  //   description: 'Codificación registrada correctamente.',
  //   type: Codificacion,
  // })
  // @ApiBadRequestResponse({
  //   description:
  //     'Los datos enviados son inválidos, el código ya existe o alguno de los minerales no existe.',
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'No autorizado. Token no proporcionado o inválido.',
  // })
  // @ApiConflictResponse({
  //   description: 'Ya existe una codificación registrada con el mismo código.',
  // })
  // @ApiInternalServerErrorResponse({
  //   description: 'Error interno del servidor.',
  // })
  // async create(
  //   @Body() createCodificacionDto: CreateCodificacionDto,
  // ): Promise<Codificacion> {
  //   return await this.codificacionService.create(createCodificacionDto);
  // }

  @Post('codificacion')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar una nueva codificación',
    description:
      'Permite registrar una nueva codificación asociando uno o varios minerales existentes.',
  })
  @ApiBody({
    type: CreateCodificacionDto,
    description: 'Datos necesarios para registrar una codificación.',
    examples: {
      ejemplo: {
        summary: 'Nueva codificación',
        value: {
          codigo: 'BZI',
          nombre: 'PLATA Y ZINC',
          minerales: [1, 3],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Codificación registrada correctamente.',
    type: Codificacion,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, código duplicado o minerales inexistentes.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiConflictResponse({
    description: 'Ya existe una codificación con ese código.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async create(
    @Body() createCodificacionDto: CreateCodificacionDto,
  ): Promise<Codificacion> {
    return await this.codificacionService.create(createCodificacionDto);
  }

  @Put('codificacion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar una codificación',
    description:
      'Actualiza una codificación existente utilizando el identificador enviado en el cuerpo de la petición.',
  })
  @ApiBody({
    type: UpdateCodificacionDto,
    description: 'Datos de la codificación a actualizar.',
    examples: {
      ejemplo: {
        summary: 'Actualizar codificación',
        value: {
          id: '1',
          codigo: 'BZI',
          nombre: 'PLATA Y ZINC',
          minerales: [1, 3],
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Codificación actualizada correctamente.',
    type: Codificacion,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, código duplicado o minerales inexistentes.',
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async update(
    @Body() updateCodificacionDto: UpdateCodificacionDto,
  ): Promise<Codificacion> {
    return await this.codificacionService.update(updateCodificacionDto);
  }

  @Get('allCodificacion')
  // @Auth()
  @ApiOperation({
    summary: 'Obtener todas las codificaciones',
    description:
      'Retorna una lista completa de las codificaciones registradas en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de codificaciones obtenida exitosamente.',
    type: [Codificacion],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllCodificaciones(): Promise<Codificacion[]> {
    return await this.codificacionService.findAllCodificaciones();
  }


  
  @Get('tiposDocumento')
  // @Auth()
  @ApiOperation({
    summary: 'Obtener todos los tipos de documento',
    description:
      'Retorna una lista completa de los tipos de documento registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tipos de documento obtenida exitosamente.',
    type: [TipoDocumentoResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllTipoDocumentos(): Promise<TipoDocumentoResponseDto[]> {
    return await this.parametricaService.findAllTipoDocumentos();
  }

  @Get('lugaresEmision')
  // @Auth()
  @ApiOperation({
    summary: 'Obtener todos los lugares de emisión',
    description:
      'Retorna una lista completa de los lugares de emisión registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de lugares de emisión obtenida exitosamente.',
    type: [EmisionDocumentoResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllLugaresEmision(): Promise<EmisionDocumentoResponseDto[]> {
    return await this.parametricaService.findAllLugaresEmision();
  }

  @Get('allMinerales')
  //@Auth()
  @ApiOperation({
    summary: 'Obtener todos los minerales',
    description:
      'Retorna una lista completa de los minerales registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de lugares de emisión obtenida exitosamente.',
    type: [Mineral],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllMinerales(): Promise<Mineral[]> {
    return await this.parametricaService.findAllMinerales();
  }

  @Get('allPersonaTipo')
  //@Auth()
  @ApiOperation({
    summary: 'Obtener todos los minerales',
    description:
      'Retorna una lista completa de los minerales registrados en el sistema.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de lugares de emisión obtenida exitosamente.',
    type: [PersonaTipo],
  })
  @ApiUnauthorizedResponse({
    description: 'No autorizado. Token no proporcionado o inválido.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor.',
  })
  async findAllPersinaTipo(): Promise<PersonaTipo[]> {
    return await this.parametricaService.findAllPersonaTipo();
  }


}
