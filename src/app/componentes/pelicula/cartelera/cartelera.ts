import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Pelicula } from '../../../models/pelicula';
import { Funcion } from '../../../models/funcion';
import { PeliculasService } from '../../../servicios/peliculas';
import { FuncionesService } from '../../../servicios/funciones';
import { AsientosRealtimeService } from '../../../servicios/asientos-realtime';
import { Auth } from '../../../servicios/auth';
import { CartaPelicula } from '../carta-pelicula/carta-pelicula';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [CommonModule, FormsModule, CartaPelicula],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.css',
})
export class CarteleraComponent implements OnInit, OnDestroy {
  private peliculasService = inject(PeliculasService);
  private funcionesService = inject(FuncionesService);
  private asientosRealtimeService = inject(AsientosRealtimeService);
  private router = inject(Router);
  private authService = inject(Auth);

  peliculas = signal<Pelicula[]>([]);
  funciones = signal<Funcion[]>([]);
  cargando = signal<boolean>(true);
  cargandoFunciones = signal<boolean>(false);

  busqueda = signal<string>('');
  generoSeleccionado = signal<string>('todos');
  filtroTipo = signal<'cartelera' | 'preventa' | 'todas'>('cartelera');

  peliculaSeleccionada = signal<Pelicula | null>(null);

  // Filtros para el panel vertical de funciones
  filtroFuncionDia = signal<string>('todos');
  filtroFuncionFormato = signal<string>('todos');
  filtroFuncionIdioma = signal<string>('todos');

  private canalesRealtime: RealtimeChannel[] = [];
  private canalLocal?: BroadcastChannel;

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarPeliculas(), this.cargarFunciones()]);
    this.iniciarSuscripcionesRealtime();
  }

  ngOnDestroy(): void {
    for (const canal of this.canalesRealtime) {
      canal.unsubscribe();
    }
    this.canalesRealtime = [];

    if (this.canalLocal) {
      this.canalLocal.close();
    }
  }

  private iniciarSuscripcionesRealtime(): void {
    // 0. Escuchar cambios locales de pestaña (cuando el admin edita películas en el mismo navegador)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.canalLocal = new BroadcastChannel('cinetp-peliculas-local');
        this.canalLocal.onmessage = (event) => {
          const pAct = event.data?.pelicula as Pelicula | undefined;
          if (pAct?.id) {
            this.peliculas.update((lista) =>
              lista.map((p) => (p.id === pAct.id ? { ...p, ...pAct } : p))
            );
            if (this.peliculaSeleccionada()?.id === pAct.id) {
              this.peliculaSeleccionada.set({ ...this.peliculaSeleccionada()!, ...pAct });
            }
          }
        };
      } catch {}
    }

    // 1. Escuchar actualizaciones directas en la tabla peliculas (boletos_vendidos)
    const canalPeliculas = this.peliculasService.suscribirCambios((peliculaActualizada) => {
      this.peliculas.update((lista) =>
        lista.map((p) =>
          p.id === peliculaActualizada.id
            ? { ...p, boletosVendidos: peliculaActualizada.boletosVendidos }
            : p
        )
      );
      if (this.peliculaSeleccionada()?.id === peliculaActualizada.id) {
        this.peliculaSeleccionada.set({
          ...this.peliculaSeleccionada()!,
          boletosVendidos: peliculaActualizada.boletosVendidos,
        });
      }
    });
    this.canalesRealtime.push(canalPeliculas);

    // 2. Escuchar ventas en asientos_funcion (activo por defecto en supabase_realtime)
    const canalAsientos = this.asientosRealtimeService.suscribirBoletosVendidos((funcionId) => {
      const funcion = this.funciones().find((f) => f.id === funcionId);
      if (funcion?.peliculaId) {
        this.peliculas.update((lista) =>
          lista.map((p) =>
            p.id === funcion.peliculaId
              ? { ...p, boletosVendidos: (p.boletosVendidos || 0) + 1 }
              : p
          )
        );
        if (this.peliculaSeleccionada()?.id === funcion.peliculaId) {
          this.peliculaSeleccionada.update((actual) =>
            actual ? { ...actual, boletosVendidos: (actual.boletosVendidos || 0) + 1 } : null
          );
        }
      }
      this.recargarPeliculasSilencioso();
    });
    this.canalesRealtime.push(canalAsientos);
  }

  async recargarPeliculasSilencioso(): Promise<void> {
    try {
      const data = await this.peliculasService.obtenerPeliculas();
      this.peliculas.set(data);
    } catch {
      // background sync silencioso
    }
  }

  async cargarPeliculas(): Promise<void> {
    this.cargando.set(true);
    try {
      const data = await this.peliculasService.obtenerPeliculas();
      this.peliculas.set(data);
    } catch (err) {
      console.error('Error al cargar cartelera:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  async cargarFunciones(): Promise<void> {
    this.cargandoFunciones.set(true);
    try {
      const list = await this.funcionesService.obtenerFuncionesCompleta();
      this.funciones.set(list);
    } catch (err) {
      console.error('Error al cargar funciones:', err);
    } finally {
      this.cargandoFunciones.set(false);
    }
  }

  get generosDisponibles(): string[] {
    const set = new Set<string>();
    for (const p of this.peliculas()) {
      if (p.generos) {
        for (const g of p.generos) set.add(g);
      }
    }
    return Array.from(set);
  }

  private obtenerFechaLocalKey(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  get topTresVendidas(): Pelicula[] {
    return [...this.peliculas()]
      .filter((p) => p.activa !== false && p.enCartelera !== false && !this.esPeliculaPreventa(p.id))
      .sort((a, b) => (b.boletosVendidos || 0) - (a.boletosVendidos || 0))
      .slice(0, 3);
  }

  get peliculasProximamente(): Pelicula[] {
    const hoyStr = this.obtenerFechaLocalKey(new Date());
    return this.peliculas()
      .filter((p) => p.activa !== false && p.fechaEstreno && p.fechaEstreno > hoyStr && !this.esPeliculaPreventa(p.id))
      .sort((a, b) => a.fechaEstreno.localeCompare(b.fechaEstreno));
  }

  esPeliculaPreventa(peliculaId: string): boolean {
    const tieneFuncionPreventa = this.funciones().some((f) => f.peliculaId === peliculaId && f.esPreventa);
    if (tieneFuncionPreventa) return true;

    const p = this.peliculas().find((x) => x.id === peliculaId);
    const hoyStr = this.obtenerFechaLocalKey(new Date());
    return !!(p?.fechaEstreno && p.fechaEstreno > hoyStr && (p.boletosVendidos || 0) > 0);
  }

  get peliculasFiltradas(): Pelicula[] {
    const hoyStr = this.obtenerFechaLocalKey(new Date());
    let lista = this.peliculas().filter((p) => p.activa !== false);

    if (this.filtroTipo() === 'cartelera') {
      // Si está en preventa, NO está en cartelera
      lista = lista.filter((p) => p.enCartelera !== false && (!p.fechaEstreno || p.fechaEstreno <= hoyStr) && !this.esPeliculaPreventa(p.id));
    } else if (this.filtroTipo() === 'preventa') {
      lista = lista.filter((p) => this.esPeliculaPreventa(p.id));
    } else {
      // 'todas'
      lista = lista.filter((p) => (p.enCartelera !== false && (!p.fechaEstreno || p.fechaEstreno <= hoyStr) && !this.esPeliculaPreventa(p.id)) || this.esPeliculaPreventa(p.id));
    }

    if (this.generoSeleccionado() !== 'todos') {
      lista = lista.filter((p) => p.generos?.includes(this.generoSeleccionado() as any));
    }

    const q = this.busqueda().toLowerCase().trim();
    if (q) {
      lista = lista.filter(
        (p) =>
          p.titulo.toLowerCase().includes(q) ||
          (p.sinopsis && p.sinopsis.toLowerCase().includes(q))
      );
    }

    return lista;
  }

  // Funciones asociadas a la película actualmente seleccionada
  get funcionesProgramadasPelicula(): Funcion[] {
    const p = this.peliculaSeleccionada();
    if (!p) return [];
    return this.funciones().filter((f) => f.peliculaId === p.id && f.estado === 'programada');
  }

  get diasDisponiblesPelicula(): { valor: string; etiqueta: string }[] {
    const mapa = new Map<string, string>();
    for (const f of this.funcionesProgramadasPelicula) {
      if (!f.inicio) continue;
      const d = new Date(f.inicio);
      if (isNaN(d.getTime())) continue;

      const key = this.obtenerFechaLocalKey(d);
      mapa.set(key, this.formatearFechaCorta(d));
    }
    return Array.from(mapa.entries())
      .map(([valor, etiqueta]) => ({ valor, etiqueta }))
      .sort((a, b) => a.valor.localeCompare(b.valor));
  }

  get formatosDisponiblesPelicula(): string[] {
    const set = new Set<string>();
    for (const f of this.funcionesProgramadasPelicula) {
      if (f.formato) set.add(f.formato);
    }
    return Array.from(set);
  }

  get idiomasDisponiblesPelicula(): string[] {
    const set = new Set<string>();
    for (const f of this.funcionesProgramadasPelicula) {
      if (f.idioma) set.add(f.idioma);
    }
    return Array.from(set);
  }

  get funcionesDePeliculaFiltradas(): Funcion[] {
    let list = this.funcionesProgramadasPelicula;

    const dia = this.filtroFuncionDia();
    if (dia !== 'todos') {
      list = list.filter((f) => {
        if (!f.inicio) return false;
        const d = new Date(f.inicio);
        return !isNaN(d.getTime()) && this.obtenerFechaLocalKey(d) === dia;
      });
    }

    const formato = this.filtroFuncionFormato();
    if (formato !== 'todos') {
      list = list.filter((f) => f.formato === formato);
    }

    const idioma = this.filtroFuncionIdioma();
    if (idioma !== 'todos') {
      list = list.filter((f) => (f.idioma || 'español').toLowerCase() === idioma.toLowerCase());
    }

    return list.sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  }

  abrirDetalle(pelicula: Pelicula): void {
    this.peliculaSeleccionada.set(pelicula);
    this.filtroFuncionDia.set('todos');
    this.filtroFuncionFormato.set('todos');
    this.filtroFuncionIdioma.set('todos');
    this.cargarFunciones();
  }

  cerrarDetalle(): void {
    this.peliculaSeleccionada.set(null);
  }

  bloqueoPorEdad(pelicula: Pelicula): string | null {
    return this.authService.motivoBloqueoPorEdad(pelicula.restriccionEdad);
  }

  irASala(funcion: Funcion): void {
    const pelicula = this.peliculaSeleccionada();
    if (pelicula && this.bloqueoPorEdad(pelicula)) return;

    this.router.navigate(['/sala'], { queryParams: { funcionId: funcion.id, salaId: funcion.salaId } });
  }

  formatearFechaCorta(d: Date): string {
    const hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) {
      return `Hoy (${d.getDate()}/${d.getMonth() + 1})`;
    }
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    if (d.toDateString() === manana.toDateString()) {
      return `Mañana (${d.getDate()}/${d.getMonth() + 1})`;
    }
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  formatearFechaHora(isoString: string): { dia: string; hora: string } {
    if (!isoString) return { dia: '-', hora: '-' };
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { dia: isoString, hora: isoString };

    return {
      dia: this.formatearFechaCorta(d),
      hora: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' hs',
    };
  }
}
