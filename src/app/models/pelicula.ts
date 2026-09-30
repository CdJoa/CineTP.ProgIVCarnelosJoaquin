import type { Formato, Idioma } from './funcion';

export type { Formato, Idioma };

export type GenerosPelicula =
  | 'accion'
  | 'comedia'
  | 'drama'
  | 'terror'
  | 'romance'
  | 'animacion'
  | 'ciencia_ficcion'
  | 'documental'
  | 'thriller'
  | 'aventura'
  | 'fantasia'
  | 'musical';

export interface Pelicula {
  id: string;
  titulo: string;
  sinopsis: string;
  duracion: number;          // en minutos
  generos: GenerosPelicula[];
  restriccionEdad: number;   // edad mínima requerida (ej: 0, 13, 16, 18)
  puntajeCompra: number;     // puntos que otorga la compra
  poster?: string;           // URL de imagen de poster
  fechaEstreno: string;      // ISO date string
  activa: boolean;
  enCartelera: boolean;      // Visibilidad en cartelera pública
  boletosVendidos: number;   // Contador de entradas/boletos vendidos
  creadoEn?: string;
  formato?: Formato;
  idioma?: Idioma;
}

export interface CrearPeliculaDto {
  titulo: string;
  sinopsis: string;
  duracion: number;
  generos: GenerosPelicula[];
  restriccionEdad: number;
  puntajeCompra: number;
  poster?: string;
  fechaEstreno: string;
  enCartelera?: boolean;
  boletosVendidos?: number;
  formato?: Formato;
  idioma?: Idioma;
}
