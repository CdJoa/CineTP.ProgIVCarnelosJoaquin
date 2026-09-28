import { Injectable, inject } from '@angular/core';
import { BaseSupabaseService } from './base-supabase';
import { CrearFuncionDto, EstadoFuncion, Funcion } from '../models/funcion';
import { PeliculasService } from './peliculas';
import { SalaService } from './sala';

@Injectable({
  providedIn: 'root',
})
export class FuncionesService extends BaseSupabaseService<Funcion> {
  protected readonly nombreTabla = 'funciones';

  private peliculasService = inject(PeliculasService);
  private salaService = inject(SalaService);

  /**
   * Calcula la fecha/hora de finalización incluyendo el tiempo de la película
   * MÁS 30 minutos extras para limpieza y preparación de la sala.
   */
  public calcularFin(inicioIso: string, duracionPeliculaMinutos: number): string {
    if (!inicioIso) return '';
    const d = new Date(inicioIso);
    if (isNaN(d.getTime())) return '';

    const duracionTotalMinutos = Number(duracionPeliculaMinutos || 0) + 30;
    const finDate = new Date(d.getTime() + duracionTotalMinutos * 60 * 1000);
    return finDate.toISOString();
  }

  /**
   * Verifica si la sala dada ya tiene una función programada que se solape
   * en el rango [inicio, fin] (que contempla la película + 30 min de limpieza).
   */
  async verificarSolapamiento(
    salaId: string,
    inicioIso: string,
    finIso: string,
    idFuncionActual?: string
  ): Promise<{ solapada: boolean; funcionSolapada?: Funcion }> {
    const inicioNuevo = new Date(inicioIso).getTime();
    const finNuevo = new Date(finIso).getTime();

    const funcionesExistentes = await this.obtenerFuncionesCompleta();
    const funcionesSala = funcionesExistentes.filter(
      (f) => f.salaId === salaId && f.estado === 'programada' && f.id !== idFuncionActual
    );

    for (const f of funcionesSala) {
      const inicioExistente = new Date(f.inicio).getTime();
      const finExistente = new Date(f.fin || this.calcularFin(f.inicio, f.duracionPelicula || 120)).getTime();

      // Hay solapamiento si (inicioNuevo < finExistente) && (finNuevo > inicioExistente)
      if (inicioNuevo < finExistente && finNuevo > inicioExistente) {
        return { solapada: true, funcionSolapada: f };
      }
    }

    return { solapada: false };
  }

  async obtenerFuncionesCompleta(): Promise<Funcion[]> {
    let funciones: Funcion[] = [];
    try {
      funciones = await this.obtenerTodos('inicio', false);
    } catch {
      funciones = [];
    }

    // Enriquecer con nombres de películas y salas
    const [peliculas, salas] = await Promise.all([
      this.peliculasService.obtenerPeliculas().catch(() => []),
      this.salaService.obtenerSalas().catch(() => []),
    ]);

    const mapPeliculas = new Map(peliculas.map((p) => [p.id, p]));
    const mapSalas = new Map(salas.map((s) => [s.id, s]));

    return funciones.map((f) => {
      const p = mapPeliculas.get(f.peliculaId);
      const s = mapSalas.get(f.salaId || '');

      const duracionPeli = p?.duracion || 120;
      const finCalculado = this.calcularFin(f.inicio, duracionPeli);

      return {
        ...f,
        fin: finCalculado,
        peliculaTitulo: p?.titulo || 'Película no encontrada',
        duracionPelicula: duracionPeli,
        salaNombre: s?.nombre || 'Sala no encontrada',
      };
    });
  }

  async crearFuncionConValidacion(dto: CrearFuncionDto, duracionPelicula: number): Promise<Funcion> {
    const finIso = this.calcularFin(dto.inicio, duracionPelicula);
    const { solapada, funcionSolapada } = await this.verificarSolapamiento(dto.salaId || '', dto.inicio, finIso);

    if (solapada && funcionSolapada) {
      const horaInicio = new Date(funcionSolapada.inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const horaFin = funcionSolapada.fin
        ? new Date(funcionSolapada.fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'fin';
      throw new Error(
        `La sala elegida ya está ocupada por "${funcionSolapada.peliculaTitulo}" de ${horaInicio} a ${horaFin} (incluyendo los 30 min de limpieza y preparación).`
      );
    }

    const payload = {
      pelicula_id: dto.peliculaId,
      sala_id: dto.salaId,
      inicio: dto.inicio,
      fin: finIso,
      precio: Number(dto.precio),
      formato: dto.formato || '2D',
      idioma: dto.idioma || 'español',
      estado: dto.estado || 'programada',
    };

    const creada = await this.insertar(payload);
    const [peliculas, salas] = await Promise.all([
      this.peliculasService.obtenerPeliculas().catch(() => []),
      this.salaService.obtenerSalas().catch(() => []),
    ]);
    const p = peliculas.find((pel) => pel.id === creada.peliculaId);
    const s = salas.find((sal) => sal.id === creada.salaId);

    const durPeli = p?.duracion || duracionPelicula || 120;
    const finCalc = this.calcularFin(creada.inicio, durPeli);

    return {
      ...creada,
      fin: finCalc,
      peliculaTitulo: p?.titulo || 'Película',
      duracionPelicula: durPeli,
      salaNombre: s?.nombre || 'Sala',
    };
  }

  async actualizarFuncionConValidacion(
    id: string,
    dto: Partial<CrearFuncionDto>,
    duracionPelicula: number
  ): Promise<Funcion> {
    if (dto.inicio && dto.salaId) {
      const finIso = this.calcularFin(dto.inicio, duracionPelicula);
      const { solapada, funcionSolapada } = await this.verificarSolapamiento(dto.salaId, dto.inicio, finIso, id);

      if (solapada && funcionSolapada) {
        const horaInicio = new Date(funcionSolapada.inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const horaFin = funcionSolapada.fin
          ? new Date(funcionSolapada.fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'fin';
        throw new Error(
          `La sala elegida ya está ocupada por "${funcionSolapada.peliculaTitulo}" de ${horaInicio} a ${horaFin} (incluyendo los 30 min de limpieza).`
        );
      }
    }

    const payload: Record<string, any> = {};
    if (dto.peliculaId) payload['pelicula_id'] = dto.peliculaId;
    if (dto.salaId) payload['sala_id'] = dto.salaId;
    if (dto.inicio) {
      payload['inicio'] = dto.inicio;
      payload['fin'] = this.calcularFin(dto.inicio, duracionPelicula);
    }
    if (dto.precio !== undefined) payload['precio'] = Number(dto.precio);
    if (dto.formato) payload['formato'] = dto.formato;
    if (dto.idioma) payload['idioma'] = dto.idioma;
    if (dto.estado) payload['estado'] = dto.estado;

    const actualizada = await this.actualizar(id, payload);
    const [peliculas, salas] = await Promise.all([
      this.peliculasService.obtenerPeliculas().catch(() => []),
      this.salaService.obtenerSalas().catch(() => []),
    ]);
    const p = peliculas.find((pel) => pel.id === actualizada.peliculaId);
    const s = salas.find((sal) => sal.id === actualizada.salaId);

    const durPeli = p?.duracion || duracionPelicula || 120;
    const finCalc = this.calcularFin(actualizada.inicio, durPeli);

    return {
      ...actualizada,
      fin: finCalc,
      peliculaTitulo: p?.titulo || 'Película',
      duracionPelicula: durPeli,
      salaNombre: s?.nombre || 'Sala',
    };
  }

  protected override mapear(data: Record<string, any>): Funcion {
    return {
      id: data['id'],
      peliculaId: data['pelicula_id'] || data['peliculaId'],
      salaId: data['sala_id'] || data['salaId'],
      inicio: data['inicio'],
      fin: data['fin'],
      precio: Number(data['precio'] || 0),
      formato: data['formato'] || '2D',
      idioma: data['idioma'] || 'español',
      estado: data['estado'] || 'programada',
      creadaEn: data['creada_en'] || data['creadoEn'],
    };
  }
}
