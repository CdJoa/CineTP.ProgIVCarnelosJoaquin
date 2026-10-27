import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GuardarResenaDto, Resena, ResumenPuntuacion } from '../models/resena';
import { BaseSupabaseService } from './base-supabase';
import { AuditoriaService } from './auditoria';

const LOCAL_STORAGE_KEY = 'cinetp_resenas_local';

@Injectable({
  providedIn: 'root',
})
export class ResenasService extends BaseSupabaseService<Resena> {
  protected readonly nombreTabla = 'resenas';
  private auditoria = inject(AuditoriaService);

  private broadcastChannel?: BroadcastChannel;

  constructor() {
    super();
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('cinetp-resenas-canal');
      } catch {}
    }
  }

  protected override mapear(data: Record<string, any>): Resena {
    return {
      id: data['id'],
      peliculaId: data['pelicula_id'] || data['peliculaId'],
      usuarioId: data['usuario_id'] || data['usuarioId'],
      usuarioNombre: data['usuario_nombre'] || data['usuarioNombre'] || 'Usuario',
      usuarioEmail: data['usuario_email'] || data['usuarioEmail'],
      puntos: Number(data['puntos'] || 0),
      comentario: data['comentario'] || '',
      activo: data['activo'] ?? true,
      creadoEn: data['creado_en'] || data['creadoEn'] || new Date().toISOString(),
      actualizadoEn: data['actualizado_en'] || data['actualizadoEn'],
    };
  }

  // ==========================================
  // Local Storage Fallback Helpers
  // ==========================================
  private obtenerResenasLocales(): Resena[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private guardarResenasLocales(lista: Resena[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lista));
    } catch {}
  }

  // ==========================================
  // Métodos de consulta
  // ==========================================
  async obtenerResenasPorPelicula(peliculaId: string): Promise<Resena[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.nombreTabla)
        .select('*')
        .eq('pelicula_id', peliculaId)
        .eq('activo', true)
        .order('creado_en', { ascending: false });

      if (error) {
        throw error;
      }

      const resenas = (data || []).map((item) => this.mapear(item));

      // Mezclar con posibles locales no sincronizadas (solo activas)
      const locales = this.obtenerResenasLocales().filter(
        (r) => r.peliculaId === peliculaId && r.activo !== false
      );
      const idsSupabase = new Set(resenas.map((r) => r.id));
      for (const loc of locales) {
        if (!idsSupabase.has(loc.id)) {
          resenas.unshift(loc);
        }
      }

      return resenas;
    } catch (err) {
      console.warn('Usando almacenamiento local para reseñas (tabla no disponible):', err);
      return this.obtenerResenasLocales()
        .filter((r) => r.peliculaId === peliculaId && r.activo !== false)
        .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
    }
  }

  async obtenerTodasLasResenas(): Promise<Resena[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.nombreTabla)
        .select('*')
        .eq('activo', true);

      if (error) throw error;

      const resenas = (data || []).map((item) => this.mapear(item));
      const locales = this.obtenerResenasLocales().filter((r) => r.activo !== false);
      const idsSupabase = new Set(resenas.map((r) => r.id));
      for (const loc of locales) {
        if (!idsSupabase.has(loc.id)) {
          resenas.push(loc);
        }
      }
      return resenas;
    } catch {
      return this.obtenerResenasLocales().filter((r) => r.activo !== false);
    }
  }

  async obtenerMapaResumenes(): Promise<Record<string, ResumenPuntuacion>> {
    const todas = await this.obtenerTodasLasResenas();
    const mapa: Record<string, { suma: number; total: number }> = {};

    for (const r of todas) {
      if (!mapa[r.peliculaId]) {
        mapa[r.peliculaId] = { suma: 0, total: 0 };
      }
      mapa[r.peliculaId].suma += r.puntos;
      mapa[r.peliculaId].total += 1;
    }

    const resultado: Record<string, ResumenPuntuacion> = {};
    for (const [peliId, acumulado] of Object.entries(mapa)) {
      resultado[peliId] = {
        promedio: Number((acumulado.suma / acumulado.total).toFixed(1)),
        total: acumulado.total,
      };
    }

    return resultado;
  }

  async obtenerMiResena(peliculaId: string, usuarioId: string): Promise<Resena | null> {
    if (!peliculaId || !usuarioId) return null;
    try {
      const { data, error } = await this.supabase
        .from(this.nombreTabla)
        .select('*')
        .eq('pelicula_id', peliculaId)
        .eq('usuario_id', usuarioId)
        .eq('activo', true)
        .maybeSingle();

      if (!error && data) {
        return this.mapear(data);
      }
    } catch {}

    const local = this.obtenerResenasLocales().find(
      (r) => r.peliculaId === peliculaId && r.usuarioId === usuarioId && r.activo !== false
    );
    return local || null;
  }

  /**
   * Obtiene todas las reseñas activas creadas por un usuario
   */
  async obtenerResenasUsuario(usuarioId: string): Promise<Resena[]> {
    if (!usuarioId) return [];
    try {
      const { data, error } = await this.supabase
        .from(this.nombreTabla)
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('activo', true)
        .order('creado_en', { ascending: false });

      if (error) throw error;
      const resenas = (data || []).map((item) => this.mapear(item));

      const locales = this.obtenerResenasLocales().filter(
        (r) => r.usuarioId === usuarioId && r.activo !== false
      );
      const idsSupabase = new Set(resenas.map((r) => r.id));
      for (const loc of locales) {
        if (!idsSupabase.has(loc.id)) {
          resenas.unshift(loc);
        }
      }
      return resenas;
    } catch {
      return this.obtenerResenasLocales()
        .filter((r) => r.usuarioId === usuarioId && r.activo !== false)
        .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
    }
  }

  /**
   * Retorna un mapa { peliculaId: Resena } con la reseña más reciente del usuario por película
   */
  async obtenerMapaResenasUsuario(usuarioId: string): Promise<Record<string, Resena>> {
    const lista = await this.obtenerResenasUsuario(usuarioId);
    const mapa: Record<string, Resena> = {};
    for (const r of lista) {
      if (r.peliculaId && (!mapa[r.peliculaId] || new Date(r.creadoEn) > new Date(mapa[r.peliculaId].creadoEn))) {
        mapa[r.peliculaId] = r;
      }
    }
    return mapa;
  }

  // ==========================================
  // Inserción y Modificación
  // ==========================================
  async guardarResena(dto: GuardarResenaDto): Promise<Resena> {
    // Normalizar puntos entre 0.5 y 5.0 en pasos de 0.5
    let puntosNorm = Math.round(dto.puntos * 2) / 2;
    if (puntosNorm < 0.5) puntosNorm = 0.5;
    if (puntosNorm > 5) puntosNorm = 5.0;

    const payload = {
      pelicula_id: dto.peliculaId,
      usuario_id: dto.usuarioId,
      usuario_nombre: dto.usuarioNombre,
      usuario_email: dto.usuarioEmail || null,
      puntos: puntosNorm,
      comentario: (dto.comentario || '').trim(),
      activo: true, // Siempre visible/reactivada al guardar
      actualizado_en: new Date().toISOString(),
    };

    let resenaFinal: Resena | null = null;

    try {
      // Verificar si ya existe reseña del usuario para esta película
      const { data: existente } = await this.supabase
        .from(this.nombreTabla)
        .select('id')
        .eq('pelicula_id', dto.peliculaId)
        .eq('usuario_id', dto.usuarioId)
        .maybeSingle();

      if (existente?.id) {
        const { data: updated, error: errUpdate } = await this.supabase
          .from(this.nombreTabla)
          .update(payload)
          .eq('id', existente.id)
          .select()
          .single();

        if (errUpdate) throw errUpdate;
        resenaFinal = this.mapear(updated);
      } else {
        const { data: inserted, error: errInsert } = await this.supabase
          .from(this.nombreTabla)
          .insert({
            ...payload,
            creado_en: new Date().toISOString(),
          })
          .select()
          .single();

        if (errInsert) throw errInsert;
        resenaFinal = this.mapear(inserted);
      }
    } catch (err) {
      console.warn('Fallback a guardado local de reseña:', err);
      // Guardado local
      const lista = this.obtenerResenasLocales();
      const idx = lista.findIndex(
        (r) => r.peliculaId === dto.peliculaId && r.usuarioId === dto.usuarioId
      );

      if (idx >= 0) {
        lista[idx] = {
          ...lista[idx],
          usuarioNombre: dto.usuarioNombre,
          usuarioEmail: dto.usuarioEmail,
          puntos: puntosNorm,
          comentario: (dto.comentario || '').trim(),
          activo: true,
          actualizadoEn: new Date().toISOString(),
        };
        resenaFinal = lista[idx];
      } else {
        const nueva: Resena = {
          id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          peliculaId: dto.peliculaId,
          usuarioId: dto.usuarioId,
          usuarioNombre: dto.usuarioNombre,
          usuarioEmail: dto.usuarioEmail,
          puntos: puntosNorm,
          comentario: (dto.comentario || '').trim(),
          activo: true,
          creadoEn: new Date().toISOString(),
          actualizadoEn: new Date().toISOString(),
        };
        lista.push(nueva);
        resenaFinal = nueva;
      }
      this.guardarResenasLocales(lista);
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ tipo: 'resena_guardada', resena: resenaFinal });
      } catch {}
    }

    void this.auditoria.registrar(
      'resena_creada',
      `Puntos: ${resenaFinal.puntos}⭐ - Usuario: ${resenaFinal.usuarioNombre}`
    );

    return resenaFinal;
  }

  async eliminarMiResena(id: string, peliculaId: string, usuarioId: string): Promise<void> {
    // Borrado lógico (soft delete): no borra la fila, pasa 'activo' a false
    try {
      await this.supabase
        .from(this.nombreTabla)
        .update({
          activo: false,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('usuario_id', usuarioId);
    } catch (err) {
      console.warn('Error aplicando borrado lógico en Supabase, aplicando local:', err);
    }

    const locales = this.obtenerResenasLocales();
    const idx = locales.findIndex((r) => r.id === id);
    if (idx >= 0) {
      locales[idx].activo = false;
      locales[idx].actualizadoEn = new Date().toISOString();
    }
    this.guardarResenasLocales(locales);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ tipo: 'resena_eliminada', id, peliculaId });
      } catch {}
    }

    void this.auditoria.registrar(
      'resena_eliminada',
      `Reseña ID: ${id} marcada como inactiva (borrado lógico)`
    );
  }

  suscribirCambios(alCambiar: () => void): RealtimeChannel {
    if (this.broadcastChannel) {
      this.broadcastChannel.onmessage = () => {
        alCambiar();
      };
    }

    return this.supabase
      .channel('resenas-realtime-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: this.nombreTabla,
        },
        () => {
          alCambiar();
        }
      )
      .subscribe();
  }
}
