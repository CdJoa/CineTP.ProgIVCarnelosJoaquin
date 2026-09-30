import { Injectable } from '@angular/core';
import { CrearFuncionDto, Funcion } from '../models/funcion';
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

  async obtenerPeliculaPorId(id: string): Promise<Pelicula | null> {
    return this.obtenerPorId(id);
  }

  async actualizarPelicula(id: string, datos: Partial<CrearPeliculaDto>): Promise<Pelicula> {
    const payload: Record<string, any> = { ...datos };

    if (datos.duracion !== undefined) payload['duracion'] = Number(datos.duracion);
    if (datos.restriccionEdad !== undefined) payload['restriccionEdad'] = Number(datos.restriccionEdad);
    if (datos.puntajeCompra !== undefined) payload['puntajeCompra'] = Number(datos.puntajeCompra);
    if (datos.boletosVendidos !== undefined) payload['boletosVendidos'] = Number(datos.boletosVendidos);
    if (datos.enCartelera !== undefined) payload['enCartelera'] = Boolean(datos.enCartelera);
    if (datos.poster !== undefined) payload['poster'] = datos.poster || null;

    return this.actualizarAuto(id, payload);
  }

  async crearFuncion(datos: CrearFuncionDto): Promise<Funcion> {
    const { data, error } = await this.supabase
      .from('funciones')
      .insert({
        pelicula_id: datos.peliculaId,
        sala_id: datos.salaId || null,
        inicio: datos.inicio,
        precio: datos.precio,
        formato: datos.formato || null,
        idioma: datos.idioma || null,
        estado: 'programada',
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      peliculaId: data.pelicula_id,
      salaId: data.sala_id || datos.salaId || '',
      inicio: data.inicio,
      fin: data.fin || '',
      precio: data.precio,
      formato: data.formato,
      idioma: data.idioma,
      estado: data.estado,
      creadaEn: data.creada_en,
    };
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

