import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Funcion, EstadoFuncion } from '../../../models/funcion';
import { Pelicula } from '../../../models/pelicula';
import { Sala } from '../../../models/sala';
import { FuncionesService } from '../../../servicios/funciones';
import { PeliculasService } from '../../../servicios/peliculas';
import { SalaService } from '../../../servicios/sala';
import { AdministrarBase } from '../administrar-base';
import {
  ESTADOS_FUNCION,
  FORMATOS_FUNCION,
  IDIOMAS_FUNCION,
  crearFormularioFuncion,
} from '../../../validators/funcion';

@Component({
  selector: 'app-administrar-funciones',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './administrar-funciones.html',
  styleUrl: './administrar-funciones.css',
})
export class AdministrarFunciones extends AdministrarBase<Funcion> {
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);
  private salaService = inject(SalaService);

  readonly formatosList = FORMATOS_FUNCION;
  readonly idiomasList = IDIOMAS_FUNCION;
  readonly estadosList = ESTADOS_FUNCION;

  funciones = this.items;

  peliculas = signal<Pelicula[]>([]);
  salas = signal<Sala[]>([]);

  filtroPelicula = signal<string>('todas');
  filtroSala = signal<string>('todas');
  filtroEstado = signal<string>('todas');

  esPeliculaPreventa(peliculaId: string | undefined): boolean {
    if (!peliculaId) return false;
    return this.funciones().some((f) => f.peliculaId === peliculaId && f.esPreventa);
  }

  obtenerPelicula(peliculaId: string | undefined): Pelicula | undefined {
    if (!peliculaId) return undefined;
    return this.peliculas().find((item) => item.id === peliculaId);
  }

  onAutoFormPeliculaOrPreventaChange(): void {
    const pId = this.autoForm.get('peliculaId')?.value;
    if (!pId) return;
    const p = this.obtenerPelicula(pId);
    if (p && p.fechaEstreno) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const estrenoDate = new Date(`${p.fechaEstreno}T00:00:00`);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const baseInicio = estrenoDate > hoy ? estrenoDate : hoy;
      const fInicio = `${baseInicio.getFullYear()}-${pad(baseInicio.getMonth() + 1)}-${pad(baseInicio.getDate())}`;
      const finDate = new Date(baseInicio.getTime() + 15 * 24 * 60 * 60 * 1000);
      const fFin = `${finDate.getFullYear()}-${pad(finDate.getMonth() + 1)}-${pad(finDate.getDate())}`;

      this.autoForm.patchValue({
        fechaInicio: fInicio,
        fechaFin: fFin,
      });
    }
  }

  onEditFormPeliculaOrPreventaChange(): void {
    const pId = this.editForm.get('peliculaId')?.value;
    if (!pId) return;
    const p = this.obtenerPelicula(pId);
    if (p && p.fechaEstreno) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const estrenoDate = new Date(`${p.fechaEstreno}T00:00:00`);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const baseInicio = estrenoDate > hoy ? estrenoDate : hoy;
      const fInicio = `${baseInicio.getFullYear()}-${pad(baseInicio.getMonth() + 1)}-${pad(baseInicio.getDate())}`;

      this.editForm.patchValue({
        fecha: fInicio,
      });
    }
    this.onFechaOrSalaChange();
  }

  // Estado y Formulario para Generación Automática
  modoAutoGeneracion = signal<boolean>(false);
  autoForm: FormGroup = this.fb.group({
    peliculaId: ['', []],
    fechaInicio: [this.minFechaActual],
    fechaFin: [this.minFechaActual],
    turnoMañana: [true],
    turnoTarde: [true],
    turnoNoche: [true],
    prioridad: ['alta' as 'alta' | 'media' | 'baja'],
    precio: [5000],
    esPreventa: [false],
  });

  editForm: FormGroup = crearFormularioFuncion(this.fb);

  readonly opcionesHora: string[] = (() => {
    const lista: string[] = [];
    const pad = (n: number) => n.toString().padStart(2, '0');
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        lista.push(`${pad(h)}:${pad(m)}`);
      }
    }
    return lista;
  })();

  get peliculaId() { return this.editForm.get('peliculaId'); }
  get salaId() { return this.editForm.get('salaId'); }
  get fecha() { return this.editForm.get('fecha'); }
  get hora() { return this.editForm.get('hora'); }
  get inicio() { return this.editForm.get('inicio'); }
  get precio() { return this.editForm.get('precio'); }
  get esPreventa() { return this.editForm.get('esPreventa'); }
  get formato() { return this.editForm.get('formato'); }
  get idioma() { return this.editForm.get('idioma'); }
  get estado() { return this.editForm.get('estado'); }

  get inicioValue(): string {
    const f = this.fecha?.value;
    const h = this.hora?.value;
    if (!f || !h) return '';
    const d = new Date(`${f}T${h}:00`);
    if (isNaN(d.getTime())) return `${f}T${h}`;
    return d.toISOString();
  }

  get minFechaActual(): string {
    const ahora = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;
  }

  get funcionesFiltradas(): Funcion[] {
    let lista = this.funciones();
    const pelId = this.filtroPelicula();
    const salId = this.filtroSala();
    const est = this.filtroEstado();

    if (pelId !== 'todas') {
      lista = lista.filter((f) => f.peliculaId === pelId);
    }
    if (salId !== 'todas') {
      lista = lista.filter((f) => f.salaId === salId);
    }
    if (est !== 'todas') {
      lista = lista.filter((f) => f.estado === est);
    }

    return lista;
  }

  get finEstimadoTexto(): string {
    const inicioVal = this.inicioValue;
    const pelIdVal = this.peliculaId?.value;
    if (!inicioVal || !pelIdVal) return '';

    const pelicula = this.peliculas().find((p) => p.id === pelIdVal);
    const duracion = pelicula?.duracion || 120;
    const finIso = this.funcionesService.calcularFin(inicioVal, duracion);
    if (!finIso) return '';

    const finDate = new Date(finIso);
    const horaFin = finDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fechaFin = finDate.toLocaleDateString();

    return `Fin estimado: ${fechaFin} ${horaFin} (${duracion} min película + 30 min limpieza/preparación)`;
  }

  esHoraBloqueada(h: string): boolean {
    const fVal = this.fecha?.value;
    const sId = this.salaId?.value;
    const pId = this.peliculaId?.value;

    if (!fVal || !sId || !h) return false;

    const candInicioMs = new Date(`${fVal}T${h}:00`).getTime();
    if (isNaN(candInicioMs)) return false;

    if (candInicioMs < new Date().getTime() - 60000) {
      return true;
    }

    const pelicula = this.peliculas().find((p) => p.id === pId);
    const duracionPeli = pelicula?.duracion || 120;
    const duracionTotalMs = (duracionPeli + 30) * 60 * 1000;
    const candFinMs = candInicioMs + duracionTotalMs;

    const idEditando = this.modoModal() === 'editar' ? this.itemEditando()?.id : undefined;

    const funcionesSala = this.funciones().filter(
      (f) => f.salaId === sId && f.estado === 'programada' && f.id !== idEditando
    );

    for (const f of funcionesSala) {
      const inicioExistenteMs = new Date(f.inicio).getTime();
      const finIso = f.fin || this.funcionesService.calcularFin(f.inicio, f.duracionPelicula || 120);
      const finExistenteMs = new Date(finIso).getTime();

      if (candInicioMs < finExistenteMs && candFinMs > inicioExistenteMs) {
        return true;
      }
    }

    return false;
  }

  get formatoDeSalaSeleccionada(): string {
    const selectedSalaId = this.salaId?.value;
    const sala = this.salas().find((s) => s.id === selectedSalaId);
    return sala?.formato || '2D';
  }

  onFechaOrSalaChange(): void {
    const sId = this.salaId?.value;
    const sala = this.salas().find((s) => s.id === sId);
    if (sala) {
      this.editForm.patchValue({ formato: sala.formato });
    }

    const currentH = this.hora?.value;
    if (this.esHoraBloqueada(currentH)) {
      const primeraDisponible = this.opcionesHora.find((h) => !this.esHoraBloqueada(h));
      if (primeraDisponible) {
        this.editForm.patchValue({ hora: primeraDisponible });
      }
    }
  }

  onSalaChange(): void {
    this.onFechaOrSalaChange();
  }

  protected override async cargarData(): Promise<Funcion[]> {
    const [peliList, salaList] = await Promise.all([
      this.peliculasService.obtenerPeliculas().catch(() => []),
      this.salaService.obtenerSalas().catch(() => []),
    ]);

    this.peliculas.set(peliList);
    this.salas.set(salaList);

    return this.funcionesService.obtenerFuncionesCompleta();
  }

  protected override crearData(payload: any): Promise<Funcion> {
    const inicioDate = new Date(`${payload.fecha}T${payload.hora}:00`);
    payload.inicio = inicioDate.toISOString();
    payload.estado = 'programada';
    if (inicioDate.getTime() < new Date().getTime() - 60000) {
      throw new Error('No se pueden programar funciones en fechas u horas pasadas.');
    }
    if (this.esHoraBloqueada(payload.hora)) {
      throw new Error('El horario seleccionado no está disponible en esta sala.');
    }
    const pelicula = this.peliculas().find((p) => p.id === payload.peliculaId);
    const duracion = pelicula?.duracion || 120;
    const sala = this.salas().find((s) => s.id === payload.salaId);
    if (sala) {
      payload.formato = sala.formato;
    }
    return this.funcionesService.crearFuncionConValidacion(payload, duracion);
  }

  protected override actualizarData(id: string, payload: any): Promise<Funcion> {
    if (payload.fecha && payload.hora) {
      const inicioDate = new Date(`${payload.fecha}T${payload.hora}:00`);
      payload.inicio = inicioDate.toISOString();
    }
    if (payload.inicio && new Date(payload.inicio).getTime() < new Date().getTime() - 60000) {
      throw new Error('No se pueden programar funciones en fechas u horas pasadas.');
    }
    if (payload.hora && this.esHoraBloqueada(payload.hora)) {
      throw new Error('El horario seleccionado no está disponible en esta sala.');
    }
    const pelicula = this.peliculas().find((p) => p.id === payload.peliculaId);
    const duracion = pelicula?.duracion || 120;
    const sala = this.salas().find((s) => s.id === payload.salaId);
    if (sala) {
      payload.formato = sala.formato;
    }
    return this.funcionesService.actualizarFuncionConValidacion(id, payload, duracion);
  }

  protected override mapearFormulario(funcion: Funcion): Record<string, any> {
    let fVal = '';
    let hVal = '12:00';
    if (funcion.inicio) {
      const d = new Date(funcion.inicio);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        fVal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        const minutes = d.getMinutes();
        const roundedMin = Math.round(minutes / 15) * 15;
        let hours = d.getHours();
        let finalMin = roundedMin;
        if (finalMin === 60) {
          finalMin = 0;
          hours = (hours + 1) % 24;
        }
        hVal = `${pad(hours)}:${pad(finalMin)}`;
      }
    }

    const sala = this.salas().find((s) => s.id === funcion.salaId);
    const formatoCalculado = sala?.formato || funcion.formato || '2D';

    return {
      peliculaId: funcion.peliculaId,
      salaId: funcion.salaId,
      fecha: fVal,
      hora: hVal,
      inicio: funcion.inicio,
      precio: funcion.precio,
      esPreventa: funcion.esPreventa || false,
      formato: formatoCalculado,
      idioma: funcion.idioma || 'español',
      estado: funcion.estado || 'programada',
    };
  }

  protected override onFormularioReset(): void {
    const defaultPelicula = this.peliculas()[0]?.id || '';
    const defaultSalaObj = this.salas()[0];
    const defaultSala = defaultSalaObj?.id || '';
    const defaultFormato = defaultSalaObj?.formato || '2D';

    const ahora = new Date();
    let min = ahora.getMinutes();
    let hrs = ahora.getHours();
    const rem = min % 15;
    if (rem !== 0) {
      min += 15 - rem;
      if (min >= 60) {
        min = 0;
        hrs = (hrs + 1) % 24;
      }
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    const fDefault = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;
    let hDefault = `${pad(hrs)}:${pad(min)}`;
    const inicioIso = new Date(`${fDefault}T${hDefault}:00`).toISOString();

    this.editForm.patchValue({
      peliculaId: defaultPelicula,
      salaId: defaultSala,
      fecha: fDefault,
      hora: hDefault,
      inicio: inicioIso,
      precio: 5000,
      esPreventa: false,
      formato: defaultFormato,
      idioma: 'español',
      estado: 'programada',
    });

    const primeraDisponible = this.opcionesHora.find((h) => !this.esHoraBloqueada(h)) || hDefault;
    this.editForm.patchValue({ hora: primeraDisponible });
  }

  protected override onFormularioCargado(_item: Funcion): void {
    this.onFechaOrSalaChange();
  }

  override async guardarCambios(): Promise<void> {
    const modo = this.modoModal();
    if (!modo) return;

    if (!this.esValidoFormulario()) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.mensajeError.set(null);

    try {
      const payload = this.obtenerPayload();

      if (modo === 'crear') {
        const itemCreado = await this.crearData(payload);

        // Reset room filter if it would hide the newly created function
        if (this.filtroSala() !== 'todas' && this.filtroSala() !== itemCreado.salaId) {
          this.filtroSala.set('todas');
        }
        if (this.filtroPelicula() !== 'todas' && this.filtroPelicula() !== itemCreado.peliculaId) {
          this.filtroPelicula.set('todas');
        }
        if (this.filtroEstado() !== 'todas' && this.filtroEstado() !== itemCreado.estado) {
          this.filtroEstado.set('todas');
        }

        this.items.set([itemCreado, ...this.items()]);
        this.itemSeleccionado.set(itemCreado);
      } else {
        const itemActual = this.itemEditando();
        if (!itemActual) return;
        const itemActualizado = await this.actualizarData(itemActual.id, payload);

        this.items.set(
          this.items().map((item) => (item.id === itemActualizado.id ? itemActualizado : item))
        );

        if (this.itemSeleccionado()?.id === itemActualizado.id) {
          this.itemSeleccionado.set(itemActualizado);
        }
      }

      this.guardando.set(false);
      this.cerrarEdicion();
      this.onFechaOrSalaChange();
      await this.cargarItems();
    } catch (err) {
      this.guardando.set(false);
      this.mensajeError.set(
        err instanceof Error ? err.message : 'Error al procesar la solicitud.'
      );
    }
  }

  async cambiarEstado(funcion: Funcion, nuevoEstado: EstadoFuncion): Promise<void> {
    try {
      this.guardando.set(true);
      const actualizada = await this.funcionesService.actualizar(funcion.id, { estado: nuevoEstado });
      this.items.set(
        this.items().map((f) => (f.id === actualizada.id ? { ...f, estado: nuevoEstado } : f))
      );
    } catch (err) {
      console.error('Error al cambiar estado de función:', err);
    } finally {
      this.guardando.set(false);
    }
  }

  formatearFechaHora(isoString: string): string {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async borrarFuncion(funcion: Funcion): Promise<void> {
    const confirmacion = confirm(
      `¿Estás seguro de que deseas borrar la función de "${funcion.peliculaTitulo}" (${this.formatearFechaHora(funcion.inicio)})?`
    );
    if (!confirmacion) return;

    try {
      this.guardando.set(true);
      await this.funcionesService.eliminar(funcion.id);
      this.items.set(this.items().filter((f) => f.id !== funcion.id));
      if (this.itemSeleccionado()?.id === funcion.id) {
        this.itemSeleccionado.set(null);
      }
    } catch (err) {
      console.error('Error al borrar función:', err);
      this.mensajeError.set(
        err instanceof Error ? err.message : 'Error al borrar la función.'
      );
    } finally {
      this.guardando.set(false);
    }
  }

  abrirAutoGeneracion(): void {
    const defaultPeliObj = this.peliculas()[0];
    const defaultPeli = defaultPeliObj?.id || '';

    const hoy = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');

    const fInicio = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
    const fecha15Dias = new Date(hoy.getTime() + 15 * 24 * 60 * 60 * 1000);
    const fFin = `${fecha15Dias.getFullYear()}-${pad(fecha15Dias.getMonth() + 1)}-${pad(fecha15Dias.getDate())}`;

    this.autoForm.patchValue({
      peliculaId: defaultPeli,
      fechaInicio: fInicio,
      fechaFin: fFin,
      turnoMañana: true,
      turnoTarde: true,
      turnoNoche: true,
      prioridad: 'alta',
      precio: 5000,
      esPreventa: false,
    });
    this.onAutoFormPeliculaOrPreventaChange();
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.modoAutoGeneracion.set(true);
  }

  cerrarAutoGeneracion(): void {
    this.modoAutoGeneracion.set(false);
  }

  async ejecutarAutoGeneracion(): Promise<void> {
    const val = this.autoForm.value;
    if (!val.peliculaId) {
      this.mensajeError.set('Debes seleccionar una película.');
      return;
    }
    if (!val.fechaInicio || !val.fechaFin) {
      this.mensajeError.set('Debes seleccionar el rango de fechas.');
      return;
    }

    const turnosSeleccionados: ('mañana' | 'tarde' | 'noche')[] = [];
    if (val.turnoMañana) turnosSeleccionados.push('mañana');
    if (val.turnoTarde) turnosSeleccionados.push('tarde');
    if (val.turnoNoche) turnosSeleccionados.push('noche');

    if (turnosSeleccionados.length === 0) {
      this.mensajeError.set('Debes seleccionar al menos un turno (Mañana, Tarde o Noche).');
      return;
    }

    this.guardando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    try {
      const funcionesActualizadas = await this.funcionesService.generarFuncionesAutomaticas({
        peliculaId: val.peliculaId,
        fechaInicio: val.fechaInicio,
        fechaFin: val.fechaFin,
        turnos: turnosSeleccionados,
        prioridad: val.prioridad,
        precio: Number(val.precio || 5000),
        esPreventa: Boolean(val.esPreventa),
      });

      this.items.set(funcionesActualizadas);
      this.mensajeExito.set('¡Funciones automáticas generadas exitosamente con varianza de formato e idioma!');
      this.guardando.set(false);
      setTimeout(() => {
        this.cerrarAutoGeneracion();
        this.mensajeExito.set(null);
      }, 1500);
    } catch (err) {
      this.guardando.set(false);
      this.mensajeError.set(
        err instanceof Error ? err.message : 'Error al generar funciones automáticas.'
      );
    }
  }
}
