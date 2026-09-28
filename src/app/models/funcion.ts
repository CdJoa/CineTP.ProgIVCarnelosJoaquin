export type EstadoFuncion = 'programada' | 'cancelada' | 'finalizada';
export type Formato = '2D' | '3D';
export type Idioma = 'español' | 'subtitulado' | 'doblado';

export interface Funcion {
  id: string;
  peliculaId: string;
  salaId?: string;          // ID de la sala asignada
  inicio: string;           // ISO date time string (ej: 2026-09-28T18:00)
  fin?: string;             // ISO date time string (inicio + duracionPelicula + 30 min limpieza)
  precio: number;
  formato?: Formato;
  idioma?: Idioma;
  estado: EstadoFuncion;
  creadaEn?: string;

  // Propiedades opcionales pobladas en cliente
  peliculaTitulo?: string;
  duracionPelicula?: number;
  salaNombre?: string;
}

export interface CrearFuncionDto {
  peliculaId: string;
  salaId?: string;
  inicio: string;
  fin?: string;
  precio: number;
  formato?: Formato;
  idioma?: Idioma;
  estado?: EstadoFuncion;
}
