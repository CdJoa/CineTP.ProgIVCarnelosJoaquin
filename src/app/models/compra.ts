export interface ItemCandyCompra {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export type EstadoCompra = 'confirmada' | 'usado' | 'cancelada';

export interface Compra {
  id: string;
  codigo: string;               // Código alfanumérico visible (ej: CINE-7K9B2X)
  usuarioId?: string;
  usuarioEmail?: string;
  funcionId: string;
  peliculaId?: string;
  peliculaTitulo: string;
  peliculaPoster?: string;
  restriccionEdad?: number;      // Edad mínima de la película (0 = apta para todo público)
  salaNombre: string;
  funcionInicio: string;         // ISO string
  formato?: string;              // '2D' | '3D'
  idioma?: string;               // 'español' | 'subtitulado' | 'doblado'
  asientos: string[];            // IDs de butacas (ej: ['A1', 'A2'])
  totalEntradas: number;
  itemsCandy: ItemCandyCompra[];
  totalCandy: number;
  descuento: number;
  cuponCodigo?: string;
  totalFinal: number;
  puntosGanados: number;
  qrData: string;                // Payload codificado en el QR
  qrImage?: string;              // Data URL base64 de la imagen generada
  estado: EstadoCompra;
  creadoEn: string;
}

export interface CrearCompraDto {
  usuarioId?: string;
  usuarioEmail?: string;
  funcionId: string;
  peliculaId?: string;
  peliculaTitulo: string;
  peliculaPoster?: string;
  salaNombre: string;
  funcionInicio: string;
  formato?: string;
  idioma?: string;
  asientos: string[];
  totalEntradas: number;
  itemsCandy?: ItemCandyCompra[];
  totalCandy?: number;
  descuento?: number;
  cuponId?: string;
  cuponCodigo?: string;
  totalFinal: number;
  puntosGanados?: number;
}
