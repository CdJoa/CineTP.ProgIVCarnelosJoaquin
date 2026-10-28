export type AccionAuditoria =
  | 'pelicula_creada'
  | 'pelicula_editada'
  | 'funcion_creada'
  | 'funcion_editada'
  | 'compra_realizada'
  | 'lectura_qr'
  | 'compra_cancelada'
  | 'precio_modificado'
  | 'funcion_estado_modificado'
  | 'funcion_eliminada'
  | 'butacas_demo_simuladas'
  | 'butacas_demo_liberadas'
  | 'sala_creada'
  | 'sala_editada'
  | 'producto_candy_creado'
  | 'producto_candy_editado'
  | 'cupon_creado'
  | 'cupon_editado'
  | 'empleado_registrado'
  | 'rol_creado'
  | 'rol_editado'
  | 'rol_asignado'
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

