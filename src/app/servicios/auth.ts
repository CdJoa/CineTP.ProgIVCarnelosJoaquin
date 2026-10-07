import { Injectable, signal, computed, inject } from '@angular/core';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { CredencialesLoginDto, RegistroUsuarioDto, Usuario } from '../models/usuario';
import { CuponesService } from './cupones';
import { SupabaseClientService } from './supabase-client';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private supabase: SupabaseClient = inject(SupabaseClientService).client;
  private cuponesService = inject(CuponesService);
  private perfilesEnCarga = new Map<string, Promise<Usuario>>();

  // Estados reactivos con Signals de Angular
  readonly usuarioActual = signal<Usuario | null>(null);
  readonly cargando = signal<boolean>(true);
  readonly estaAutenticado = computed(() => !!this.usuarioActual());

  constructor() {
    this.inicializarSesion();
  }

  get clienteSupabase(): SupabaseClient {
    return this.supabase;
  }

  private async inicializarSesion(): Promise<void> {
    try {
      this.cargando.set(true);
      const { data: { session } } = await this.supabase.auth.getSession();

      if (session?.user) {
        await this.cargarPerfil(session.user);
      } else {
        this.usuarioActual.set(null);
      }

      // Escuchar cambios de autenticación
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        if (!session?.user) {
          this.usuarioActual.set(null);
          return;
        }

        // The initial session and token refresh do not require another profile query.
        if (this.usuarioActual()?.id !== session.user.id || event === 'USER_UPDATED') {
          await this.cargarPerfil(session.user);
        }
      });
    } catch (err) {
      console.error('Error al inicializar sesión:', err);
      this.usuarioActual.set(null);
    } finally {
      this.cargando.set(false);
    }
  }

  private cargarPerfil(authUser: User): Promise<Usuario> {
    const existente = this.perfilesEnCarga.get(authUser.id);
    if (existente) return existente;

    const carga = this.consultarPerfil(authUser).finally(() => {
      this.perfilesEnCarga.delete(authUser.id);
    });
    this.perfilesEnCarga.set(authUser.id, carga);
    return carga;
  }

  private async consultarPerfil(authUser: User): Promise<Usuario> {
    try {
      const { data, error } = await this.supabase
        .from('usuarios')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (data && !error) {
        const usuario = this.mapearPerfil(authUser, data);
        this.usuarioActual.set(usuario);
        return usuario;
      }
    } catch (err) {
      console.warn('No se pudo cargar perfil de la base de datos, usando datos de auth:', err);
    }

    // Perfil por defecto con metadata de auth
    const usuarioFallback = this.mapearPerfil(authUser);
    this.usuarioActual.set(usuarioFallback);
    return usuarioFallback;
  }

  private mapearPerfil(authUser: User, perfil?: Record<string, any>): Usuario {
    const datos = perfil || authUser.user_metadata || {};
    return {
      id: authUser.id,
      email: datos['email'] || authUser.email || '',
      nombre: datos['nombre'] || '',
      apellido: datos['apellido'] || '',
      fechaNacimiento: datos['fecha_nacimiento'] || datos['fechaNacimiento'] || '',
      tipoSangre: datos['tipo_sangre'] || datos['tipoSangre'] || '',
      colorOjos: datos['color_ojos'] || datos['colorOjos'] || '',
      diasVacaciones:
        datos['dias_vacaciones'] !== undefined && datos['dias_vacaciones'] !== null
          ? Number(datos['dias_vacaciones'])
          : datos['diasVacaciones'] !== undefined && datos['diasVacaciones'] !== null
          ? Number(datos['diasVacaciones'])
          : undefined,
      rol: datos['rol'] || 'cliente',
      puntos: datos['puntos'] ?? 0,
      credito: datos['credito'] ?? 0,
      creadoEn: datos['creado_en'] || datos['creadoEn'],
    };
  }

  async login(credenciales: CredencialesLoginDto): Promise<{ exito: boolean; mensaje?: string; usuario?: Usuario }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credenciales.email.trim(),
        password: credenciales.password,
      });

      if (error) {
        return { exito: false, mensaje: this.traducirError(error.message) };
      }

      if (!data.user) {
        return { exito: false, mensaje: 'No se pudo obtener la información del usuario.' };
      }

      const usuario = await this.cargarPerfil(data.user);
      return { exito: true, usuario };
    } catch (err: any) {
      return { exito: false, mensaje: err?.message || 'Error inesperado al iniciar sesión.' };
    }
  }

  async registro(datos: RegistroUsuarioDto): Promise<{ exito: boolean; mensaje?: string; usuario?: Usuario }> {
    return this.crearUsuarioBase(datos, 'cliente', false);
  }

  async registrarEmpleado(datos: RegistroUsuarioDto): Promise<{ exito: boolean; mensaje?: string; usuario?: Usuario }> {
    return this.crearUsuarioBase(datos, 'empleado', true);
  }

  private async crearUsuarioBase(
    datos: RegistroUsuarioDto,
    rol: 'cliente' | 'empleado' | 'admin',
    preservarSesionActual: boolean
  ): Promise<{ exito: boolean; mensaje?: string; usuario?: Usuario }> {
    try {
      let sesionPrevia: any = null;
      if (preservarSesionActual) {
        const { data: { session } } = await this.supabase.auth.getSession();
        sesionPrevia = session;
      }

      const metadata: Record<string, any> = {
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        fechaNacimiento: datos.fechaNacimiento,
        rol,
        puntos: 0,
        credito: 0,
      };

      if (datos.tipoSangre) {
        metadata['tipo_sangre'] = datos.tipoSangre;
        metadata['tipoSangre'] = datos.tipoSangre;
      }
      if (datos.colorOjos) {
        metadata['color_ojos'] = datos.colorOjos;
        metadata['colorOjos'] = datos.colorOjos;
      }
      if (datos.diasVacaciones !== undefined && datos.diasVacaciones !== null) {
        metadata['dias_vacaciones'] = Number(datos.diasVacaciones);
        metadata['diasVacaciones'] = Number(datos.diasVacaciones);
      }

      const { data, error } = await this.supabase.auth.signUp({
        email: datos.email.trim(),
        password: datos.password,
        options: { data: metadata },
      });

      if (error) {
        return { exito: false, mensaje: this.traducirError(error.message) };
      }

      if (!data.user) {
        return { exito: false, mensaje: 'No se pudo completar el registro del usuario.' };
      }

      const nuevoUsuario = this.mapearPerfil(data.user, {
        ...metadata,
        email: datos.email.trim(),
        creadoEn: new Date().toISOString(),
      });

      try {
        const payloadUsuario: Record<string, any> = {
          id: nuevoUsuario.id,
          email: nuevoUsuario.email,
          nombre: nuevoUsuario.nombre,
          apellido: nuevoUsuario.apellido,
          fecha_nacimiento: nuevoUsuario.fechaNacimiento,
          rol: nuevoUsuario.rol,
          puntos: nuevoUsuario.puntos,
          credito: nuevoUsuario.credito,
        };

        if (nuevoUsuario.tipoSangre) {
          payloadUsuario['tipo_sangre'] = nuevoUsuario.tipoSangre;
        }
        if (nuevoUsuario.colorOjos) {
          payloadUsuario['color_ojos'] = nuevoUsuario.colorOjos;
        }
        if (nuevoUsuario.diasVacaciones !== undefined && nuevoUsuario.diasVacaciones !== null) {
          payloadUsuario['dias_vacaciones'] = nuevoUsuario.diasVacaciones;
        }

        const { error: insertError } = await this.supabase.from('usuarios').insert([payloadUsuario]);
        if (insertError) {
          console.warn('Inserción extendida falló en usuarios, reintentando inserción básica:', insertError);
          await this.supabase.from('usuarios').insert([{
            id: nuevoUsuario.id,
            email: nuevoUsuario.email,
            nombre: nuevoUsuario.nombre,
            apellido: nuevoUsuario.apellido,
            fecha_nacimiento: nuevoUsuario.fechaNacimiento,
            rol: nuevoUsuario.rol,
            puntos: nuevoUsuario.puntos,
            credito: nuevoUsuario.credito,
          }]);
        }

        // Asignar cupón de registro si es cliente
        if (rol === 'cliente') {
          await this.cuponesService.asignarCuponRegistro(nuevoUsuario.id);
        }
      } catch (dbError) {
        console.warn('Aviso: perfil guardado en Auth, tabla usuarios pendiente:', dbError);
      }

      if (preservarSesionActual && sesionPrevia) {
        await this.supabase.auth.setSession({
          access_token: sesionPrevia.access_token,
          refresh_token: sesionPrevia.refresh_token,
        });
      } else {
        this.usuarioActual.set(nuevoUsuario);
      }

      return { exito: true, usuario: nuevoUsuario };
    } catch (err: any) {
      return { exito: false, mensaje: err?.message || 'Error inesperado al registrar usuario.' };
    }
  }

  async logout(): Promise<{ exito: boolean; mensaje?: string }> {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        return { exito: false, mensaje: error.message };
      }
      this.usuarioActual.set(null);
      return { exito: true };
    } catch (err: any) {
      return { exito: false, mensaje: err?.message || 'Error al cerrar sesión.' };
    }
  }

  private traducirError(msg: string): string {
    if (msg.includes('Invalid login credentials')) {
      return 'Credenciales inválidas. Verifica tu correo y contraseña.';
    }
    if (msg.includes('Email already in use') || msg.includes('User already registered')) {
      return 'El correo electrónico ya se encuentra registrado.';
    }
    if (msg.includes('Password should be at least')) {
      return 'La contraseña debe contener al menos 6 caracteres.';
    }
    return msg;
  }
}

export { Auth as AuthService };
