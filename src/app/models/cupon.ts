export type TipoCupon = 'registro' | 'edad_50' | 'promocional';

export interface Cupon {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  porcentajeDescuento: number; // 0 - 100%
  edadMinimaRequerida?: number; // Ej: 50 para cupón +50 años
  esPrimeraCompra: boolean;     // Aplica solo en primera compra
  activo: boolean;
  creadoEn?: string;
}

export interface CuponUsuario {
  id: string;
  usuarioId: string;
  cuponId: string;
  usado: boolean;
  asignadoEn: string;
  usadoEn?: string;
  cupon?: Cupon;
}

export interface CrearCuponDto {
  codigo: string;
  nombre: string;
  descripcion: string;
  porcentajeDescuento: number;
  edadMinimaRequerida?: number | null;
  esPrimeraCompra: boolean;
  activo?: boolean;
}

export interface ActualizarCuponDto {
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  porcentajeDescuento?: number;
  edadMinimaRequerida?: number | null;
  esPrimeraCompra?: boolean;
  activo?: boolean;
}
