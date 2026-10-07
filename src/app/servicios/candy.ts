import { Injectable, inject } from '@angular/core';
import { CrearCandyDto, ProductoCandy } from '../models/candy';
import { BaseSupabaseService } from './base-supabase';
import { AuditoriaService } from './auditoria';

@Injectable({
  providedIn: 'root',
})
export class CandyService extends BaseSupabaseService<ProductoCandy> {
  protected readonly nombreTabla = 'productos_candy';

  private auditoriaService = inject(AuditoriaService);

  async crearProducto(datos: CrearCandyDto): Promise<ProductoCandy> {
    return this.insertar({
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      categoria: datos.categoria,
      precio: Number(datos.precio),
      imagen: datos.imagen || null,
      puntaje_compra: Number(datos.puntajeCompra),
      cantidad_vendida: Number(datos.cantidadVendida || 0),
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
    if (datos.cantidadVendida !== undefined) payload['cantidad_vendida'] = Number(datos.cantidadVendida);

    const precioAnterior = datos.precio !== undefined ? (await this.obtenerPorId(id))?.precio : undefined;

    const actualizado = await this.actualizarAuto(id, payload);
    if (precioAnterior !== undefined && Number(precioAnterior) !== Number(actualizado.precio)) {
      void this.auditoriaService.registrar(
        'precio_modificado',
        `Producto de Candy "${actualizado.nombre}": $${precioAnterior} → $${actualizado.precio}`
      );
    }
    return actualizado;
  }

  async incrementarCantidadVendida(id: string, cantidad: number = 1): Promise<void> {
    try {
      const prod = await this.obtenerPorId(id);
      if (prod) {
        const actual = Number(prod.cantidadVendida || 0);
        await this.actualizarAuto(id, { cantidad_vendida: actual + cantidad });
      }
    } catch (err) {
      console.error('Error al incrementar cantidad vendida de candy:', err);
    }
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
      cantidadVendida: Number(data['cantidad_vendida'] ?? data['cantidadVendida'] ?? 0),
      activo: data['activo'] ?? true,
      creadoEn: data['creado_en'],
    };
  }
}

