import { Injectable, inject } from '@angular/core';
import { BaseSupabaseService } from './base-supabase';
import { AccionAuditoria, RegistroAuditoria } from '../models/auditoria';
import { Auth } from './auth';

@Injectable({
  providedIn: 'root',
})
export class AuditoriaService extends BaseSupabaseService<RegistroAuditoria> {
  protected readonly nombreTabla = 'auditoria';

  private auth = inject(Auth);

  /**
   * Registra un evento a nombre del usuario en sesión o con datos especificados.
   * Nunca lanza: un fallo de auditoría no debe interrumpir la operación principal.
   */
  async registrar(
    accion: AccionAuditoria,
    detalle: string,
    usuarioOverride?: {
      id?: string;
      nombre?: string;
      email?: string;
      rol?: string;
    }
  ): Promise<void> {
    let usuario = this.auth.usuarioActual();
    if (!usuario && !usuarioOverride) {
      try {
        usuario = await this.auth.obtenerUsuario();
      } catch {}
    }

    const usuarioId = usuarioOverride?.id || usuario?.id || null;
    const usuarioEmail = usuarioOverride?.email || usuario?.email || null;

    let usuarioNombre = usuarioOverride?.nombre;
    if (!usuarioNombre) {
      if (usuario) {
        const nom = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim();
        usuarioNombre = nom || usuario.nombre || usuario.email;
      } else if (usuarioEmail) {
        usuarioNombre = usuarioEmail.split('@')[0];
      } else {
        usuarioNombre = 'Sistema';
      }
    }

    const usuarioRol = usuarioOverride?.rol || usuario?.rol || (usuario ? 'cliente' : 'sistema');

    const payload: Record<string, any> = {
      accion,
      detalle,
      usuario_id: usuarioId,
      usuario_nombre: usuarioNombre,
      usuario_email: usuarioEmail,
      usuario_rol: usuarioRol,
    };

    const { error } = await this.supabase.from(this.nombreTabla).insert(payload);

    if (error) {
      // Resiliencia: si aún no se corrió la migración SQL de columnas nuevas, intentar con columnas base
      if (error.message?.includes('usuario_nombre') || error.message?.includes('usuario_rol')) {
        const { error: errFallback } = await this.supabase.from(this.nombreTabla).insert({
          accion,
          detalle,
          usuario_id: usuarioId,
          usuario_email: usuarioEmail,
        });
        if (errFallback) {
          console.warn('No se pudo registrar auditoría:', errFallback.message);
        }
      } else {
        console.warn('No se pudo registrar el evento de auditoría:', error.message);
      }
    }
  }

  async obtenerRegistros(limite = 200): Promise<RegistroAuditoria[]> {
    const { data, error } = await this.supabase
      .from(this.nombreTabla)
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(limite);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((item) => this.mapear(item));
  }

  protected mapear(data: Record<string, any>): RegistroAuditoria {
    const email = data['usuario_email'] || undefined;
    const nombre = data['usuario_nombre'] || (email ? String(email).split('@')[0] : 'Anónimo');

    return {
      id: String(data['id']),
      accion: data['accion'],
      detalle: String(data['detalle'] || ''),
      usuarioId: data['usuario_id'] || undefined,
      usuarioNombre: nombre,
      usuarioEmail: email,
      usuarioRol: data['usuario_rol'] || undefined,
      creadoEn: String(data['creado_en'] || ''),
    };
  }
}

