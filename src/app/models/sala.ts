export type TipoFila = 'comun' | 'discapacitado' | 'vip';
export type EstadoAsiento = 'disponible' | 'ocupado' | 'seleccionado';
export type FormatoSala = '2D' | '3D';

export interface Asiento {
  id: string; // ej: "A-1", "J-5"
  fila: string; // "A", "B", ... "T"
  numero: number; // 1..N
  bloque: 1 | 2 | 3; // 1: izquierda, 2: centro, 3: derecha
  tipo: TipoFila;
  estado: EstadoAsiento;
  precio: number;
}

export interface FilaSala {
  letra: string; // "A" a "T"
  numeroFila: number; // 1 a 20
  tipo: TipoFila;
  bloque1: Asiento[]; // Izquierda (4 o 2 asientos)
  bloque2: Asiento[]; // Centro (20 o 10 asientos)
  bloque3: Asiento[]; // Derecha (4 o 2 asientos)
  totalAsientos: number;
}

export interface Sala {
  id: string;
  nombre: string;
  formato: FormatoSala;
  filas: FilaSala[];
  capacidadTotal: number;
  activa: boolean;
  creadaEn?: string;
}

export interface CrearSalaDto {
  nombre: string;
  formato: FormatoSala;
  configuracionFilas?: Record<string, TipoFila>;
}

export interface ActualizarSalaDto {
  nombre?: string;
  formato?: FormatoSala;
  configuracionFilas?: Record<string, TipoFila>;
  activa?: boolean;
}

export const PRECIOS_ASIENTO: Record<TipoFila, number> = {
  comun: 5000,
  discapacitado: 3500,
  vip: 7500,
};

export const NOMBRES_TIPO_FILA: Record<TipoFila, string> = {
  comun: 'Común (4-20-4)',
  discapacitado: 'Discapacitado (2-10-2)',
  vip: 'VIP (4-20-4)',
};
