import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client';
import { Auth } from './auth';
import { AuditoriaService } from './auditoria';

export interface ConfiguracionPuntos {
  puntosPorPeso: number; // Cuántos puntos equivalen a $1 de crédito
  minimoPuntos: number;  // Mínimo de puntos por conversión
}

export interface CanjePuntos {
  id: string;
  puntos: number;
  credito: number;
  puntosPorPeso: number;
  creadoEn: string;
}

export const CONFIG_PUNTOS_DEFAULT: ConfiguracionPuntos = { puntosPorPeso: 10, minimoPuntos: 100 };

const FALTA_SQL = 'Falta ejecutar supabase/convertidor-puntos.sql en Supabase.';

/**
 * Programa de fidelización: el usuario gana 1 punto por cada peso gastado y
 * puede convertir sus puntos en crédito según la tasa que configura el admin.
 */
@Injectable({ providedIn: 'root' })
export class PuntosService {
  private supabase = inject(SupabaseClientService).client;
  private auth = inject(Auth);
  private auditoria = inject(AuditoriaService);

  readonly configuracion = signal<ConfiguracionPuntos>({ ...CONFIG_PUNTOS_DEFAULT });

  async cargarConfiguracion(): Promise<ConfiguracionPuntos> {
    const { data, error } = await this.supabase
      .from('configuracion_puntos')
      .select('puntos_por_peso, minimo_puntos')
      .eq('id', 1)
      .maybeSingle();

    if (!error && data) {
      this.configuracion.set({
        puntosPorPeso: Number(data['puntos_por_peso']) || CONFIG_PUNTOS_DEFAULT.puntosPorPeso,
        minimoPuntos: Number(data['minimo_puntos']) || CONFIG_PUNTOS_DEFAULT.minimoPuntos,
      });
    }
    return this.configuracion();
  }

  async guardarConfiguracion(config: ConfiguracionPuntos): Promise<void> {
    const anterior = this.configuracion();
    const { data, error } = await this.supabase
      .from('configuracion_puntos')
      .update({
        puntos_por_peso: config.puntosPorPeso,
        minimo_puntos: config.minimoPuntos,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', 1)
      .select();

    if (error) throw new Error(this.traducirError(error));
    if (!data || data.length === 0) {
      throw new Error('No se guardó: falta ejecutar el SQL o no tenés permiso de administrador.');
    }

    this.configuracion.set({ ...config });
    void this.auditoria.registrar(
      'precio_modificado',
      `Programa de puntos: ${anterior.puntosPorPeso} pts = $1 → ${config.puntosPorPeso} pts = $1; ` +
        `mínimo ${anterior.minimoPuntos} → ${config.minimoPuntos} pts`
    );
  }

  /** Crédito que se obtiene por una cantidad de puntos con la tasa vigente. */
  calcularCredito(puntos: number): number {
    return Math.floor(puntos / this.configuracion().puntosPorPeso);
  }

  /** Convierte puntos en crédito de forma atómica (RPC). Devuelve el crédito acreditado. */
  async convertir(puntos: number): Promise<number> {
    const { data, error } = await this.supabase.rpc('convertir_puntos_a_credito', { p_puntos: puntos });
    if (error) throw new Error(this.traducirError(error));

    this.auth.establecerSaldo(Number(data?.['puntos'] || 0), Number(data?.['credito'] || 0));
    const acreditado = Number(data?.['credito_acreditado'] || 0);

    void this.auditoria.registrar('puntos_convertidos', `Conversión de ${puntos} puntos en $${acreditado} de crédito`);
    return acreditado;
  }

  async obtenerHistorial(usuarioId: string): Promise<CanjePuntos[]> {
    const { data, error } = await this.supabase
      .from('canjes_puntos')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false })
      .limit(50);

    if (error) throw new Error(this.traducirError(error));
    return (data || []).map((row) => ({
      id: String(row['id']),
      puntos: Number(row['puntos'] || 0),
      credito: Number(row['credito'] || 0),
      puntosPorPeso: Number(row['puntos_por_peso'] || 0),
      creadoEn: String(row['creado_en'] || ''),
    }));
  }

  /** Últimas conversiones de todos los usuarios (solo admin, por RLS). */
  async obtenerHistorialGeneral(): Promise<(CanjePuntos & { usuario: string })[]> {
    const { data, error } = await this.supabase
      .from('canjes_puntos')
      .select('*, usuarios(nombre, apellido, email)')
      .order('creado_en', { ascending: false })
      .limit(30);

    if (error) throw new Error(this.traducirError(error));
    return (data || []).map((row) => {
      const u = row['usuarios'] as Record<string, string> | null;
      return {
        id: String(row['id']),
        puntos: Number(row['puntos'] || 0),
        credito: Number(row['credito'] || 0),
        puntosPorPeso: Number(row['puntos_por_peso'] || 0),
        creadoEn: String(row['creado_en'] || ''),
        usuario: u ? `${u['nombre'] || ''} ${u['apellido'] || ''}`.trim() || u['email'] : 'Usuario',
      };
    });
  }

  private traducirError(error: { code?: string; message: string }): string {
    // 42P01: tabla inexistente · PGRST202/PGRST205: función o tabla no encontrada en el esquema
    if (['42P01', 'PGRST202', 'PGRST205'].includes(error.code || '')) return FALTA_SQL;
    return error.message;
  }
}
