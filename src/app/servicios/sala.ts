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

  public generarFilas(): FilaSala[] {
    return LETRAS_FILAS.map((letra, index) => {
      let tipo: TipoFila =
        letra === 'J' || letra === 'K' ? 'discapacitado' :
        letra === 'R' || letra === 'S' || letra === 'T' ? 'vip' : 'comun';

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
