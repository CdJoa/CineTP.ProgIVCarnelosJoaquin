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

const VIGENCIA_OFERTA_MS = 15 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private supabase = inject(SupabaseClientService).client;

  /**
   * Devuelve solo los avisos pendientes: los leídos/descartados no se muestran más.
   * Las ofertas de lista de espera vencidas (15 min) se descartan solas.
   */
  async obtenerMisNotificaciones(usuarioId: string): Promise<Notificacion[]> {
    const { data, error } = await this.supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('leida', false)
      .order('creado_en', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    const lista: Notificacion[] = (data || []).map((row) => ({
      id: String(row['id']),
      usuarioId: String(row['usuario_id']),
      titulo: String(row['titulo'] || ''),
      mensaje: String(row['mensaje'] || ''),
      tipo: String(row['tipo'] || 'info'),
      leida: Boolean(row['leida']),
      metadata: (row['metadata'] || {}) as Record<string, unknown>,
      creadoEn: String(row['creado_en'] || ''),
    }));

    const vencidas = lista.filter((n) => this.ofertaVencida(n));
    if (vencidas.length > 0) {
      void this.marcarLeidas(vencidas.map((n) => n.id)).catch(() => undefined);
    }
    return lista.filter((n) => !this.ofertaVencida(n));
  }

  /** Una oferta de lista de espera deja de servir pasados los 15 minutos. */
  private ofertaVencida(n: Notificacion): boolean {
    if (n.tipo !== 'lista_espera') return false;
    const hasta = n.metadata['oferta_hasta']
      ? new Date(String(n.metadata['oferta_hasta'])).getTime()
      : new Date(n.creadoEn).getTime() + VIGENCIA_OFERTA_MS;
    return !isNaN(hasta) && Date.now() > hasta;
  }

  async marcarLeidas(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await this.supabase.from('notificaciones').update({ leida: true }).in('id', ids);
    if (error) throw new Error(error.message);
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
