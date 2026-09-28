import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Pelicula } from '../../../models/pelicula';
import { Funcion } from '../../../models/funcion';
import { PeliculasService } from '../../../servicios/peliculas';
import { FuncionesService } from '../../../servicios/funciones';
import { CartaPelicula } from '../carta-pelicula/carta-pelicula';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [CommonModule, FormsModule, CartaPelicula],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.css',
})
export class CarteleraComponent implements OnInit {
  private peliculasService = inject(PeliculasService);
  private funcionesService = inject(FuncionesService);
  private router = inject(Router);

  peliculas = signal<Pelicula[]>([]);
  funciones = signal<Funcion[]>([]);
  cargando = signal<boolean>(true);
  cargandoFunciones = signal<boolean>(false);

  busqueda = signal<string>('');
  generoSeleccionado = signal<string>('todos');
  filtroTipo = signal<'todas' | 'cartelera' | 'preventa'>('todas');

  peliculaSeleccionada = signal<Pelicula | null>(null);
  funcionSeleccionada = signal<Funcion | null>(null);

  // Filtros para el panel vertical de funciones
  filtroFuncionDia = signal<string>('todos');
  filtroFuncionFormato = signal<string>('todos');
  filtroFuncionIdioma = signal<string>('todos');

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarPeliculas(), this.cargarFunciones()]);
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

  get topTresVendidas(): Pelicula[] {
    return [...this.peliculas()]
      .filter((p) => p.activa !== false && p.enCartelera !== false)
      .sort((a, b) => (b.boletosVendidos || 0) - (a.boletosVendidos || 0))
      .slice(0, 3);
  }

  get peliculasFiltradas(): Pelicula[] {
    let lista = this.peliculas().filter((p) => p.activa !== false && p.enCartelera !== false);

    if (this.filtroTipo() === 'cartelera') {
      lista = lista.filter((p) => !p.esPreventa);
    } else if (this.filtroTipo() === 'preventa') {
      lista = lista.filter((p) => p.esPreventa);
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

      const key = d.toISOString().split('T')[0];
      mapa.set(key, this.formatearFechaCorta(d));
    }
    return Array.from(mapa.entries()).map(([valor, etiqueta]) => ({ valor, etiqueta }));
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
      list = list.filter((f) => f.inicio && f.inicio.startsWith(dia));
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
    this.funcionSeleccionada.set(null);
    this.filtroFuncionDia.set('todos');
    this.filtroFuncionFormato.set('todos');
    this.filtroFuncionIdioma.set('todos');
    this.cargarFunciones();
  }

  cerrarDetalle(): void {
    this.peliculaSeleccionada.set(null);
    this.funcionSeleccionada.set(null);
  }

  seleccionarFuncion(funcion: Funcion): void {
    this.funcionSeleccionada.set(funcion);
  }

  irASala(funcion: Funcion): void {
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
