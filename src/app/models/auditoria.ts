export type AccionAuditoria = 'funcion_creada' | 'precio_modificado' | 'lectura_qr';

export interface RegistroAuditoria {
  id: string;
  accion: AccionAuditoria;
  detalle: string;
  usuarioId?: string;
  usuarioEmail?: string;
  creadoEn: string;
}
