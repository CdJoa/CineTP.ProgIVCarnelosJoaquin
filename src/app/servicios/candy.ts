import { Injectable } from '@angular/core';
import { CrearCandyDto, ProductoCandy } from '../models/candy';
import { BaseSupabaseService } from './base-supabase';

@Injectable({
  providedIn: 'root',
})
export class CandyService extends BaseSupabaseService<ProductoCandy> {
  protected readonly nombreTabla = 'productos_candy';

  async crearProducto(datos: CrearCandyDto): Promise<ProductoCandy> {
    return this.insertar({
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      categoria: datos.categoria,
      precio: Number(datos.precio),
      imagen: datos.imagen || null,
      puntaje_compra: Number(datos.puntajeCompra),
      activo: true,
    });
  }

  async obtenerProductos(): Promise<ProductoCandy[]> {
    return this.obtenerTodos('nombre', true);
  }

  async actualizarProducto(id: string, datos: Partial<CrearCandyDto & { activo: boolean }>): Promise<ProductoCandy> {
    const payload: Record<string, any> = { ...datos };
    if (datos.precio !== undefined) payload['precio'] = Number(datos.precio);
    if (datos.puntajeCompra !== undefined) payload['puntajeCompra'] = Number(datos.puntajeCompra);
    if (datos.imagen !== undefined) payload['imagen'] = datos.imagen || null;

    return this.actualizarAuto(id, payload);
  }

  protected override mapear(data: Record<string, any>): ProductoCandy {
    return {
      id: data['id'],
      nombre: data['nombre'],
      descripcion: data['descripcion'],
      categoria: data['categoria'],
      precio: data['precio'],
      imagen: data['imagen'],
      puntajeCompra: data['puntaje_compra'] ?? 0,
      activo: data['activo'] ?? true,
      creadoEn: data['creado_en'],
    };
  }
}

