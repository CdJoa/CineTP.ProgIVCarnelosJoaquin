import { Injectable, inject } from '@angular/core';
import { BaseSupabaseService } from './base-supabase';
import { CrearFuncionDto, EstadoFuncion, Formato, Idioma, Funcion } from '../models/funcion';
import { PeliculasService } from './peliculas';
import { SalaService } from './sala';
import { AuditoriaService } from './auditoria';

export interface OpcionesGeneracionAutomatica {
  peliculaId: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;    // YYYY-MM-DD
  turnos: ('mañana' | 'tarde' | 'noche')[];
  diasSemana?: number[]; // [0 = Domingo, 1 = Lunes, ..., 6 = Sábado]
  prioridad: 'alta' | 'media' | 'baja';
  precio: number;
  esPreventa?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class FuncionesService extends BaseSupabaseService<Funcion> {
  protected readonly nombreTabla = 'funciones';

  private peliculasService = inject(PeliculasService);
  private salaService = inject(SalaService);
  private auditoriaService = inject(AuditoriaService);

  private describirFuncion(funcion: Funcion): string {
    const inicio = new Date(funcion.inicio).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `"${funcion.peliculaTitulo}" en ${funcion.salaNombre} el ${inicio}`;
  }

  /**
   * Calcula la fecha/hora de finalización incluyendo el tiempo de la película
   * MÁS 30 minutos extras para limpieza y preparación de la sala.
   */
  public calcularFin(inicioIso: string, duracionPeliculaMinutos: number): string {
    if (!inicioIso) return '';
    const d = new Date(inicioIso);
    if (isNaN(d.getTime())) return '';

    const duracionTotalMinutos = Number(duracionPeliculaMinutos || 0) + 30;
    const finDate = new Date(d.getTime() + duracionTotalMinutos * 60 * 1000);
    return finDate.toISOString();
  }

  private seSolapan(inicioA: number, finA: number, inicioB: number, finB: number): boolean {
    return inicioA < finB && finA > inicioB;
  }

  private async validarDisponibilidad(
    salaId: string,
    inicioIso: string,
    finIso: string,
    idFuncionActual?: string
  ): Promise<void> {
    const { solapada, funcionSolapada } = await this.verificarSolapamiento(
      salaId,
      inicioIso,
      finIso,
      idFuncionActual
    );
    if (!solapada || !funcionSolapada) return;

    const horaInicio = new Date(funcionSolapada.inicio).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const finSolapado = funcionSolapada.fin || this.calcularFin(
      funcionSolapada.inicio,
      funcionSolapada.duracionPelicula || 120
    );
    const horaFin = finSolapado
      ? new Date(finSolapado).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'fin';

    throw new Error(
      `La sala elegida ya está ocupada por "${funcionSolapada.peliculaTitulo}" de ${horaInicio} a ${horaFin} (incluyendo los 30 min de limpieza y preparación).`
    );
  }

  private mapearConRelaciones(
    funcion: Funcion,
    pelicula: Awaited<ReturnType<PeliculasService['obtenerPeliculas']>>[number] | undefined,
    sala: Awaited<ReturnType<SalaService['obtenerSalas']>>[number] | undefined,
    duracionFallback = 120
  ): Funcion {
    const duracionPeli = pelicula?.duracion || duracionFallback || 120;
    return {
      ...funcion,
      fin: this.calcularFin(funcion.inicio, duracionPeli),
      peliculaTitulo: pelicula?.titulo || 'Película no encontrada',
      duracionPelicula: duracionPeli,
      salaNombre: sala?.nombre || 'Sala no encontrada',
    };
  }

  private async enriquecerFuncion(funcion: Funcion, duracionFallback = 120): Promise<Funcion> {
    const [peliculas, salas] = await Promise.all([
      this.peliculasService.obtenerPeliculas().catch(() => []),
      this.salaService.obtenerSalas().catch(() => []),
    ]);
    return this.mapearConRelaciones(
      funcion,
      peliculas.find((pelicula) => pelicula.id === funcion.peliculaId),
      salas.find((sala) => sala.id === funcion.salaId),
      duracionFallback
    );
  }

  /**
   * Verifica si la sala dada ya tiene una función programada que se solape
   * en el rango [inicio, fin] (que contempla la película + 30 min de limpieza).
   */
  async verificarSolapamiento(
    salaId: string,
    inicioIso: string,
    finIso: string,
    idFuncionActual?: string
  ): Promise<{ solapada: boolean; funcionSolapada?: Funcion }> {
    const inicioNuevo = new Date(inicioIso).getTime();
    const finNuevo = new Date(finIso).getTime();

    const funcionesExistentes = await this.obtenerFuncionesCompleta();
    const funcionesSala = funcionesExistentes.filter(
      (f) => f.salaId === salaId && f.estado === 'programada' && f.id !== idFuncionActual
    );

    for (const f of funcionesSala) {
      const inicioExistente = new Date(f.inicio).getTime();
      const finExistente = new Date(f.fin || this.calcularFin(f.inicio, f.duracionPelicula || 120)).getTime();

      if (this.seSolapan(inicioNuevo, finNuevo, inicioExistente, finExistente)) {
        return { solapada: true, funcionSolapada: f };
      }
    }

    return { solapada: false };
  }

  async obtenerFuncionesCompleta(): Promise<Funcion[]> {
    let funciones: Funcion[] = [];
    try {
      funciones = await this.obtenerTodos('inicio', false);
    } catch {
      funciones = [];
    }

    // Enriquecer con nombres de películas y salas
    const [peliculas, salas] = await Promise.all([
      this.peliculasService.obtenerPeliculas().catch(() => []),
      this.salaService.obtenerSalas().catch(() => []),
    ]);

    const mapPeliculas = new Map(peliculas.map((p) => [p.id, p]));
    const mapSalas = new Map(salas.map((s) => [s.id, s]));

    return funciones.map((funcion) => this.mapearConRelaciones(
      funcion,
      mapPeliculas.get(funcion.peliculaId),
      mapSalas.get(funcion.salaId || '')
    ));
  }

  async crearFuncionConValidacion(dto: CrearFuncionDto, duracionPelicula: number): Promise<Funcion> {
    const finIso = this.calcularFin(dto.inicio, duracionPelicula);
    await this.validarDisponibilidad(dto.salaId || '', dto.inicio, finIso);

    const payload = {
      pelicula_id: dto.peliculaId,
      sala_id: dto.salaId,
      inicio: dto.inicio,
      fin: finIso,
      precio: Number(dto.precio),
      es_preventa: Boolean(dto.esPreventa),
      formato: dto.formato || '2D',
      idioma: dto.idioma || 'español',
      estado: dto.estado || 'programada',
    };

    const creada = await this.enriquecerFuncion(await this.insertar(payload), duracionPelicula);
    void this.auditoriaService.registrar(
      'funcion_creada',
      `Función de ${this.describirFuncion(creada)} (${creada.formato}, ${creada.idioma}) a $${creada.precio}`
    );
    return creada;
  }

  async actualizarFuncionConValidacion(
    id: string,
    dto: Partial<CrearFuncionDto>,
    duracionPelicula: number
  ): Promise<Funcion> {
    if (dto.inicio && dto.salaId) {
      const finIso = this.calcularFin(dto.inicio, duracionPelicula);
      await this.validarDisponibilidad(dto.salaId, dto.inicio, finIso, id);
    }

    const payload: Record<string, any> = {};
    if (dto.peliculaId) payload['pelicula_id'] = dto.peliculaId;
    if (dto.salaId) payload['sala_id'] = dto.salaId;
    if (dto.inicio) {
      payload['inicio'] = dto.inicio;
      payload['fin'] = this.calcularFin(dto.inicio, duracionPelicula);
    }
    if (dto.precio !== undefined) payload['precio'] = Number(dto.precio);
    if (dto.esPreventa !== undefined) payload['es_preventa'] = Boolean(dto.esPreventa);
    if (dto.formato) payload['formato'] = dto.formato;
    if (dto.idioma) payload['idioma'] = dto.idioma;
    if (dto.estado) payload['estado'] = dto.estado;

    const precioAnterior = dto.precio !== undefined ? (await this.obtenerPorId(id))?.precio : undefined;

    const actualizada = await this.enriquecerFuncion(await this.actualizar(id, payload), duracionPelicula);
    if (precioAnterior !== undefined && precioAnterior !== actualizada.precio) {
      void this.auditoriaService.registrar(
        'precio_modificado',
        `Función de ${this.describirFuncion(actualizada)}: $${precioAnterior} → $${actualizada.precio}`
      );
    }
    return actualizada;
  }

  /**
   * Generación automática de funciones alternando formatos, idiomas, turnos y prioridad.
   */
  async generarFuncionesAutomaticas(opciones: OpcionesGeneracionAutomatica): Promise<Funcion[]> {
    const [peliculas, salas] = await Promise.all([
      this.peliculasService.obtenerPeliculas().catch(() => []),
      this.salaService.obtenerSalas().catch(() => []),
    ]);

    const pelicula = peliculas.find((p) => p.id === opciones.peliculaId);
    if (!pelicula) {
      throw new Error('Película no encontrada.');
    }

    const salasActivas = salas.filter((s) => s.activa !== false);
    if (salasActivas.length === 0) {
      throw new Error('No hay salas activas disponibles para programar funciones.');
    }

    const duracionPeli = pelicula.duracion || 120;
    const duracionTotalMs = (duracionPeli + 30) * 60 * 1000; // Película + 30 min de limpieza

    // Determinar incremento / intervalo según la prioridad
    let intervaloMs = duracionTotalMs;
    if (opciones.prioridad === 'media') {
      intervaloMs += 45 * 60 * 1000; // +45 min extra
    } else if (opciones.prioridad === 'baja') {
      intervaloMs += 90 * 60 * 1000; // +90 min extra
    }

    // Definición de rangos por turno
    const rangosTurnos: Record<'mañana' | 'tarde' | 'noche', { inicioHora: number; finHora: number }> = {
      mañana: { inicioHora: 10, finHora: 14 },
      tarde: { inicioHora: 14, finHora: 19 },
      noche: { inicioHora: 19, finHora: 23 },
    };

    const funcionesGeneradasPayload: any[] = [];
    const funcionesExistentes = await this.obtenerFuncionesCompleta();

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaEstrenoDate = pelicula.fechaEstreno ? new Date(`${pelicula.fechaEstreno}T00:00:00`) : hoy;
    const inicioMin = fechaEstrenoDate > hoy ? fechaEstrenoDate : hoy;

    const userInicio = opciones.fechaInicio ? new Date(`${opciones.fechaInicio}T00:00:00`) : hoy;
    const fechaInicioCalcular = userInicio > inicioMin ? userInicio : inicioMin;

    const userFin = opciones.fechaFin ? new Date(`${opciones.fechaFin}T23:59:59`) : null;
    const defaultFin = new Date(fechaInicioCalcular.getTime() + 15 * 24 * 60 * 60 * 1000);
    const fechaFinCalcular = userFin && userFin >= fechaInicioCalcular ? userFin : defaultFin;

    let inicioLoop = new Date(fechaInicioCalcular.getTime());
    const finLoop = new Date(fechaFinCalcular.getTime());

    // Precio a aplicar
    const precioAplicar = Number(opciones.precio || 5000);

    let contadorVariacion = 0;

    const pad = (n: number) => n.toString().padStart(2, '0');

    const totalSalas = salasActivas.length;
    let maxSalasPorTurno = 1;
    let maxFuncionesPorSalaTurno = 1;

    if (opciones.prioridad === 'alta') {
      maxSalasPorTurno = Math.min(totalSalas, Math.max(1, Math.ceil(totalSalas * 0.25)));
      maxFuncionesPorSalaTurno = 2;
    } else if (opciones.prioridad === 'media') {
      maxSalasPorTurno = Math.min(totalSalas, Math.max(1, Math.ceil(totalSalas * 0.15)));
      maxFuncionesPorSalaTurno = 1;
    } else {
      maxSalasPorTurno = 1;
      maxFuncionesPorSalaTurno = 1;
    }

    while (inicioLoop <= finLoop) {
      const diaSemana = inicioLoop.getDay();
      if (opciones.diasSemana && opciones.diasSemana.length > 0 && !opciones.diasSemana.includes(diaSemana)) {
        inicioLoop.setDate(inicioLoop.getDate() + 1);
        continue;
      }

      const fechaStr = `${inicioLoop.getFullYear()}-${pad(inicioLoop.getMonth() + 1)}-${pad(inicioLoop.getDate())}`;

      for (const turno of opciones.turnos) {
        const configTurno = rangosTurnos[turno];
        if (!configTurno) continue;

        const horaInicioTurno = new Date(`${fechaStr}T${String(configTurno.inicioHora).padStart(2, '0')}:00:00`);
        const horaFinTurno = new Date(`${fechaStr}T${String(configTurno.finHora).padStart(2, '0')}:00:00`);

        let salasAsignadasEnTurno = 0;

        for (let sIdx = 0; sIdx < totalSalas; sIdx++) {
          if (salasAsignadasEnTurno >= maxSalasPorTurno) break;

          const sala = salasActivas[(sIdx + contadorVariacion) % totalSalas];
          let horaActual = new Date(horaInicioTurno.getTime());
          let funcionesAgregadasEnSala = 0;

          while (horaActual.getTime() + duracionTotalMs <= horaFinTurno.getTime() + 60 * 60 * 1000) {
            if (funcionesAgregadasEnSala >= maxFuncionesPorSalaTurno) break;

            const candInicioIso = horaActual.toISOString();
            const candFinIso = new Date(horaActual.getTime() + duracionTotalMs).toISOString();

            // Verificar que no sea pasado
            if (horaActual.getTime() > new Date().getTime()) {
              // Verificar solapamiento con existentes y con el batch en generación
              const candInicioMs = horaActual.getTime();
              const candFinMs = horaActual.getTime() + duracionTotalMs;

              let haySolapamiento = false;

              // Solapamiento con BD
              for (const fEx of funcionesExistentes) {
                if (fEx.salaId === sala.id && fEx.estado === 'programada') {
                  const exInMs = new Date(fEx.inicio).getTime();
                  const exFinIso = fEx.fin || this.calcularFin(fEx.inicio, fEx.duracionPelicula || 120);
                  const exFinMs = new Date(exFinIso).getTime();
                  if (this.seSolapan(candInicioMs, candFinMs, exInMs, exFinMs)) {
                    haySolapamiento = true;
                    break;
                  }
                }
              }

              // Solapamiento con las recién generadas en memoria
              if (!haySolapamiento) {
                for (const fGen of funcionesGeneradasPayload) {
                  if (fGen.sala_id === sala.id) {
                    const genInMs = new Date(fGen.inicio).getTime();
                    const genFinMs = new Date(fGen.fin).getTime();
                    if (this.seSolapan(candInicioMs, candFinMs, genInMs, genFinMs)) {
                      haySolapamiento = true;
                      break;
                    }
                  }
                }
              }

              if (!haySolapamiento) {
                // Alternar idioma entre 'español' y 'subtitulado'
                const idiomasVariados: Idioma[] = ['español', 'subtitulado'];
                const idiomaElegido = idiomasVariados[contadorVariacion % idiomasVariados.length];

                // El formato de la función adopta estrictamente el formato configurado en la sala (2D o 3D)
                const formatoElegido: Formato = (sala.formato as Formato) || '2D';

                funcionesGeneradasPayload.push({
                  pelicula_id: opciones.peliculaId,
                  sala_id: sala.id,
                  inicio: candInicioIso,
                  fin: candFinIso,
                  precio: precioAplicar,
                  es_preventa: Boolean(opciones.esPreventa),
                  formato: formatoElegido,
                  idioma: idiomaElegido,
                  estado: 'programada',
                });

                funcionesAgregadasEnSala++;
                contadorVariacion++;
              }
            }

            // Avanzar hora según intervalo de la prioridad
            horaActual = new Date(horaActual.getTime() + intervaloMs);
          }

          if (funcionesAgregadasEnSala > 0) {
            salasAsignadasEnTurno++;
          }
        }
      }

      // Avanzar al siguiente día
      inicioLoop.setDate(inicioLoop.getDate() + 1);
    }

    if (funcionesGeneradasPayload.length === 0) {
      throw new Error('No se pudieron generar funciones automáticas. Verifica que los horarios no estén ocupados o que las fechas sean válidas.');
    }

    // Insertar en lote (batch) en Supabase
    const { error } = await this.supabase
      .from(this.nombreTabla)
      .insert(funcionesGeneradasPayload);

    if (error) {
      throw new Error(`Error al insertar funciones automáticas: ${error.message}`);
    }

    void this.auditoriaService.registrar(
      'funcion_creada',
      `Generación automática: ${funcionesGeneradasPayload.length} funciones de "${pelicula.titulo}" a $${precioAplicar}`
    );

    return this.obtenerFuncionesCompleta();
  }

  protected override mapear(data: Record<string, any>): Funcion {
    return {
      id: data['id'],
      peliculaId: data['pelicula_id'] || data['peliculaId'],
      salaId: data['sala_id'] || data['salaId'],
      inicio: data['inicio'],
      fin: data['fin'],
      precio: Number(data['precio'] || 0),
      esPreventa: Boolean(data['es_preventa'] || data['esPreventa']),
      formato: data['formato'] || '2D',
      idioma: data['idioma'] || 'español',
      estado: data['estado'] || 'programada',
      creadaEn: data['creada_en'] || data['creadoEn'],
    };
  }
}
