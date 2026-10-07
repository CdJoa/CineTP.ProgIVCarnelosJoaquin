import { Injectable } from '@angular/core';
import { CrearPeliculaDto, Pelicula } from '../models/pelicula';
import { BaseSupabaseService } from './base-supabase';

@Injectable({
  providedIn: 'root',
})
export class PeliculasService extends BaseSupabaseService<Pelicula> {
  protected readonly nombreTabla = 'peliculas';

  async crearPelicula(datos: CrearPeliculaDto): Promise<Pelicula> {
    return this.insertar({
      titulo: datos.titulo,
      sinopsis: datos.sinopsis,
      duracion: Number(datos.duracion),
      generos: datos.generos,
      restriccion_edad: Number(datos.restriccionEdad),
      puntaje_compra: Number(datos.puntajeCompra),
      poster: datos.poster || null,
      fecha_estreno: datos.fechaEstreno,
      en_cartelera: datos.enCartelera ?? true,
      boletos_vendidos: Number(datos.boletosVendidos || 0),
      activa: true,
    });
  }

  async obtenerPeliculas(): Promise<Pelicula[]> {
    return this.obtenerTodos('fecha_estreno', false);
  }

  async actualizarPelicula(id: string, datos: Partial<CrearPeliculaDto>): Promise<Pelicula> {
    const payload: Record<string, any> = { ...datos };

    if (datos.duracion !== undefined) payload['duracion'] = Number(datos.duracion);
    if (datos.restriccionEdad !== undefined) payload['restriccionEdad'] = Number(datos.restriccionEdad);
    if (datos.puntajeCompra !== undefined) payload['puntajeCompra'] = Number(datos.puntajeCompra);
    if (datos.boletosVendidos !== undefined) payload['boletosVendidos'] = Number(datos.boletosVendidos);
    if (datos.enCartelera !== undefined) payload['enCartelera'] = Boolean(datos.enCartelera);
    if (datos.poster !== undefined) payload['poster'] = datos.poster || null;

    const res = await this.actualizarAuto(id, payload);
    this.notificarCanalLocal(res);
    return res;
  }

  async incrementarBoletosVendidos(peliculaId: string, cantidad: number): Promise<void> {
    if (!peliculaId || cantidad <= 0) return;
    try {
      const { data } = await this.supabase
        .from(this.nombreTabla)
        .select('boletos_vendidos')
        .eq('id', peliculaId)
        .maybeSingle();

      const actual = Number(data?.['boletos_vendidos'] || 0);
      const { data: updated } = await this.supabase
        .from(this.nombreTabla)
        .update({ boletos_vendidos: actual + cantidad })
        .eq('id', peliculaId)
        .select()
        .maybeSingle();

      if (updated) {
        this.notificarCanalLocal(this.mapear(updated));
      }
    } catch (err) {
      console.warn('No se pudo incrementar boletos_vendidos en pelicula:', err);
    }
  }

  private notificarCanalLocal(pelicula: Pelicula): void {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('cinetp-peliculas-local');
        bc.postMessage({ pelicula });
        bc.close();
      } catch {}
    }
  }

  suscribirCambios(alCambiar: (pelicula: Pelicula) => void): import('@supabase/supabase-js').RealtimeChannel {
    return this.supabase
      .channel('cartelera-peliculas-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: this.nombreTabla,
        },
        (payload) => {
          const row = payload.new as Record<string, any> | undefined;
          if (row?.['id']) {
            alCambiar(this.mapear(row));
          }
        }
      )
      .subscribe();
  }

  async desuscribir(canal: import('@supabase/supabase-js').RealtimeChannel): Promise<void> {
    await this.supabase.removeChannel(canal);
  }

  protected override mapear(data: Record<string, any>): Pelicula {
    return {
      id: data['id'],
      titulo: data['titulo'],
      sinopsis: data['sinopsis'],
      duracion: data['duracion'],
      generos: data['generos'],
      restriccionEdad: data['restriccion_edad'],
      puntajeCompra: data['puntaje_compra'],
      poster: data['poster'],
      fechaEstreno: data['fecha_estreno'],
      activa: data['activa'] ?? true,
      enCartelera: data['en_cartelera'] ?? true,
      boletosVendidos: data['boletos_vendidos'] || 0,
      creadoEn: data['creado_en'],
      formato: data['formato'],
      idioma: data['idioma'],
    };
  }
}

