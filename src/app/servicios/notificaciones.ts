import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseClientService } from './supabase-client';

export interface Notificacion {
  id: string;
  usuarioId: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  metadata: Record<string, unknown>;
  creadoEn: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private supabase = inject(SupabaseClientService).client;

  async obtenerMisNotificaciones(usuarioId: string): Promise<Notificacion[]> {
    const { data, error } = await this.supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return (data || []).map((row) => ({
      id: String(row['id']),
      usuarioId: String(row['usuario_id']),
      titulo: String(row['titulo'] || ''),
      mensaje: String(row['mensaje'] || ''),
      tipo: String(row['tipo'] || 'info'),
      leida: Boolean(row['leida']),
      metadata: (row['metadata'] || {}) as Record<string, unknown>,
      creadoEn: String(row['creado_en'] || ''),
    }));
  }

  async marcarLeida(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  suscribirCambios(usuarioId: string, alCambiar: () => void): RealtimeChannel {
    return this.supabase
      .channel(`notificaciones-usuario-${usuarioId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${usuarioId}`,
      }, alCambiar)
      .subscribe();
  }
}
