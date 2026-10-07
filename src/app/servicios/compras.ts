import { Injectable, inject } from '@angular/core';
import QRCode from 'qrcode';
import { BaseSupabaseService } from './base-supabase';
import { Compra, CrearCompraDto, ItemCandyCompra } from '../models/compra';
import { Auth } from './auth';
import { PeliculasService } from './peliculas';
import { FuncionesService } from './funciones';
import { AsientosRealtimeService } from './asientos-realtime';
import { CuponesService } from './cupones';
import { AuditoriaService } from './auditoria';

const HORAS_LIMITE_CANCELACION = 2;

export interface ResultadoUsoCompra {
  resultado: 'usada' | 'ya_usada' | 'cancelada' | 'inexistente';
  compra: Compra | null;
}

@Injectable({
  providedIn: 'root',
})
export class ComprasService extends BaseSupabaseService<Compra> {
  protected readonly nombreTabla = 'compras';

  private auth = inject(Auth);
  private peliculasService = inject(PeliculasService);
  private funcionesService = inject(FuncionesService);
  private asientosRealtime = inject(AsientosRealtimeService);
  private cuponesService = inject(CuponesService);
  private auditoriaService = inject(AuditoriaService);

  protected mapear(data: Record<string, any>): Compra {
    return {
      id: String(data['id']),
      codigo: String(data['codigo'] || ''),
      usuarioId: data['usuario_id'] || undefined,
      usuarioEmail: data['usuario_email'] || undefined,
      funcionId: String(data['funcion_id'] || ''),
      peliculaId: data['pelicula_id'] || undefined,
      peliculaTitulo: String(data['pelicula_titulo'] || 'Película'),
      peliculaPoster: data['pelicula_poster'] || undefined,
      salaNombre: String(data['sala_nombre'] || 'Sala'),
      funcionInicio: String(data['funcion_inicio'] || ''),
      formato: data['formato'] || undefined,
      idioma: data['idioma'] || undefined,
      asientos: Array.isArray(data['asientos']) ? data['asientos'] : [],
      totalEntradas: Number(data['total_entradas'] || 0),
      itemsCandy: Array.isArray(data['items_candy']) ? data['items_candy'] : [],
      totalCandy: Number(data['total_candy'] || 0),
      descuento: Number(data['descuento'] || 0),
      cuponCodigo: data['cupon_codigo'] || undefined,
      totalFinal: Number(data['total_final'] || 0),
      puntosGanados: Number(data['puntos_ganados'] || 0),
      qrData: String(data['qr_data'] || ''),
      estado: data['estado'] || 'confirmada',
      creadoEn: String(data['creado_en'] || new Date().toISOString()),
    };
  }

  /**
   * Genera un código legible de validación (ej: CINE-7KB92X)
   */
  generarCodigo(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let aleatorio = '';
    for (let i = 0; i < 6; i++) {
      aleatorio += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `CINE-${aleatorio}`;
  }

  /**
   * Genera el Data URL del código QR para mostrar directamente en <img>
   */
  async generarQrImagen(contenido: string): Promise<string> {
    try {
      return await QRCode.toDataURL(contenido, {
        width: 320,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
    } catch (err) {
      console.error('Error generando QR Data URL:', err);
      return '';
    }
  }

  /**
   * Procesa y registra la compra
   */
  async crearCompra(dto: CrearCompraDto): Promise<Compra> {
    const codigo = this.generarCodigo();
    const puntos = dto.puntosGanados !== undefined ? dto.puntosGanados : Math.round(dto.totalFinal);

    // Payload codificado en el QR
    const qrPayload = JSON.stringify({
      codigo,
      funcionId: dto.funcionId,
      pelicula: dto.peliculaTitulo,
      sala: dto.salaNombre,
      inicio: dto.funcionInicio,
      asientos: dto.asientos,
      candyCount: (dto.itemsCandy || []).reduce((acc, it) => acc + it.cantidad, 0),
      total: dto.totalFinal,
      validadorUrl: `https://cinetp.app/validar?codigo=${codigo}`,
    });

    const qrImage = await this.generarQrImagen(qrPayload);

    const payloadBd: Record<string, any> = {
      codigo,
      usuario_id: dto.usuarioId || null,
      funcion_id: dto.funcionId,
      pelicula_id: dto.peliculaId || null,
      asientos: dto.asientos,
      total_entradas: dto.totalEntradas,
      items_candy: dto.itemsCandy || [],
      total_candy: dto.totalCandy || 0,
      descuento: dto.descuento || 0,
      cupon_codigo: dto.cuponCodigo || null,
      total_final: dto.totalFinal,
      puntos_ganados: puntos,
      qr_data: qrPayload,
      estado: 'confirmada',
    };

    const { data, error } = await this.supabase
      .from(this.nombreTabla)
      .insert(payloadBd)
      .select()
      .single();

    if (error) {
      throw new Error(`No se pudo registrar la compra: ${error.message}`);
    }

    const compraCreada: Compra = {
      ...this.mapear(data),
      usuarioEmail: dto.usuarioEmail,
      peliculaTitulo: dto.peliculaTitulo,
      peliculaPoster: dto.peliculaPoster,
      salaNombre: dto.salaNombre,
      funcionInicio: dto.funcionInicio,
      formato: dto.formato || '2D',
      idioma: dto.idioma || 'español',
      qrImage,
    };

    // Efectos secundarios de la compra:
    // 1. Confirmar asientos en realtime
    if (dto.asientos.length > 0) {
      try {
        await this.asientosRealtime.confirmar(dto.funcionId, dto.asientos);
      } catch (e) {
        console.warn('No se pudo confirmar asientos via RPC:', e);
      }
    }

    // 2. Incrementar boletos vendidos en la película
    if (dto.peliculaId && dto.asientos.length > 0) {
      try {
        await this.peliculasService.incrementarBoletosVendidos(dto.peliculaId, dto.asientos.length);
      } catch (e) {
        console.warn('No se pudo incrementar boletos vendidos:', e);
      }
    }

    // 3. Sumar puntos al usuario si está autenticado
    if (dto.usuarioId && puntos > 0) {
      try {
        await this.auth.actualizarPuntos(puntos);
      } catch (e) {
        console.warn('No se pudieron actualizar puntos en usuario:', e);
      }
    }

    // 4. Marcar cupón como usado si el usuario lo aplicó
    if (dto.usuarioId && dto.cuponId) {
      try {
        await this.cuponesService.marcarCuponUsado(dto.usuarioId, dto.cuponId);
      } catch (e) {
        console.warn('No se pudo marcar cupón como usado:', e);
      }
    }

    // 5. Registrar evento en auditoría
    const detalleCompra = `Entradas para "${dto.peliculaTitulo || 'Película'}" en ${dto.salaNombre || 'Sala'} (${dto.asientos.join(', ')}). Total: $${dto.totalFinal}`;
    void this.auditoriaService.registrar('compra_realizada', detalleCompra, {
      id: dto.usuarioId,
      email: dto.usuarioEmail,
    });

    return (await this.enriquecerCompras([compraCreada]))[0];
  }

  /**
   * Obtiene compras de un usuario específico
   */
  async obtenerComprasUsuario(usuarioId: string): Promise<Compra[]> {
    const { data, error } = await this.supabase
      .from(this.nombreTabla)
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const compras = (data || []).map((d) => this.mapear(d));
    for (const item of compras) {
      if (item.qrData) {
        item.qrImage = await this.generarQrImagen(item.qrData);
      }
    }

    return await this.enriquecerCompras(compras);
  }

  /**
   * Enriquece las compras relacionando pelicula_id y funcion_id con los catálogos
   */
  async enriquecerCompras(lista: Compra[]): Promise<Compra[]> {
    if (!lista.length) return [];
    try {
      const [todasPeliculas, todasFunciones] = await Promise.all([
        this.peliculasService.obtenerPeliculas().catch(() => []),
        this.funcionesService.obtenerFuncionesCompleta().catch(() => []),
      ]);

      const mapPelis = new Map<string, any>(todasPeliculas.map((p) => [String(p.id), p]));
      const mapFuncs = new Map<string, any>(todasFunciones.map((f) => [String(f.id), f]));

      for (const c of lista) {
        if (c.peliculaId && mapPelis.has(String(c.peliculaId))) {
          const p = mapPelis.get(String(c.peliculaId))!;
          c.restriccionEdad = Number(p.restriccionEdad || 0);
          if (!c.peliculaTitulo || c.peliculaTitulo === 'Película') {
            c.peliculaTitulo = p.titulo;
          }
          if (!c.peliculaPoster) {
            c.peliculaPoster = p.poster;
          }
        }
        if (c.funcionId && mapFuncs.has(String(c.funcionId))) {
          const f = mapFuncs.get(String(c.funcionId))!;
          if (!c.salaNombre || c.salaNombre === 'Sala') {
            c.salaNombre = f.salaNombre || 'Sala';
          }
          if (!c.funcionInicio) {
            c.funcionInicio = f.inicio;
          }
          if (!c.formato) {
            c.formato = f.formato;
          }
          if (!c.idioma) {
            c.idioma = f.idioma;
          }
          if (!c.peliculaTitulo || c.peliculaTitulo === 'Película') {
            c.peliculaTitulo = f.peliculaTitulo || c.peliculaTitulo;
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo enriquecer compras con datos foráneos:', e);
    }
    return lista;
  }

  /**
   * Obtener una compra por su código (para boletería o candy bar)
   */
  async obtenerPorCodigo(codigo: string): Promise<Compra | null> {
    const codLimpio = codigo.trim().toUpperCase();
    const { data, error } = await this.supabase
      .from(this.nombreTabla)
      .select('*')
      .eq('codigo', codLimpio)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) return null;

    const compra = this.mapear(data);
    compra.qrImage = await this.generarQrImagen(compra.qrData);
    return (await this.enriquecerCompras([compra]))[0];
  }

  /**
   * Valida una compra por su código (escaneado del QR o dictado) y la pasa de
   * 'confirmada' a 'usado'. Sirve tanto para el ingreso a sala como para el Candy Bar.
   */
  async usarCompra(codigo: string): Promise<ResultadoUsoCompra> {
    const compra = await this.obtenerPorCodigo(codigo);
    if (!compra) return { resultado: 'inexistente', compra: null };
    if (compra.estado === 'cancelada') return { resultado: 'cancelada', compra };
    if (compra.estado === 'usado') return { resultado: 'ya_usada', compra };

    // El filtro por estado evita que dos escaneos simultáneos validen la misma compra
    const { data, error } = await this.supabase
      .from(this.nombreTabla)
      .update({ estado: 'usado' })
      .eq('id', compra.id)
      .eq('estado', 'confirmada')
      .select();

    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.length === 0) return { resultado: 'ya_usada', compra };

    return { resultado: 'usada', compra: { ...compra, estado: 'usado' } };
  }

  /**
   * Indica si la compra todavía puede cancelarse: confirmada (sin usar) y
   * faltando al menos 2 horas para el inicio de la función.
   */
  puedeCancelar(compra: Compra): boolean {
    if (compra.estado !== 'confirmada') return false;

    const inicio = new Date(compra.funcionInicio).getTime();
    if (isNaN(inicio)) return false;
    return inicio - Date.now() >= HORAS_LIMITE_CANCELACION * 60 * 60 * 1000;
  }

  /**
   * Cancela la compra. No se devuelve dinero: los puntos que generó pasan a
   * ser crédito a favor del usuario. Devuelve el crédito acreditado.
   */
  async cancelarCompra(compra: Compra): Promise<number> {
    const { data, error } = await this.supabase.rpc('cancelar_compra', { p_compra_id: compra.id });

    if (error) {
      if (error.code === 'PGRST202') {
        throw new Error('La cancelación no está habilitada: falta ejecutar supabase/cancelar_compra.sql.');
      }
      throw new Error(error.message);
    }

    this.auth.establecerSaldo(Number(data?.['puntos'] || 0), Number(data?.['credito'] || 0));

    const creditoAcreditado = Number(data?.['credito_acreditado'] || 0);

    void this.auditoriaService.registrar(
      'compra_cancelada',
      `Cancelación de entrada #${compra.codigo || compra.id.slice(0, 8)}: "${compra.peliculaTitulo || 'Película'}" (${compra.asientos.join(', ')}). Crédito acreditado: $${creditoAcreditado}`,
      {
        id: compra.usuarioId,
        email: compra.usuarioEmail,
      }
    );

    return creditoAcreditado;
  }
}
