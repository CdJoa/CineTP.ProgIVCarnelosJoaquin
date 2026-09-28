import { Injectable, signal, computed, inject } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../environments/environments';
import { CredencialesLoginDto, RegistroUsuarioDto, Usuario } from '../models/usuario';
import { CuponesService } from './cupones';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private supabase: SupabaseClient;
  private cuponesService = inject(CuponesService);

  // Estados reactivos con Signals de Angular
  readonly usuarioActual = signal<Usuario | null>(null);
  readonly cargando = signal<boolean>(true);
  readonly estaAutenticado = computed(() => !!this.usuarioActual());

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabasePublishableKey
    );

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
      this.supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await this.cargarPerfil(session.user);
        } else {
          this.usuarioActual.set(null);
        }
      });
    } catch (err) {
      console.error('Error al inicializar sesión:', err);
      this.usuarioActual.set(null);
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarPerfil(authUser: User): Promise<Usuario> {
    try {
      const { data, error } = await this.supabase
        .from('usuarios')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (data && !error) {
        const usuario: Usuario = {
          id: data.id,
          email: data.email || authUser.email || '',
          nombre: data.nombre,
          apellido: data.apellido,
          fechaNacimiento: data.fecha_nacimiento || data.fechaNacimiento || '',
          rol: data.rol || 'cliente',
          puntos: data.puntos ?? 0,
          credito: data.credito ?? 0,
          creadoEn: data.creado_en || data.creadoEn,
        };
        this.usuarioActual.set(usuario);
        return usuario;
      }
    } catch (err) {
      console.warn('No se pudo cargar perfil de la base de datos, usando datos de auth:', err);
    }

    // Perfil por defecto con metadata de auth
    const metadata = authUser.user_metadata || {};
    const usuarioFallback: Usuario = {
      id: authUser.id,
      email: authUser.email || '',
      nombre: metadata['nombre'] || '',
      apellido: metadata['apellido'] || '',
      fechaNacimiento: metadata['fechaNacimiento'] || '',
      rol: (metadata['rol'] as any) || 'cliente',
      puntos: metadata['puntos'] ?? 0,
      credito: metadata['credito'] ?? 0,
    };
    this.usuarioActual.set(usuarioFallback);
    return usuarioFallback;
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

      const { data, error } = await this.supabase.auth.signUp({
        email: datos.email.trim(),
        password: datos.password,
        options: {
          data: {
            nombre: datos.nombre.trim(),
            apellido: datos.apellido.trim(),
            fechaNacimiento: datos.fechaNacimiento,
            rol,
            puntos: 0,
            credito: 0,
          },
        },
      });

      if (error) {
        return { exito: false, mensaje: this.traducirError(error.message) };
      }

      if (!data.user) {
        return { exito: false, mensaje: 'No se pudo completar el registro del usuario.' };
      }

      const nuevoUsuario: Usuario = {
        id: data.user.id,
        email: datos.email.trim(),
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        fechaNacimiento: datos.fechaNacimiento,
        rol,
        puntos: 0,
        credito: 0,
        creadoEn: new Date().toISOString(),
      };

      try {
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
