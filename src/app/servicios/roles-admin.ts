import { Injectable, inject, signal } from '@angular/core';
import { Auth } from './auth';
import { AuditoriaService } from './auditoria';
import { SupabaseClientService } from './supabase-client';

export const SECCIONES_ADMIN = [
  { id: 'peliculas', nombre: 'Administrar películas', ruta: '/admin/peliculas' },
  { id: 'propuestas', nombre: 'Propuestas de clientes', ruta: '/admin/propuestas' },
  { id: 'funciones', nombre: 'Administrar funciones', ruta: '/admin/funciones' },
  { id: 'candy', nombre: 'Administrar Candy Bar', ruta: '/admin/candy' },
  { id: 'salas', nombre: 'Administrar salas', ruta: '/admin/salas' },
  { id: 'cupones', nombre: 'Administrar cupones', ruta: '/admin/cupones' },
  { id: 'empleados', nombre: 'Registrar empleados', ruta: '/admin/empleados/nuevo' },
  { id: 'auditoria', nombre: 'Auditoría', ruta: '/admin/auditoria' },
  { id: 'facturacion', nombre: 'Facturación y reportes', ruta: '/admin/facturacion' },
  { id: 'graficos', nombre: 'Gráficos de ventas', ruta: '/admin/graficos' },
] as const;

export type SeccionAdminId = typeof SECCIONES_ADMIN[number]['id'];

export interface RolAdministrativo {
  id: string;
  nombre: string;
  secciones: SeccionAdminId[];
  activo: boolean;
}

export interface UsuarioAsignable {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: string;
  rolPersonalizadoId: string | null;
  rolPersonalizadoNombre: string | null;
}

@Injectable({ providedIn: 'root' })
export class RolesAdminService {
  private supabase = inject(SupabaseClientService).client;
  private auth = inject(Auth);
  private auditoria = inject(AuditoriaService);
  private seccionesPorUsuario = new Map<string, string[]>();
  readonly seccionesActuales = signal<string[]>([]);

  async obtenerMisSecciones(): Promise<string[]> {
    const usuario = await this.auth.obtenerUsuario();
    if (!usuario) return [];
    if (usuario.rol === 'admin') {
      const todas = SECCIONES_ADMIN.map((section) => section.id);
      this.seccionesPorUsuario.set(usuario.id, todas);
      this.seccionesActuales.set(todas);
      return todas;
    }

    const cache = this.seccionesPorUsuario.get(usuario.id);
    if (cache) {
      this.seccionesActuales.set(cache);
      return cache;
    }

    const { data, error } = await this.supabase.rpc('obtener_secciones_admin_usuario');
    if (error) throw new Error(error.message);
    const secciones = Array.isArray(data) ? data.map(String) : [];
    this.seccionesPorUsuario.set(usuario.id, secciones);
    this.seccionesActuales.set(secciones);
    return secciones;
  }

  async puedeAcceder(seccion?: string): Promise<boolean> {
    const usuario = await this.auth.obtenerUsuario();
    if (!usuario) return false;
    if (usuario.rol === 'admin') return true;
    const permisos = await this.obtenerMisSecciones();
    return seccion ? permisos.includes(seccion) : permisos.length > 0;
  }

  tieneSeccion(seccion: string): boolean {
    const usuario = this.auth.usuarioActual();
    if (usuario?.rol === 'admin') return true;
    return this.seccionesActuales().includes(seccion);
  }

  async obtenerPrimeraRuta(): Promise<string> {
    const permisos = await this.obtenerMisSecciones();
    return SECCIONES_ADMIN.find((section) => permisos.includes(section.id))?.ruta || '/home';
  }

  async listarRoles(): Promise<RolAdministrativo[]> {
    const { data, error } = await this.supabase.rpc('admin_listar_roles');
    if (error) throw new Error(error.message);
    return (data || []).map((row: Record<string, any>) => ({
      id: String(row['id']),
      nombre: String(row['nombre']),
      secciones: Array.isArray(row['secciones']) ? row['secciones'] as SeccionAdminId[] : [],
      activo: Boolean(row['activo']),
    }));
  }

  async listarUsuarios(): Promise<UsuarioAsignable[]> {
    const { data, error } = await this.supabase.rpc('admin_listar_usuarios_roles');
    if (error) throw new Error(error.message);
    return (data || []).map((row: Record<string, any>) => ({
      id: String(row['id']),
      email: String(row['email'] || ''),
      nombre: String(row['nombre'] || ''),
      apellido: String(row['apellido'] || ''),
      rol: String(row['rol'] || 'cliente'),
      rolPersonalizadoId: row['rol_personalizado_id'] ? String(row['rol_personalizado_id']) : null,
      rolPersonalizadoNombre: row['rol_personalizado_nombre'] ? String(row['rol_personalizado_nombre']) : null,
    }));
  }

  async guardarRol(rol: { id?: string; nombre: string; secciones: string[] }): Promise<void> {
    const { error } = await this.supabase.rpc('admin_guardar_rol', {
      p_rol_id: rol.id || null,
      p_nombre: rol.nombre.trim(),
      p_secciones: rol.secciones,
    });
    if (error) throw new Error(error.message);

    const secciones = SECCIONES_ADMIN
      .filter((seccion) => rol.secciones.includes(seccion.id))
      .map((seccion) => seccion.nombre)
      .join(', ');
    void this.auditoria.registrar(
      rol.id ? 'rol_editado' : 'rol_creado',
      `Rol "${rol.nombre.trim()}" con acceso a: ${secciones}`
    );
  }

  async asignarRol(usuario: UsuarioAsignable, rol: RolAdministrativo | null): Promise<void> {
    const { error } = await this.supabase.rpc('admin_asignar_rol_usuario', {
      p_usuario_id: usuario.id,
      p_rol_id: rol?.id || null,
    });
    if (error) throw new Error(error.message);
    this.seccionesPorUsuario.delete(usuario.id);

    const nombreUsuario = `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.email;
    void this.auditoria.registrar(
      'rol_asignado',
      rol
        ? `Rol "${rol.nombre}" asignado a ${nombreUsuario} (${usuario.email})`
        : `Rol personalizado quitado a ${nombreUsuario} (${usuario.email})`
    );
  }
}
