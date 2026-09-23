export type EstadoFuncion = 'programada' | 'cancelada' | 'finalizada';
export type Formato = '2D' | '3D';
export type Idioma = 'español' | 'subtitulado' | 'doblado';

export interface Funcion {
  id: string;
  peliculaId: string;
  inicio: string;
  precio: number;
  formato?: Formato;
  idioma?: Idioma;
  estado: EstadoFuncion;
  creadaEn?: string;
}

export interface CrearFuncionDto {
  peliculaId: string;
  inicio: string;
  precio: number;
  formato?: Formato;
  idioma?: Idioma;
}
