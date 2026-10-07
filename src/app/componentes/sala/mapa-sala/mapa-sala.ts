import { Component, input, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Asiento, Sala } from '../../../models/sala';
import { Funcion } from '../../../models/funcion';
import { SalaService } from '../../../servicios/sala';
import { FuncionesService } from '../../../servicios/funciones';
import { PeliculasService } from '../../../servicios/peliculas';
import { AsientosRealtimeService, EstadoAsientoFuncion } from '../../../servicios/asientos-realtime';
import { Auth } from '../../../servicios/auth';

@Component({
  selector: 'app-mapa-sala',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-sala.html',
  styleUrl: './mapa-sala.css',
})
export class MapaSalaComponent implements OnInit, OnDestroy {
  public salaService = inject(SalaService);
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);
  private asientosService = inject(AsientosRealtimeService);
  private authService = inject(Auth);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  salaInput = input<Sala | null>(null);
  mostrarPantalla = input<boolean>(true);
  mostrarLeyenda = input<boolean>(true);
  titulo = input<string>('');

  salaFallback = signal<Sala | null>(null);
  funcion = signal<Funcion | null>(null);
  esModoCompra = signal(false);
  cargandoCompra = signal(false);
  procesandoAsiento = signal<string | null>(null);
  mensajeCompra = signal('');
  errorCompra = signal('');
  seleccionados = signal<string[]>([]);
  estadosAsientos = signal<Record<string, EstadoAsientoFuncion>>({});
  realtimeDisponible = signal(false);

  private canalRealtime?: RealtimeChannel;
  private reloj?: ReturnType<typeof setInterval>;
  private ahora = signal(Date.now());

  sala = computed<Sala | null>(() => {
    return this.salaInput() || this.salaFallback();
  });

  async ngOnInit(): Promise<void> {
    const funcionId = this.route.snapshot.queryParamMap.get('funcionId');
    if (funcionId) {
      this.esModoCompra.set(true);
      await this.cargarFuncionCompra(funcionId);
      this.reloj = setInterval(() => {
        this.ahora.set(Date.now());
        this.seleccionados.update((actuales) => actuales.filter((id) => this.estadoAsientoPorId(id) === 'seleccionado'));
      }, 30_000);
      return;
    }

    if (!this.salaInput()) {
      const salas = await this.salaService.obtenerSalas();
      if (salas.length > 0) {
        this.salaFallback.set(salas[0]);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.reloj) clearInterval(this.reloj);
    if (this.canalRealtime) void this.asientosService.desuscribir(this.canalRealtime);
  }

  private async cargarFuncionCompra(funcionId: string): Promise<void> {
    this.cargandoCompra.set(true);
    this.errorCompra.set('');
    try {
      const funciones = await this.funcionesService.obtenerFuncionesCompleta();
      const funcion = funciones.find((item) => item.id === funcionId);
      if (!funcion || !funcion.salaId || funcion.estado !== 'programada') {
        throw new Error('La función no está disponible para la compra de entradas.');
      }

      const peliculas = await this.peliculasService.obtenerPeliculas();
      const pelicula = peliculas.find((item) => item.id === funcion.peliculaId);
      await this.authService.obtenerUsuario();
      const bloqueo = this.authService.motivoBloqueoPorEdad(pelicula?.restriccionEdad || 0);
      if (bloqueo) throw new Error(bloqueo);

      this.funcion.set(funcion);
      const sala = await this.salaService.obtenerSalaPorId(funcion.salaId);
      if (!sala) throw new Error('No se encontró la sala asignada a esta función.');
      this.salaFallback.set(sala);

      this.canalRealtime = this.asientosService.suscribir(funcionId, (estado, eliminado) => {
        if (!estado) return;
        const estados = { ...this.estadosAsientos() };
        if (eliminado) {
          delete estados[estado.asientoId];
          this.seleccionados.update((actuales) => actuales.filter((id) => id !== estado.asientoId));
        } else {
          estados[estado.asientoId] = estado;
          if (estado.sesionId !== this.asientosService.sesionId) {
            this.seleccionados.update((actuales) => actuales.filter((id) => id !== estado.asientoId));
          }
        }
        this.estadosAsientos.set(estados);
      });

      const estados = await this.asientosService.obtenerEstado(funcionId);
      this.estadosAsientos.set(Object.fromEntries(estados.map((estado) => [estado.asientoId, estado])));
      this.realtimeDisponible.set(true);
      this.seleccionados.set(estados
        .filter((estado) => estado.sesionId === this.asientosService.sesionId && estado.estado === 'reservado' && this.estaVigente(estado))
        .map((estado) => estado.asientoId));
    } catch (error) {
      this.errorCompra.set(error instanceof Error ? error.message : 'No se pudo cargar la función.');
    } finally {
      this.cargandoCompra.set(false);
    }
  }

  private estaVigente(estado: EstadoAsientoFuncion): boolean {
    return !estado.expiraEn || new Date(estado.expiraEn).getTime() > this.ahora();
  }

  estadoAsiento(asiento: Asiento): 'disponible' | 'seleccionado' | 'ocupado' | 'vendido' {
    return this.estadoAsientoPorId(asiento.id);
  }

  private estadoAsientoPorId(asientoId: string): 'disponible' | 'seleccionado' | 'ocupado' | 'vendido' {
    const estado = this.estadosAsientos()[asientoId];
    if (!estado || (estado.estado === 'reservado' && !this.estaVigente(estado))) return 'disponible';
    if (estado.estado === 'vendido') return 'vendido';
    if (estado.sesionId === this.asientosService.sesionId) return 'seleccionado';
    return 'ocupado';
  }

  async alternarAsiento(asiento: Asiento): Promise<void> {
    const funcion = this.funcion();
    if (!funcion || this.procesandoAsiento()) return;
    this.errorCompra.set('');
    const estado = this.estadoAsiento(asiento);
    if (estado === 'vendido' || estado === 'ocupado') {
      this.errorCompra.set('Ese asiento ya no está disponible.');
      return;
    }

    this.procesandoAsiento.set(asiento.id);
    try {
      if (estado === 'seleccionado') {
        await this.asientosService.liberar(funcion.id, asiento.id);
        this.seleccionados.update((actuales) => actuales.filter((id) => id !== asiento.id));
        const nuevosEstados = { ...this.estadosAsientos() };
        delete nuevosEstados[asiento.id];
        this.estadosAsientos.set(nuevosEstados);
      } else {
        const reservado = await this.asientosService.reservar(funcion.id, asiento.id);
        if (!reservado) {
          this.errorCompra.set('Alguien acaba de elegir ese asiento. Selecciona otro.');
          await this.recargarEstados();
          return;
        }

        const estadoPropio: EstadoAsientoFuncion = {
          funcionId: funcion.id,
          asientoId: asiento.id,
          sesionId: this.asientosService.sesionId,
          estado: 'reservado',
          expiraEn: new Date(Date.now() + 10 * 60_000).toISOString(),
        };
        this.estadosAsientos.update((actuales) => ({ ...actuales, [asiento.id]: estadoPropio }));
        this.seleccionados.update((actuales) => [...new Set([...actuales, asiento.id])]);
      }
    } catch (error) {
      this.errorCompra.set(error instanceof Error ? error.message : 'No se pudo reservar el asiento.');
    } finally {
      this.procesandoAsiento.set(null);
    }
  }

  async comprarAsientos(): Promise<void> {
    const funcion = this.funcion();
    const asientos = this.asientosElegidos.map((asiento) => asiento.id);
    if (!funcion || !asientos.length || this.procesandoAsiento()) return;

    this.procesandoAsiento.set('comprar');
    this.errorCompra.set('');
    this.mensajeCompra.set('');
    try {
      const cantidad = await this.asientosService.confirmar(funcion.id, asientos);
      this.seleccionados.set([]);
      await this.recargarEstados();
      if (funcion.peliculaId) {
        await this.peliculasService.incrementarBoletosVendidos(funcion.peliculaId, cantidad);
      }
      this.mensajeCompra.set(`Reserva confirmada: ${cantidad} asiento(s). Ahora figuran ocupados para esta función.`);
    } catch (error) {
      this.errorCompra.set(error instanceof Error ? error.message : 'No se pudo completar la reserva.');
      await this.recargarEstados();
    } finally {
      this.procesandoAsiento.set(null);
    }
  }

  private async recargarEstados(): Promise<void> {
    const funcion = this.funcion();
    if (!funcion) return;
    try {
      const estados = await this.asientosService.obtenerEstado(funcion.id);
      this.estadosAsientos.set(Object.fromEntries(estados.map((estado) => [estado.asientoId, estado])));
    } catch (error) {
      this.errorCompra.set(error instanceof Error ? error.message : 'No se pudo actualizar el mapa.');
    }
  }

  asientoDeshabilitado(asiento: Asiento): boolean {
    return !this.esModoCompra() || !this.realtimeDisponible() || !!this.procesandoAsiento() || ['ocupado', 'vendido'].includes(this.estadoAsiento(asiento));
  }

  continuarAlCandy(): void {
    const funcion = this.funcion();
    const asientos = this.asientosElegidos;
    if (!funcion || !asientos.length || this.procesandoAsiento()) return;

    if (typeof sessionStorage !== 'undefined') {
      const contextoCompra = {
        funcionId: funcion.id,
        peliculaId: funcion.peliculaId,
        peliculaTitulo: funcion.peliculaTitulo,
        salaNombre: funcion.salaNombre || this.sala()?.nombre,
        inicio: funcion.inicio,
        formato: funcion.formato,
        idioma: funcion.idioma,
        precioUnitario: funcion.precio,
        asientos: asientos.map((a) => a.id),
        totalEntradas: this.totalCompra,
      };
      sessionStorage.setItem('cinetp_compra_actual', JSON.stringify(contextoCompra));
    }

    this.router.navigate(['/candy'], {
      queryParams: { funcionId: funcion.id },
    });
  }

  get asientosElegidos(): Asiento[] {
    const ids = new Set(this.seleccionados().filter((id) => this.estadoAsientoPorId(id) === 'seleccionado'));
    return (this.sala()?.filas || []).flatMap((fila) => [...fila.bloque1, ...fila.bloque2, ...fila.bloque3])
      .filter((asiento) => ids.has(asiento.id));
  }

  precioAsiento(asiento: Asiento): number {
    const base = Number(this.funcion()?.precio || 0);
    return this.salaService.calcularPrecioAsiento(asiento.tipo, base);
  }

  get totalCompra(): number {
    return this.asientosElegidos.reduce((total, asiento) => {
      return total + this.precioAsiento(asiento);
    }, 0);
  }

  formatearInicio(inicio: string): string {
    const fecha = new Date(inicio);
    return Number.isNaN(fecha.getTime())
      ? inicio
      : fecha.toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  volverACartelera(): void {
    this.router.navigate(['/home']);
  }
}
