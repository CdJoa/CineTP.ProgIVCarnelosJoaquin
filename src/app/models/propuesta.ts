export type EstadoPropuesta = 'pendiente' | 'aceptada' | 'rechazada';

export interface PropuestaPelicula {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioEmail: string;
  titulo: string;
  descripcion: string;
  explicacion: string;
  estado: EstadoPropuesta;
  createdAt: string;
  updatedAt?: string;
}

export interface CrearPropuestaDto {
  titulo: string;
  descripcion: string;
  explicacion: string;
}
