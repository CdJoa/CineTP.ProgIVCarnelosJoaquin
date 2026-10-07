import { Injectable, signal } from '@angular/core';
import { BaseSupabaseService } from './base-supabase';
import {
  Asiento,
  CONFIG_PRECIOS_DEFAULT,
  ConfiguracionPreciosButacas,
  CrearSalaDto,
  FilaSala,
  PRECIOS_ASIENTO,
  Sala,
  TipoFila,
} from '../models/sala';

export const LETRAS_FILAS: string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
];

const STORAGE_KEY_PRECIOS = 'cinetp_precios_butacas';

@Injectable({
  providedIn: 'root',
})
export class SalaService extends BaseSupabaseService<Sala> {
  protected readonly nombreTabla = 'salas';

  public readonly configuracionPrecios = signal<ConfiguracionPreciosButacas>(this.cargarConfiguracionPreciosLocal());

  constructor() {
    super();
    void this.sincronizarConfiguracionDesdeSupabase();
  }

  private cargarConfiguracionPreciosLocal(): ConfiguracionPreciosButacas {
    if (typeof localStorage !== 'undefined') {
      try {
        const guardado = localStorage.getItem(STORAGE_KEY_PRECIOS);
        if (guardado) {
          const parsed = JSON.parse(guardado);
          return {
            multiplicadorComun: Number(parsed.multiplicadorComun ?? 1),
            multiplicadorVip: Number(parsed.multiplicadorVip ?? 1.5),
            multiplicadorDiscapacitado: Number(parsed.multiplicadorDiscapacitado ?? 1),
            precioBaseReferencia: Number(parsed.precioBaseReferencia ?? 5000),
          };
        }
      } catch (e) {
        console.error('Error al leer configuración de precios de butacas:', e);
      }
    }
    return { ...CONFIG_PRECIOS_DEFAULT };
  }

  public async sincronizarConfiguracionDesdeSupabase(): Promise<ConfiguracionPreciosButacas> {
    try {
      const { data, error } = await this.supabase
        .from('configuracion_cine')
        .select('*')
        .eq('id', 'tarifas_butacas')
        .maybeSingle();

      if (!error && data) {
        const config: ConfiguracionPreciosButacas = {
          multiplicadorComun: Number(data.multiplicador_comun ?? 1),
          multiplicadorVip: Number(data.multiplicador_vip ?? 1.5),
          multiplicadorDiscapacitado: Number(data.multiplicador_discapacitado ?? 1),
          precioBaseReferencia: Number(data.precio_base_referencia ?? 5000),
        };
        this.configuracionPrecios.set(config);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_PRECIOS, JSON.stringify(config));
        }
        return config;
      }
    } catch {
      // Si la tabla aún no existe o hay error de red, conserva el valor local
    }
    return this.configuracionPrecios();
  }

  public async guardarConfiguracionPrecios(config: ConfiguracionPreciosButacas): Promise<void> {
    this.configuracionPrecios.set({ ...config });
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PRECIOS, JSON.stringify(config));
      } catch (e) {
        console.error('Error al guardar configuración de precios en localStorage:', e);
      }
    }

    try {
      const { error } = await this.supabase
        .from('configuracion_cine')
        .upsert({
          id: 'tarifas_butacas',
          multiplicador_comun: config.multiplicadorComun,
          multiplicador_vip: config.multiplicadorVip,
          multiplicador_discapacitado: config.multiplicadorDiscapacitado,
          precio_base_referencia: config.precioBaseReferencia,
          actualizado_en: new Date().toISOString(),
        });

      if (error) {
        console.warn('Aviso al guardar en Supabase (verifique si ejecutó configuracion_cine.sql):', error.message);
      }
    } catch (err) {
      console.warn('Aviso al conectar con Supabase:', err);
    }
  }

  public obtenerConfiguracionPrecios(): ConfiguracionPreciosButacas {
    return this.configuracionPrecios();
  }

  public calcularPrecioAsiento(tipo: TipoFila, precioBaseFuncion?: number): number {
    const cfg = this.configuracionPrecios();
    const base = Number(precioBaseFuncion) > 0 ? Number(precioBaseFuncion) : cfg.precioBaseReferencia;

    let multiplicador = cfg.multiplicadorComun;
    if (tipo === 'vip') {
      multiplicador = cfg.multiplicadorVip;
    } else if (tipo === 'discapacitado') {
      multiplicador = cfg.multiplicadorDiscapacitado;
    }

    return Math.round(base * multiplicador);
  }

  protected override mapear(data: Record<string, any>): Sala {
    return {
      id: data['id'],
      nombre: data['nombre'],
      formato: data['formato'] || '2D',
      filas: data['filas'] || this.generarFilas(),
      capacidadTotal: data['capacidad_total'] || data['capacidadTotal'] || 0,
      activa: data['activa'] ?? true,
      creadaEn: data['creada_en'] || data['creadaEn'],
    };
  }

  public generarFilas(): FilaSala[] {
    return LETRAS_FILAS.map((letra, index) => {
      let tipo: TipoFila =
        letra === 'J' || letra === 'K' ? 'discapacitado' :
        letra === 'R' || letra === 'S' || letra === 'T' ? 'vip' : 'comun';

      return this.crearFila(letra, index + 1, tipo);
    });
  }

  public crearFila(letra: string, numeroFila: number, tipo: TipoFila): FilaSala {
    const precio = this.calcularPrecioAsiento(tipo);
    const isDisc = tipo === 'discapacitado';
    const b1Count = isDisc ? 2 : 4;
    const b2Count = isDisc ? 10 : 20;
    const b3Count = isDisc ? 2 : 4;

    let num = 1;

    const crearBloque = (bloqueNum: 1 | 2 | 3, cant: number): Asiento[] => {
      return Array.from({ length: cant }, () => ({
        id: `${letra}-${num}`,
        fila: letra,
        numero: num++,
        bloque: bloqueNum,
        tipo,
        estado: 'disponible',
        precio,
      }));
    };

    const bloque1 = crearBloque(1, b1Count);
    const bloque2 = crearBloque(2, b2Count);
    const bloque3 = crearBloque(3, b3Count);

    return {
      letra,
      numeroFila,
      tipo,
      bloque1,
      bloque2,
      bloque3,
      totalAsientos: bloque1.length + bloque2.length + bloque3.length,
    };
  }

  public calcularCapacidadTotal(filas: FilaSala[]): number {
    return filas.reduce((total, f) => total + f.totalAsientos, 0);
  }

  async obtenerSalas(): Promise<Sala[]> {
    const salas = await this.obtenerTodos('nombre', true);
    for (const sala of salas) {
      sala.filas = this.generarFilas();
      sala.capacidadTotal = this.calcularCapacidadTotal(sala.filas);
    }
    return salas;
  }

  async obtenerSalaPorId(id: string): Promise<Sala | null> {
    const sala = await this.obtenerPorId(id);
    if (sala) {
      sala.filas = this.generarFilas();
      sala.capacidadTotal = this.calcularCapacidadTotal(sala.filas);
    }
    return sala;
  }

  async crearSala(dto: CrearSalaDto): Promise<Sala> {
    const filas = this.generarFilas();
    const capacidadTotal = this.calcularCapacidadTotal(filas);

    const idGenerado = `sala-${Date.now()}`;

    const nuevaSala = await this.insertar({
      id: idGenerado,
      nombre: dto.nombre,
      formato: dto.formato || '2D',
      capacidad_total: capacidadTotal,
      activa: true,
    });

    nuevaSala.filas = filas;
    return nuevaSala;
  }

  async actualizarSala(id: string, payload: Partial<Sala>): Promise<Sala> {
    const datosActualizar: Record<string, any> = { ...payload };
    delete datosActualizar['filas'];

    const filas = this.generarFilas();
    datosActualizar['capacidad_total'] = this.calcularCapacidadTotal(filas);

    const salaActualizada = await this.actualizarAuto(id, datosActualizar);
    salaActualizada.filas = filas;
    return salaActualizada;
  }
}
