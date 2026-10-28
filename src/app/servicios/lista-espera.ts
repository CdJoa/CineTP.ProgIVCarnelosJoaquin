import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseClientService } from './supabase-client';

export interface EntradaListaEspera {
  id: string;
  funcionId: string;
  peliculaId: string;
  peliculaTitulo: string;
  salaNombre: string;
  inicio: string;
  estado: 'espera' | 'ofrecida';
  posicion: number;
  asientoId?: string;
  ofertaHasta?: string;
  creadaEn: string;
}

@Injectable({ providedIn: 'root' })
export class ListaEsperaService {
  private supabase = inject(SupabaseClientService).client;

  async unirse(funcionId: string): Promise<{ id: string; estado: string; posicion: number; asientoId?: string; ofertaHasta?: string }> {
    const { data, error } = await this.supabase.rpc('unirse_lista_espera', {
      p_funcion_id: funcionId,
    });
    if (error) throw new Error(error.message);
    return {
      id: String(data?.['id'] || ''),
      estado: String(data?.['estado'] || 'espera'),
      posicion: Number(data?.['posicion'] || 0),
      asientoId: data?.['asiento_id'] ? String(data['asiento_id']) : undefined,
      ofertaHasta: data?.['oferta_hasta'] ? String(data['oferta_hasta']) : undefined,
    };
  }

  async obtenerMisListas(): Promise<EntradaListaEspera[]> {
    const { data, error } = await this.supabase.rpc('obtener_mis_listas_espera');
    if (error) throw new Error(error.message);
    return (data || []).map((row: Record<string, any>) => ({
      id: String(row['id']),
      funcionId: String(row['funcion_id']),
      peliculaId: String(row['pelicula_id'] || ''),
      peliculaTitulo: String(row['pelicula_titulo'] || 'Película'),
      salaNombre: String(row['sala_nombre'] || 'Sala'),
      inicio: String(row['inicio'] || ''),
      estado: row['estado'] === 'ofrecida' ? 'ofrecida' : 'espera',
      posicion: Number(row['posicion'] || 0),
      asientoId: row['asiento_id'] ? String(row['asiento_id']) : undefined,
      ofertaHasta: row['oferta_hasta'] ? String(row['oferta_hasta']) : undefined,
      creadaEn: String(row['creada_en'] || ''),
    }));
  }

  async salir(entradaId: string): Promise<void> {
    const { data, error } = await this.supabase.rpc('salir_lista_espera', {
      p_entrada_id: entradaId,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('La inscripción ya no está activa. Actualizá la lista.');
  }

  async obtenerConteos(): Promise<Record<string, number>> {
    const { data, error } = await this.supabase.rpc('obtener_conteos_lista_espera');
    if (error) throw new Error(error.message);
    return Object.fromEntries((data || []).map((row: Record<string, any>) => [
      String(row['funcion_id']), Number(row['cantidad'] || 0),
    ]));
  }

  async tomarOferta(funcionId: string, sessionId: string, sessionToken: string): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('tomar_oferta_lista_espera', {
      p_funcion_id: funcionId,
      p_session_id: sessionId,
      p_session_token: sessionToken,
    });
    if (error) throw new Error(error.message);
    return data ? String(data) : null;
  }

  suscribirCambios(usuarioId: string, alCambiar: () => void): RealtimeChannel {
    return this.supabase
      .channel(`lista-espera-${usuarioId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lista_espera_funciones',
        filter: `usuario_id=eq.${usuarioId}`,
      }, alCambiar)
      .subscribe();
  }
}
