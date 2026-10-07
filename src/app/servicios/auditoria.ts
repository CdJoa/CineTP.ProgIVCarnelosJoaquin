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
   * Registra un evento a nombre del usuario en sesión. Nunca lanza: un fallo
   * de auditoría no debe interrumpir la operación que se está registrando.
   */
  async registrar(accion: AccionAuditoria, detalle: string): Promise<void> {
    const usuario = this.auth.usuarioActual();
    const { error } = await this.supabase.from(this.nombreTabla).insert({
      accion,
      detalle,
      usuario_id: usuario?.id || null,
      usuario_email: usuario?.email || null,
    });

    if (error) {
      console.warn('No se pudo registrar el evento de auditoría:', error.message);
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
    return {
      id: String(data['id']),
      accion: data['accion'],
      detalle: String(data['detalle'] || ''),
      usuarioId: data['usuario_id'] || undefined,
      usuarioEmail: data['usuario_email'] || undefined,
      creadoEn: String(data['creado_en'] || ''),
    };
  }
}
