export type AccionAuditoria =
  | 'pelicula_creada'
  | 'pelicula_editada'
  | 'funcion_creada'
  | 'funcion_editada'
  | 'compra_realizada'
  | 'lectura_qr'
  | 'compra_cancelada'
  | 'precio_modificado'
  | (string & {});

export interface RegistroAuditoria {
  id: string;
  accion: AccionAuditoria;
  detalle: string;
  usuarioId?: string;
  usuarioNombre?: string;
  usuarioEmail?: string;
  usuarioRol?: string;
  creadoEn: string;
}

