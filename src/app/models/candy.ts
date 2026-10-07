export type CategoriaCandy = 'pochoclo' | 'bebida' | 'snacks' | 'comida' | 'combo';

export interface ProductoCandy {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaCandy;
  precio: number;
  imagen?: string;       // URL de Supabase Storage
  puntajeCompra: number; // Puntos que otorga la compra
  cantidadVendida: number; // Cantidad de unidades vendidas
  activo: boolean;
  creadoEn?: string;
}

export interface CrearCandyDto {
  nombre: string;
  descripcion: string;
  categoria: CategoriaCandy;
  precio: number;
  imagen?: string;
  puntajeCompra: number;
  cantidadVendida?: number;
}
