export interface Resena {
  id: string;
  peliculaId: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioEmail?: string;
  puntos: number; // 0.5 a 5.0 (en pasos de 0.5)
  comentario: string; // Comentario corto
  activo: boolean; // Borrado lógico: true (visible), false (borrado/oculto)
  creadoEn: string;
  actualizadoEn?: string;
}

export interface ResumenPuntuacion {
  promedio: number;
  total: number;
}

export interface GuardarResenaDto {
  peliculaId: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioEmail?: string;
  puntos: number;
  comentario: string;
}
