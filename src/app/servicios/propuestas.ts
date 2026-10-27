import { Injectable, inject } from '@angular/core';
import { BaseSupabaseService } from './base-supabase';
import { PropuestaPelicula, CrearPropuestaDto, EstadoPropuesta } from '../models/propuesta';
import { Usuario } from '../models/usuario';
import { AuditoriaService } from './auditoria';

const LOCAL_STORAGE_PROPUESTAS_KEY = 'cinetp_propuestas_local';

@Injectable({
  providedIn: 'root',
})
export class PropuestasService extends BaseSupabaseService<PropuestaPelicula> {
  protected readonly nombreTabla = 'propuestas_peliculas';
  private auditoria = inject(AuditoriaService);

  protected override mapear(data: Record<string, any>): PropuestaPelicula {
    return {
      id: data['id'],
      usuarioId: data['usuario_id'] || data['usuarioId'],
      usuarioNombre: data['usuario_nombre'] || data['usuarioNombre'] || 'Cliente',
      usuarioEmail: data['usuario_email'] || data['usuarioEmail'] || '',
      titulo: data['titulo'] || '',
      descripcion: data['descripcion'] || '',
      explicacion: data['explicacion'] || '',
      estado: (data['estado'] || 'pendiente') as EstadoPropuesta,
      createdAt: data['created_at'] || data['createdAt'] || new Date().toISOString(),
      updatedAt: data['updated_at'] || data['updatedAt'],
    };
  }

  // ==========================================
  // LocalStorage Fallback Helpers
  // ==========================================
  private obtenerLocales(): PropuestaPelicula[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_PROPUESTAS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private guardarLocales(lista: PropuestaPelicula[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_STORAGE_PROPUESTAS_KEY, JSON.stringify(lista));
    } catch {}
  }

  /**
   * Obtiene la propuesta activa o pendiente del usuario.
   * Regla: "Cada cliente debería poder hacer una propuesta a la vez".
   */
  async obtenerPropuestaActiva(usuarioId: string): Promise<PropuestaPelicula | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.nombreTabla)
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return this.mapear(data);
      }
    } catch (e) {
      console.warn('Fallo consulta Supabase propuestas, buscando en local:', e);
    }

    // Fallback a localStorage
    const locales = this.obtenerLocales();
    return locales.find((p) => p.usuarioId === usuarioId && p.estado === 'pendiente') || null;
  }

  /**
   * Obtiene la última propuesta realizada por el usuario (sea pendiente, aceptada o rechazada).
   */
  async obtenerUltimaPropuestaUsuario(usuarioId: string): Promise<PropuestaPelicula | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.nombreTabla)
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return this.mapear(data);
      }
    } catch (e) {
      console.warn('Fallo consulta Supabase última propuesta, buscando en local:', e);
    }

    const locales = this.obtenerLocales();
    const filtradas = locales.filter((p) => p.usuarioId === usuarioId);
    return filtradas.length > 0 ? filtradas[0] : null;
  }

  /**
   * Crea una nueva propuesta para el cliente.
   * Valida que no tenga una propuesta pendiente activa.
   */
  async crearPropuesta(datos: CrearPropuestaDto, usuario: Usuario): Promise<PropuestaPelicula> {
    const activa = await this.obtenerPropuestaActiva(usuario.id);
    if (activa) {
      throw new Error(
        'Ya tienes una propuesta pendiente en revisión. Debes esperar a que sea evaluada antes de enviar otra.'
      );
    }

    const payload = {
      usuario_id: usuario.id,
      usuario_nombre: `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.email,
      usuario_email: usuario.email,
      titulo: datos.titulo.trim(),
      descripcion: datos.descripcion.trim(),
      explicacion: datos.explicacion.trim(),
      estado: 'pendiente' as EstadoPropuesta,
    };

    let propuestaCreada: PropuestaPelicula;

    try {
      const res = await this.insertar(payload);
      propuestaCreada = res;
    } catch (err: any) {
      console.warn('Aviso: Falló inserción en Supabase, guardando en respaldo local:', err);
      propuestaCreada = {
        id: 'propuesta-' + Date.now(),
        usuarioId: usuario.id,
        usuarioNombre: payload.usuario_nombre,
        usuarioEmail: payload.usuario_email,
        titulo: payload.titulo,
        descripcion: payload.descripcion,
        explicacion: payload.explicacion,
        estado: 'pendiente',
        createdAt: new Date().toISOString(),
      };
      const actuales = this.obtenerLocales();
      this.guardarLocales([propuestaCreada, ...actuales]);
    }

    void this.auditoria.registrar(
      'propuesta_pelicula_creada',
      `Cliente "${propuestaCreada.usuarioNombre}" propuso: "${propuestaCreada.titulo}"`
    );

    return propuestaCreada;
  }

  /**
   * Obtiene todas las propuestas para el panel de administración.
   */
  async obtenerTodasLasPropuestas(): Promise<PropuestaPelicula[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.nombreTabla)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data || []).map((item) => this.mapear(item));
    } catch (err) {
      console.warn('Aviso: Falló obtención de propuestas desde Supabase, usando respaldo local:', err);
      return this.obtenerLocales();
    }
  }

  /**
   * Cambia el estado de una propuesta (aceptada o rechazada).
   */
  async actualizarEstado(id: string, nuevoEstado: EstadoPropuesta, titulo?: string): Promise<PropuestaPelicula> {
    let propuestaActualizada: PropuestaPelicula;

    try {
      const res = await this.actualizar(id, { estado: nuevoEstado });
      propuestaActualizada = res;
    } catch (err) {
      console.warn('Aviso: Falló actualización en Supabase, actualizando en local:', err);
      const locales = this.obtenerLocales();
      const idx = locales.findIndex((p) => p.id === id);
      if (idx !== -1) {
        locales[idx].estado = nuevoEstado;
        locales[idx].updatedAt = new Date().toISOString();
        this.guardarLocales(locales);
        propuestaActualizada = locales[idx];
      } else {
        throw new Error('No se pudo encontrar la propuesta a actualizar.');
      }
    }

    const accionAuditoria =
      nuevoEstado === 'aceptada' ? 'propuesta_pelicula_aceptada' : 'propuesta_pelicula_rechazada';

    void this.auditoria.registrar(
      accionAuditoria,
      `Propuesta "${titulo || propuestaActualizada.titulo}" marcada como ${nuevoEstado.toUpperCase()}`
    );

    return propuestaActualizada;
  }

  /**
   * Permite al cliente cancelar su propuesta pendiente para enviar una nueva.
   */
  async cancelarPropuesta(id: string): Promise<void> {
    try {
      await this.eliminar(id);
    } catch (err) {
      console.warn('Aviso: Falló eliminación en Supabase, eliminando en local:', err);
      const locales = this.obtenerLocales().filter((p) => p.id !== id);
      this.guardarLocales(locales);
    }

    void this.auditoria.registrar(
      'propuesta_pelicula_cancelada',
      `Propuesta id ${id} cancelada por el cliente`
    );
  }
}
