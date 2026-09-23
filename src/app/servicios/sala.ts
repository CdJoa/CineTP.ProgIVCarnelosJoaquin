import { Injectable } from '@angular/core';
import { BaseSupabaseService } from './base-supabase';
import { Asiento, CrearSalaDto, FilaSala, PRECIOS_ASIENTO, Sala, TipoFila } from '../models/sala';

export const LETRAS_FILAS: string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
];

@Injectable({
  providedIn: 'root',
})
export class SalaService extends BaseSupabaseService<Sala> {
  protected readonly nombreTabla = 'salas';

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

  public generarFilas(configuracionFilas?: Record<string, TipoFila>): FilaSala[] {
    return LETRAS_FILAS.map((letra, index) => {
      let tipo: TipoFila = configuracionFilas?.[letra] ||
        (letra === 'J' || letra === 'K' ? 'discapacitado' :
         letra === 'R' || letra === 'S' || letra === 'T' ? 'vip' : 'comun');

      return this.crearFila(letra, index + 1, tipo);
    });
  }

  public crearFila(letra: string, numeroFila: number, tipo: TipoFila): FilaSala {
    const precio = PRECIOS_ASIENTO[tipo];
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
      await this.cargarAsientosRelacionales(sala);
    }
    return salas;
  }

  async obtenerSalaPorId(id: string): Promise<Sala | null> {
    const sala = await this.obtenerPorId(id);
    if (sala) {
      await this.cargarAsientosRelacionales(sala);
    }
    return sala;
  }

  private async cargarAsientosRelacionales(sala: Sala): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('asientos')
        .select('*')
        .eq('sala_id', sala.id)
        .order('numero', { ascending: true });

      if (data && data.length > 0 && !error) {
        sala.filas = this.reconstruirFilasDesdeAsientos(data);
        sala.capacidadTotal = sala.filas.reduce((sum, f) => sum + f.totalAsientos, 0);
      }
    } catch {
      // Si la tabla asientos no ha sido creada aún en Supabase, se mantiene la estructura por defecto
    }
  }

  private reconstruirFilasDesdeAsientos(asientosDb: Record<string, any>[]): FilaSala[] {
    const configFilas: Record<string, TipoFila> = {};
    for (const a of asientosDb) {
      if (a['fila']) {
        configFilas[a['fila']] = a['tipo'] as TipoFila;
      }
    }
    return this.generarFilas(configFilas);
  }

  async crearSala(dto: CrearSalaDto): Promise<Sala> {
    const filas = this.generarFilas(dto.configuracionFilas);
    const capacidadTotal = this.calcularCapacidadTotal(filas);

    // 1. Insertar la sala en la tabla 'salas'
    const nuevaSala = await this.insertar({
      nombre: dto.nombre,
      formato: dto.formato || '2D',
      capacidad_total: capacidadTotal,
      activa: true,
    });

    nuevaSala.filas = filas;

    // 2. Insertar los asientos de forma relacional en la tabla 'asientos' con sala_id
    await this.guardarAsientosRelacionales(nuevaSala.id, filas);

    return nuevaSala;
  }

  async actualizarSala(id: string, payload: Partial<Sala>): Promise<Sala> {
    const datosActualizar: Record<string, any> = { ...payload };
    delete datosActualizar['filas'];

    if (payload.filas) {
      datosActualizar['capacidad_total'] = this.calcularCapacidadTotal(payload.filas);
    }

    const salaActualizada = await this.actualizarAuto(id, datosActualizar);

    if (payload.filas) {
      salaActualizada.filas = payload.filas;
      await this.guardarAsientosRelacionales(id, payload.filas);
    } else {
      await this.cargarAsientosRelacionales(salaActualizada);
    }

    return salaActualizada;
  }

  private async guardarAsientosRelacionales(salaId: string, filas: FilaSala[]): Promise<void> {
    try {
      // Borrar asientos previos para esta sala
      await this.supabase.from('asientos').delete().eq('sala_id', salaId);

      // Aplanar asientos para inserción relacional
      const asientosBatch: Record<string, any>[] = [];
      for (const f of filas) {
        const todosAsientos = [...f.bloque1, ...f.bloque2, ...f.bloque3];
        for (const a of todosAsientos) {
          asientosBatch.push({
            id: `${salaId}_${a.id}`,
            sala_id: salaId,
            fila: a.fila,
            numero: a.numero,
            bloque: a.bloque,
            tipo: a.tipo,
            precio: a.precio,
            estado: a.estado || 'disponible',
          });
        }
      }

      if (asientosBatch.length > 0) {
        await this.supabase.from('asientos').insert(asientosBatch);
      }
    } catch (err) {
      console.warn('Aviso al guardar asientos relacionales:', err);
    }
  }
}
