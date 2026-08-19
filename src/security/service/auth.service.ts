import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';
import { UsuarioService } from './usuario.service';
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../entities/rol.entity';
import { Persona } from '../entities/persona.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { LoginUsuarioDto } from '../dto/auth/login-usuario.dto';
import { JwtPayload } from '../models/interfaces/jwt-payload';
import { ConfigService } from '@nestjs/config';
import { hashToken } from '../helpers/token.helpers';
import { BitacoraAccesoService } from './bitacora-acceso.service';
import { TipoEventoBitacora } from '../enums/tipo-evento-bitacora';

// Máximo de intentos fallidos de login antes de bloquear temporalmente la cuenta.
const MAX_INTENTOS_FALLIDOS = 5;
// Duración del bloqueo temporal por intentos fallidos.
const MINUTOS_BLOQUEO = 15;

export interface SolicitudMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario, 'ci')
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol, 'ci')
    private readonly rolRepository: Repository<Rol>,
    private readonly jwtService: JwtService,
    @InjectRepository(Persona, 'ci')
    private readonly personaRepository: Repository<Persona>,
    @InjectRepository(RefreshToken, 'ci')
    private readonly refreshTokenRepository: Repository<RefreshToken>,

    private readonly $usuario: UsuarioService,

    private readonly $config: ConfigService,

    private readonly $bitacora: BitacoraAccesoService,
  ) {}

  async login(
    loginUsuarioDto: LoginUsuarioDto,
    meta?: SolicitudMeta,
  ): Promise<{
    //ciudadania: boolean;
    user: Usuario;
    token: string;
    refreshToken: string;
  }> {
    const { usuario, contrasena } = loginUsuarioDto;
    // console.log(loginUsuarioDto);
    const userLogged: Usuario = await this.usuarioRepository.findOne({
      where: { usuario: usuario },
      select: {
        usuario: true,
        contrasena: true,
        id: true,
        bloqueadoHasta: true,
        intentosFallidos: true,
      },
    });
    if (!userLogged) {
      await this.$bitacora.registrar({
        usuarioIngresado: usuario,
        tipoEvento: TipoEventoBitacora.LOGIN_FALLIDO_USUARIO,
        descripcion: 'El usuario no existe',
        exitoso: false,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
      throw new BadRequestException('Credenciales no válidas (Usuario)');
    }

    if (userLogged.bloqueadoHasta && userLogged.bloqueadoHasta > new Date()) {
      const minutosRestantes = Math.ceil(
        (userLogged.bloqueadoHasta.getTime() - Date.now()) / 60000,
      );
      await this.$bitacora.registrar({
        idUsuario: userLogged.id,
        usuarioIngresado: usuario,
        tipoEvento: TipoEventoBitacora.LOGIN_BLOQUEADO,
        descripcion: `Cuenta bloqueada, faltan ${minutosRestantes} minuto(s)`,
        exitoso: false,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
      throw new ForbiddenException(
        `Cuenta bloqueada temporalmente por intentos fallidos. Intente nuevamente en ${minutosRestantes} minuto(s).`,
      );
    }

    if (!bcrypt.compareSync(contrasena, userLogged.contrasena)) {
      const seBloqueo = await this.registrarIntentoFallido(userLogged);
      await this.$bitacora.registrar({
        idUsuario: userLogged.id,
        usuarioIngresado: usuario,
        tipoEvento: seBloqueo
          ? TipoEventoBitacora.CUENTA_BLOQUEADA
          : TipoEventoBitacora.LOGIN_FALLIDO_CONTRASENA,
        descripcion: seBloqueo
          ? `Cuenta bloqueada por ${MINUTOS_BLOQUEO} minutos tras ${MAX_INTENTOS_FALLIDOS} intentos fallidos`
          : 'Contraseña incorrecta',
        exitoso: false,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
      throw new BadRequestException('Credenciales no válidas (Contraseña)');
    }

    if (userLogged.intentosFallidos || userLogged.bloqueadoHasta) {
      await this.usuarioRepository.update(userLogged.id, {
        intentosFallidos: 0,
        bloqueadoHasta: null,
      });
    }

    delete userLogged.contrasena;
    delete userLogged.intentosFallidos;
    delete userLogged.bloqueadoHasta;

    const { token, refreshToken } = await this.getJwtTokens(
      { id: userLogged.id },
      meta,
    );

    await this.$bitacora.registrar({
      idUsuario: userLogged.id,
      usuarioIngresado: usuario,
      tipoEvento: TipoEventoBitacora.LOGIN_EXITOSO,
      exitoso: true,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      user: userLogged,
      token,
      refreshToken,
    };
  }

  /**
   * Registra un intento fallido de login. Al llegar a `MAX_INTENTOS_FALLIDOS`
   * bloquea la cuenta por `MINUTOS_BLOQUEO` minutos y reinicia el contador.
   * Devuelve `true` si este intento fue el que gatilló el bloqueo.
   */
  private async registrarIntentoFallido(usuario: Usuario): Promise<boolean> {
    const intentos = (usuario.intentosFallidos ?? 0) + 1;

    if (intentos >= MAX_INTENTOS_FALLIDOS) {
      await this.usuarioRepository.update(usuario.id, {
        intentosFallidos: 0,
        bloqueadoHasta: new Date(Date.now() + MINUTOS_BLOQUEO * 60_000),
      });
      return true;
    }

    await this.usuarioRepository.update(usuario.id, {
      intentosFallidos: intentos,
    });
    return false;
  }

  /**
   * Firma un nuevo par de tokens y persiste el refresh token (hasheado) en
   * `refresh_token` para poder revocarlo/rotarlo más adelante.
   */
  public async getJwtTokens(
    payload: JwtPayload,
    meta?: SolicitudMeta,
  ): Promise<{
    token: string;
    refreshToken: string;
  }> {
    const token = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.$config.get('JWT_SECRET_REFRESH'),
      expiresIn: this.$config.get('JWT_EXPIRATION_REFRESH'),
    });

    const { exp } = this.jwtService.decode<{ exp: number }>(refreshToken);

    const registro = this.refreshTokenRepository.create({
      idUsuario: payload.id,
      tokenHash: hashToken(refreshToken),
      fechaExpiracion: new Date(exp * 1000),
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    await this.refreshTokenRepository.save(registro);

    return { token, refreshToken };
  }

  /**
   * Rota el refresh token: valida que el token presentado siga activo y no
   * revocado en BD, lo marca como usado/revocado y emite un par nuevo. Si el
   * mismo refresh token se presenta dos veces (por ejemplo, uno robado que ya
   * fue usado por el dueño legítimo), la segunda vez falla porque ya quedó
   * revocado la primera vez.
   */
  public async refrescarTokens(
    user: Usuario,
    refreshTokenActual: string,
    meta?: SolicitudMeta,
  ): Promise<{ token: string; refreshToken: string }> {
    const tokenHash = hashToken(refreshTokenActual);

    const registro = await this.refreshTokenRepository.findOne({
      where: { tokenHash, idUsuario: user.id },
    });

    if (!registro || !registro.activo || registro.revocado) {
      throw new UnauthorizedException(
        'El token de actualización no es válido o ya fue utilizado',
      );
    }

    if (registro.fechaExpiracion < new Date()) {
      throw new UnauthorizedException('El token de actualización ha expirado');
    }

    await this.refreshTokenRepository.update(registro.id, {
      activo: false,
      revocado: true,
      fechaRevocacion: new Date(),
    });

    return this.getJwtTokens({ id: user.id }, meta);
  }

  /**
   * Cierra sesión revocando el refresh token presentado. Es idempotente: si
   * ya estaba revocado o no existe, igual responde éxito.
   */
  public async cerrarSesion(
    idUsuario: string,
    refreshTokenActual: string,
    meta?: SolicitudMeta,
  ): Promise<{ message: string }> {
    const tokenHash = hashToken(refreshTokenActual);

    await this.refreshTokenRepository.update(
      { tokenHash, idUsuario },
      {
        activo: false,
        revocado: true,
        fechaRevocacion: new Date(),
      },
    );

    await this.$bitacora.registrar({
      idUsuario,
      tipoEvento: TipoEventoBitacora.LOGOUT,
      exitoso: true,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { message: 'Sesión cerrada correctamente' };
  }

  public async getUserById(id: string): Promise<Usuario> {
    const user = await this.usuarioRepository.findOneBy({ id });
    if (user) return user;
    throw new NotFoundException('No se ha encontrado al usuario');
  }
}
