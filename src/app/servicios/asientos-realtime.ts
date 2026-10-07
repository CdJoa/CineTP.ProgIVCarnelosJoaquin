import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Auth } from './auth';

export interface EstadoAsientoFuncion {
  funcionId: string;
  asientoId: string;
  sesionId: string;
  estado: 'reservado' | 'vendido';
  expiraEn: string | null;
}

interface SesionAsientos {
  id: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AsientosRealtimeService {
  private auth = inject(Auth);
  private sesion?: SesionAsientos;

  get sesionId(): string {
    return this.obtenerSesion().id;
  }

  async obtenerEstado(funcionId: string): Promise<EstadoAsientoFuncion[]> {
    const { data, error } = await this.auth.clienteSupabase
      .from('asientos_funcion')
      .select('funcion_id, asiento_id, sesion_id, estado, expira_en')
      .eq('funcion_id', funcionId);

    if (error) throw new Error(error.message);
    return (data || []).map((row) => this.mapear(row));
  }

  async reservar(funcionId: string, asientoId: string): Promise<boolean> {
    const sesion = this.obtenerSesion();
    const { data, error } = await this.auth.clienteSupabase.rpc('reservar_asiento', {
      p_funcion_id: funcionId,
      p_asiento_id: asientoId,
      p_session_id: sesion.id,
      p_session_token: sesion.token,
    });

    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  async liberar(funcionId: string, asientoId: string): Promise<void> {
    const sesion = this.obtenerSesion();
    const { error } = await this.auth.clienteSupabase.rpc('liberar_asiento', {
      p_funcion_id: funcionId,
      p_asiento_id: asientoId,
      p_session_id: sesion.id,
      p_session_token: sesion.token,
    });

    if (error) throw new Error(error.message);
  }

  async confirmar(funcionId: string, asientos: string[]): Promise<number> {
    const sesion = this.obtenerSesion();
    const { data, error } = await this.auth.clienteSupabase.rpc('confirmar_asientos', {
      p_funcion_id: funcionId,
      p_asientos: asientos,
      p_session_id: sesion.id,
      p_session_token: sesion.token,
    });

    if (error) throw new Error(error.message);
    return Number(data || 0);
  }

  suscribir(
    funcionId: string,
    alCambiar: (estado: EstadoAsientoFuncion | null, eliminado: boolean) => void
  ): RealtimeChannel {
    return this.auth.clienteSupabase
      .channel(`asientos-funcion-${funcionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asientos_funcion',
          filter: `funcion_id=eq.${funcionId}`,
        },
        (payload) => {
          const deleted = payload.eventType === 'DELETE';
          const row = deleted ? payload.old : payload.new;
          alCambiar(row?.['asiento_id'] ? this.mapear(row) : null, deleted);
        }
      )
      .subscribe();
  }

  suscribirBoletosVendidos(alVender: (funcionId: string) => void): RealtimeChannel {
    return this.auth.clienteSupabase
      .channel('cartelera-asientos-vendidos-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asientos_funcion',
          filter: 'estado=eq.vendido',
        },
        (payload) => {
          const row = payload.new as Record<string, any> | undefined;
          if (row?.['funcion_id']) {
            alVender(row['funcion_id']);
          }
        }
      )
      .subscribe();
  }

  async desuscribir(channel: RealtimeChannel): Promise<void> {
    await this.auth.clienteSupabase.removeChannel(channel);
  }

  private mapear(row: Record<string, any>): EstadoAsientoFuncion {
    return {
      funcionId: row['funcion_id'],
      asientoId: row['asiento_id'],
      sesionId: row['sesion_id'],
      estado: row['estado'],
      expiraEn: row['expira_en'] || null,
    };
  }

  private obtenerSesion(): SesionAsientos {
    if (this.sesion) return this.sesion;

    const storageKey = 'cinetp-reserva-asientos';
    if (typeof sessionStorage !== 'undefined') {
      try {
        const guardada = sessionStorage.getItem(storageKey);
        if (guardada) {
          const sesion = JSON.parse(guardada) as SesionAsientos;
          if (sesion.id && sesion.token) {
            this.sesion = sesion;
            return sesion;
          }
        }
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    }

    const crearUuid = (): string => {
      if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };

    this.sesion = { id: crearUuid(), token: crearUuid() };
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(storageKey, JSON.stringify(this.sesion));
    }
    return this.sesion;
  }
}
