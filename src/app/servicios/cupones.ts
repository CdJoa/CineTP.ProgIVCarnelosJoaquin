import { Injectable, inject } from '@angular/core';
import { BaseSupabaseService } from './base-supabase';
import { CrearCuponDto, Cupon, CuponUsuario } from '../models/cupon';

@Injectable({
  providedIn: 'root',
})
export class CuponesService extends BaseSupabaseService<Cupon> {
  protected readonly nombreTabla = 'cupones';

  /**
   * Obtiene todos los cupones creados en la base de datos
   */
  async obtenerCupones(): Promise<Cupon[]> {
    try {
      return await this.obtenerTodos('creado_en', false);
    } catch {
      return await this.obtenerTodos('id', true);
    }
  }

  /**
   * Obtiene todos los cupones activos ordenados por porcentaje o fecha de creación
   */
  async obtenerCuponesActivos(): Promise<Cupon[]> {
    try {
      const todos = await this.obtenerCupones();
      return todos.filter((c) => c.activo);
    } catch {
      return [];
    }
  }

  /**
   * Asigna automáticamente el cupón de registro/bienvenida al usuario recién registrado
   */
  async asignarCuponRegistro(usuarioId: string): Promise<boolean> {
    try {
      const cupones = await this.obtenerCuponesActivos();
      // Buscar cupón de registro o bienvenida por código o flag esPrimeraCompra
      let cuponRegistro = cupones.find((c) => c.codigo.toUpperCase() === 'REGISTRO' || c.codigo.toUpperCase() === 'BIENVENIDA' || c.esPrimeraCompra);

      // Si no existe en BD aún, lo creamos dinámicamente como cupón por defecto (20% OFF)
      if (!cuponRegistro) {
        cuponRegistro = await this.insertar({
          codigo: 'BIENVENIDA',
          nombre: 'Cupón de Bienvenida',
          descripcion: 'Descuento especial de bienvenida del 20% para tu primera compra.',
          porcentaje_descuento: 20,
          es_primera_compra: true,
          activo: true,
        });
      }

      // Asignar en tabla cupones_usuario
      await this.supabase.from('cupones_usuario').insert([{
        usuario_id: usuarioId,
        cupon_id: cuponRegistro.id,
        usado: false,
        asignado_en: new Date().toISOString(),
      }]);

      return true;
    } catch (err) {
      console.warn('Aviso: no se pudo asignar cupón automático de bienvenida:', err);
      return false;
    }
  }

  /**
   * Obtiene los cupones asignados a un usuario y evalúa cuáles son aplicables
   * considerando su edad y si es su primera compra.
   */
  async obtenerCuponesDisponiblesUsuario(usuarioId: string, edadUsuario: number, esPrimeraCompra: boolean): Promise<Cupon[]> {
    try {
      const { data, error } = await this.supabase
        .from('cupones_usuario')
        .select('*, cupon:cupones(*)')
        .eq('usuario_id', usuarioId)
        .eq('usado', false);

      if (error || !data) return [];

      const cupones: Cupon[] = [];
      for (const item of data) {
        const cData = item.cupon;
        if (!cData || !cData.activo) continue;

        const cupon = this.mapear(cData);

        // Validar filtro por edad si requiere edad mínima (ej: 50 años)
        if (cupon.edadMinimaRequerida && edadUsuario < cupon.edadMinimaRequerida) {
          continue;
        }

        // Validar filtro por primera compra
        if (cupon.esPrimeraCompra && !esPrimeraCompra) {
          continue;
        }

        cupones.push(cupon);
      }

      return cupones;
    } catch {
      return [];
    }
  }

  protected override mapear(data: Record<string, any>): Cupon {
    return {
      id: data['id'],
      codigo: data['codigo'] || '',
      nombre: data['nombre'] || '',
      descripcion: data['descripcion'] || '',
      porcentajeDescuento: Number(data['porcentaje_descuento'] || data['porcentajeDescuento'] || 0),
      edadMinimaRequerida: data['edad_minima_requerida'] !== undefined
        ? Number(data['edad_minima_requerida'])
        : (data['edadMinimaRequerida'] ? Number(data['edadMinimaRequerida']) : undefined),
      esPrimeraCompra: !!(data['es_primera_compra'] ?? data['esPrimeraCompra']),
      activo: !!(data['activo'] ?? true),
      creadoEn: data['creado_en'] || data['creadoEn'],
    };
  }
}
