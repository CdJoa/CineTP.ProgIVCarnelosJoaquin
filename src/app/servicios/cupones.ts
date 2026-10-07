import { Injectable } from '@angular/core';
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
   * Obtiene los cupones asignados a un usuario por su ID y evalúa cuáles son aplicables
   * considerando su edad y si es su primera compra.
   */
  async obtenerCuponesDisponiblesUsuario(usuarioId: string, edadUsuario: number, esPrimeraCompra: boolean): Promise<Cupon[]> {
    try {
      // 1. Consultar directamente en cupones_usuario por usuario_id no usados
      const { data: asignaciones, error: errorAsignaciones } = await this.supabase
        .from('cupones_usuario')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('usado', false);

      if (errorAsignaciones) {
        console.warn('Error al consultar cupones_usuario:', errorAsignaciones);
      }

      const cuponIds = (asignaciones || []).map((a: any) => a['cupon_id']).filter(Boolean);

      // 2. Si no tiene cupones asignados y es primera compra, auto-asignar bienvenida
      if (cuponIds.length === 0 && esPrimeraCompra) {
        await this.asignarCuponRegistro(usuarioId);
        const { data: nuevaAsig } = await this.supabase
          .from('cupones_usuario')
          .select('cupon_id')
          .eq('usuario_id', usuarioId)
          .eq('usado', false);
        if (nuevaAsig) {
          for (const item of nuevaAsig) {
            if (item['cupon_id']) cuponIds.push(item['cupon_id']);
          }
        }
      }

      if (cuponIds.length === 0) {
        return [];
      }

      // 3. Obtener los cupones correspondientes desde la tabla cupones
      const { data: cuponesData, error: errorCupones } = await this.supabase
        .from('cupones')
        .select('*')
        .in('id', cuponIds)
        .eq('activo', true);

      if (errorCupones || !cuponesData) {
        console.warn('Error al obtener datos de cupones:', errorCupones);
        return [];
      }

      const cupones: Cupon[] = [];
      for (const item of cuponesData) {
        const cupon = this.mapear(item);

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
    } catch (err) {
      console.warn('Error general obteniendo cupones disponibles:', err);
      return [];
    }
  }

  /**
   * Marca como utilizado un cupón asignado a un usuario
   */
  async marcarCuponUsado(usuarioId: string, cuponId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('cupones_usuario')
        .update({ usado: true, usado_en: new Date().toISOString() })
        .eq('usuario_id', usuarioId)
        .eq('cupon_id', cuponId);

      return !error;
    } catch (e) {
      console.warn('Error marcando cupón como usado:', e);
      return false;
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
