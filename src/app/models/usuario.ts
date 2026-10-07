export type RolUsuario = 'cliente' | 'empleado' | 'admin';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string; // Formato YYYY-MM-DD
  tipoSangre?: string;
  colorOjos?: string;
  diasVacaciones?: number;
  rol: RolUsuario;
  puntos: number;
  credito: number; // Saldo a favor en cuenta
  creadoEn?: string;
}

export interface RegistroUsuarioDto {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  tipoSangre?: string;
  colorOjos?: string;
  diasVacaciones?: number;
}

export interface CredencialesLoginDto {
  email: string;
  password: string;
}
