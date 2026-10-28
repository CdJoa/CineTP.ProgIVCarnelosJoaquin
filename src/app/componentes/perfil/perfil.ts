import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../servicios/auth';
import { ComprasService } from '../../servicios/compras';
import { ResenasService } from '../../servicios/resenas';
import { PropuestasService } from '../../servicios/propuestas';
import { Notificacion, NotificacionesService } from '../../servicios/notificaciones';
import { Compra } from '../../models/compra';
import { Resena } from '../../models/resena';
import { PropuestaPelicula } from '../../models/propuesta';
import { RatingEstrellas } from '../pelicula/rating-estrellas/rating-estrellas';
import { HoverZoomDirective } from '../../directivas/hover-zoom.directive';
import { EntradaListaEspera, ListaEsperaService } from '../../servicios/lista-espera';

export type TabPerfil = 'peliculas' | 'entradas' | 'espera' | 'propuesta' | 'datos';
export type FiltroCalificacion = 'todas' | 'calificadas' | 'sin_calificar';
export type OrdenHistorial = 'fecha_desc' | 'fecha_asc' | 'calif_desc';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, RatingEstrellas, HoverZoomDirective],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class PerfilComponent implements OnInit {
  authService = inject(Auth);
  private comprasService = inject(ComprasService);
  private resenasService = inject(ResenasService);
  private propuestasService = inject(PropuestasService);
  private notificacionesService = inject(NotificacionesService);
  private listaEsperaService = inject(ListaEsperaService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Pestaña activa
  tabActiva = signal<TabPerfil>('peliculas');

  // Propuesta del usuario
  propuestaUsuario = signal<PropuestaPelicula | null>(null);
  cargandoPropuesta = signal<boolean>(true);

  // Compras y reseñas
  compras = signal<Compra[]>([]);
  cargandoCompras = signal<boolean>(true);
  resenasUsuario = signal<Record<string, Resena>>({});
  cargandoResenas = signal<boolean>(true);
  notificaciones = signal<Notificacion[]>([]);
  listasEspera = signal<EntradaListaEspera[]>([]);
  cargandoListaEspera = signal(true);
  procesandoListaEsperaId = signal<string | null>(null);
  errorListaEspera = signal<string | null>(null);

  // Filtros de la sección "Mis películas"
  busquedaPelicula = signal<string>('');
  filtroCalificacion = signal<FiltroCalificacion>('todas');
  ordenHistorial = signal<OrdenHistorial>('fecha_desc');

  // Modales
  compraSeleccionadaModal = signal<Compra | null>(null);
  compraACancelar = signal<Compra | null>(null);
  cancelando = signal<boolean>(false);
  errorCancelacion = signal<string | null>(null);
  mensajeCancelacion = signal<string | null>(null);

  // Modal de calificación interactiva
  peliculaParaCalificar = signal<{
    peliculaId: string;
    peliculaTitulo: string;
    peliculaPoster?: string;
    resenaExistente?: Resena | null;
  } | null>(null);
  puntajeModal = signal<number>(5);
  comentarioModal: string = '';
  guardandoCalificacion = signal<boolean>(false);
  errorCalificacion = signal<string | null>(null);
  mensajeExitoCalificacion = signal<string | null>(null);

  get usuario() {
    return this.authService.usuarioActual();
  }

  // Identificador normalizado para vincular compra con reseña
  obtenerIdPelicula(compra: Compra): string {
    if (compra.peliculaId) return String(compra.peliculaId);
    return compra.peliculaTitulo.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  }

  obtenerResena(compra: Compra): Resena | undefined {
    const id = this.obtenerIdPelicula(compra);
    return this.resenasUsuario()[id];
  }

  // Lista filtrada y ordenada para la sección visual de Mis Películas
  peliculasHistorialFiltradas = computed(() => {
    const lista = this.compras();
    const mapaResenas = this.resenasUsuario();
    const filtro = this.filtroCalificacion();
    const q = this.busquedaPelicula().toLowerCase().trim();
    const orden = this.ordenHistorial();

    let resultado = lista.filter((c) => {
      // Coincidencia de búsqueda
      if (q) {
        const tituloCoincide = c.peliculaTitulo.toLowerCase().includes(q);
        const salaCoincide = c.salaNombre.toLowerCase().includes(q);
        if (!tituloCoincide && !salaCoincide) return false;
      }

      const peliId = this.obtenerIdPelicula(c);
      const res = mapaResenas[peliId];
      const tieneCalificacion = !!res && res.activo !== false && res.puntos > 0;

      if (filtro === 'calificadas') {
        return tieneCalificacion;
      }
      if (filtro === 'sin_calificar') {
        return !tieneCalificacion;
      }
      return true;
    });

    // Ordenamiento
    return resultado.sort((a, b) => {
      if (orden === 'calif_desc') {
        const peliIdA = this.obtenerIdPelicula(a);
        const peliIdB = this.obtenerIdPelicula(b);
        const pA = mapaResenas[peliIdA]?.puntos || 0;
        const pB = mapaResenas[peliIdB]?.puntos || 0;
        if (pB !== pA) return pB - pA;
      }
      const fechaA = new Date(a.funcionInicio || a.creadoEn).getTime();
      const fechaB = new Date(b.funcionInicio || b.creadoEn).getTime();
      return orden === 'fecha_asc' ? fechaA - fechaB : fechaB - fechaA;
    });
  });

  // Estadísticas para el encabezado de "Mis Películas"
  estadisticasCine = computed(() => {
    const lista = this.compras();
    const validas = lista.filter((c) => c.estado !== 'cancelada');
    const mapaResenas = this.resenasUsuario();

    // Películas únicas vistas
    const pelisIds = new Set(validas.map((c) => this.obtenerIdPelicula(c)));
    let sumaPuntos = 0;
    let cantCalificadas = 0;

    for (const peliId of pelisIds) {
      const res = mapaResenas[peliId];
      if (res && res.activo !== false && res.puntos > 0) {
        sumaPuntos += res.puntos;
        cantCalificadas++;
      }
    }

    const promedio = cantCalificadas > 0 ? Number((sumaPuntos / cantCalificadas).toFixed(1)) : 0;
    const pendientes = Math.max(0, pelisIds.size - cantCalificadas);

    return {
      totalVistas: validas.length,
      pelisUnicas: pelisIds.size,
      cantCalificadas,
      promedio,
      pendientes,
    };
  });

  async ngOnInit(): Promise<void> {
    // Detectar si ingresó por ruta /mis-peliculas o con parámetro ?tab=
    const urlActual = this.router.url;
    if (urlActual.includes('mis-peliculas')) {
      this.tabActiva.set('peliculas');
    }

    this.route.queryParams.subscribe((params) => {
      if (params['tab'] === 'peliculas' || params['seccion'] === 'peliculas') {
        this.tabActiva.set('peliculas');
      } else if (params['tab'] === 'entradas' || params['seccion'] === 'entradas') {
        this.tabActiva.set('entradas');
      } else if (params['tab'] === 'propuesta' || params['seccion'] === 'propuesta') {
        this.tabActiva.set('propuesta');
      } else if (params['tab'] === 'espera' || params['seccion'] === 'espera') {
        this.tabActiva.set('espera');
      } else if (params['tab'] === 'datos' || params['seccion'] === 'datos') {
        this.tabActiva.set('datos');
      }
    });

    await Promise.all([
      this.cargarCompras(),
      this.cargarResenas(),
      this.cargarPropuesta(),
      this.cargarNotificaciones(),
      this.cargarListasEspera(),
    ]);
  }

  async cargarListasEspera(): Promise<void> {
    this.cargandoListaEspera.set(true);
    try {
      this.listasEspera.set(await this.listaEsperaService.obtenerMisListas());
      this.errorListaEspera.set(null);
    } catch (error) {
      this.errorListaEspera.set(error instanceof Error ? error.message : 'No se pudieron cargar tus listas de espera.');
    } finally {
      this.cargandoListaEspera.set(false);
    }
  }

  async salirListaEspera(entrada: EntradaListaEspera): Promise<void> {
    if (this.procesandoListaEsperaId()) return;
    this.procesandoListaEsperaId.set(entrada.id);
    this.errorListaEspera.set(null);
    try {
      await this.listaEsperaService.salir(entrada.id);
      this.listasEspera.update((items) => items.filter((item) => item.id !== entrada.id));
    } catch (error) {
      this.errorListaEspera.set(error instanceof Error ? error.message : 'No se pudo salir de la lista.');
    } finally {
      this.procesandoListaEsperaId.set(null);
    }
  }

  async abrirOfertaListaEspera(notificacion: Notificacion): Promise<void> {
    const funcionId = String(notificacion.metadata['funcion_id'] || '');
    if (!funcionId) return;
    try {
      await this.notificacionesService.marcarLeida(notificacion.id);
      this.notificaciones.update((items) => items.map((item) =>
        item.id === notificacion.id ? { ...item, leida: true } : item
      ));
    } catch (error) {
      console.warn('No se pudo marcar la notificación como leída:', error);
    }
    await this.irAFuncionEnEspera(funcionId);
  }

  async irAFuncionEnEspera(funcionId: string): Promise<void> {
    if (!funcionId) return;
    await this.router.navigate(['/sala'], { queryParams: { funcionId } });
  }

  async cargarNotificaciones(): Promise<void> {
    const u = this.usuario;
    if (!u) return;
    try {
      this.notificaciones.set(await this.notificacionesService.obtenerMisNotificaciones(u.id));
    } catch (err) {
      console.warn('No se pudieron cargar las notificaciones:', err);
    }
  }

  async reubicarPorNotificacion(notificacion: Notificacion): Promise<void> {
    const peliculaId = String(notificacion.metadata['pelicula_id'] || '');
    if (peliculaId) {
      try {
        await this.notificacionesService.marcarLeida(notificacion.id);
        this.notificaciones.update((lista) =>
          lista.map((item) => item.id === notificacion.id ? { ...item, leida: true } : item)
        );
      } catch (err) {
        console.warn('No se pudo marcar la notificación como leída:', err);
      }
      await this.router.navigate(['/home'], { queryParams: { reubicar: peliculaId } });
    }
  }

  cambiarTab(tab: TabPerfil): void {
    this.tabActiva.set(tab);
  }

  async cargarPropuesta(): Promise<void> {
    this.cargandoPropuesta.set(true);
    const u = this.usuario;
    if (u) {
      try {
        const activa = await this.propuestasService.obtenerPropuestaActiva(u.id);
        if (activa) {
          this.propuestaUsuario.set(activa);
        } else {
          const ultima = await this.propuestasService.obtenerUltimaPropuestaUsuario(u.id);
          this.propuestaUsuario.set(ultima);
        }
      } catch (err) {
        console.warn('Error al cargar propuesta en perfil:', err);
      }
    }
    this.cargandoPropuesta.set(false);
  }

  async cargarCompras(): Promise<void> {
    this.cargandoCompras.set(true);
    const u = this.usuario;
    if (u) {
      try {
        const misCompras = await this.comprasService.obtenerComprasUsuario(u.id);
        this.compras.set(misCompras);
      } catch (err) {
        console.error('Error al cargar historial de compras:', err);
      }
    }
    this.cargandoCompras.set(false);
  }

  async cargarResenas(): Promise<void> {
    this.cargandoResenas.set(true);
    const u = this.usuario;
    if (u) {
      try {
        const mapa = await this.resenasService.obtenerMapaResenasUsuario(u.id);
        this.resenasUsuario.set(mapa);
      } catch (err) {
        console.error('Error al cargar reseñas del usuario:', err);
      }
    }
    this.cargandoResenas.set(false);
  }

  formatearFecha(fecha?: string): string {
    if (!fecha) return '-';
    const parts = fecha.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fecha;
  }

  formatearFechaHora(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleString('es-AR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
  }

  formatearFechaCorta(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
  }

  // ==========================================
  // Modal de Calificación Interactiva
  // ==========================================
  abrirModalCalificar(compra: Compra): void {
    const peliculaId = this.obtenerIdPelicula(compra);
    const resExistente = this.resenasUsuario()[peliculaId] || null;

    this.peliculaParaCalificar.set({
      peliculaId,
      peliculaTitulo: compra.peliculaTitulo,
      peliculaPoster: compra.peliculaPoster,
      resenaExistente: resExistente,
    });

    this.puntajeModal.set(resExistente ? resExistente.puntos : 5);
    this.comentarioModal = resExistente ? resExistente.comentario : '';
    this.errorCalificacion.set(null);
    this.mensajeExitoCalificacion.set(null);
  }

  cerrarModalCalificar(): void {
    if (this.guardandoCalificacion()) return;
    this.peliculaParaCalificar.set(null);
    this.comentarioModal = '';
    this.mensajeExitoCalificacion.set(null);
    this.errorCalificacion.set(null);
  }

  onPuntajeChange(puntos: number): void {
    this.puntajeModal.set(puntos);
  }

  obtenerTextoFeedback(puntaje: number): string {
    if (puntaje >= 5) return '¡Obra maestra imperdible! ⭐⭐⭐⭐⭐';
    if (puntaje >= 4.5) return '¡Excelente experiencia cinematográfica! ⭐⭐⭐⭐½';
    if (puntaje >= 4) return 'Muy buena película ⭐⭐⭐⭐';
    if (puntaje >= 3.5) return 'Buena y entretenida ⭐⭐⭐½';
    if (puntaje >= 3) return 'Regular / Pasable ⭐⭐⭐';
    if (puntaje >= 2) return 'Floja / Decepcionante ⭐⭐';
    if (puntaje >= 1) return 'Mala ⭐';
    return 'Seleccioná las estrellas para calificar';
  }

  async confirmarGuardarCalificacion(): Promise<void> {
    const modalData = this.peliculaParaCalificar();
    const u = this.usuario;
    if (!modalData || !u || this.guardandoCalificacion()) return;

    this.guardandoCalificacion.set(true);
    this.errorCalificacion.set(null);
    this.mensajeExitoCalificacion.set(null);

    try {
      const resenaGuardada = await this.resenasService.guardarResena({
        peliculaId: modalData.peliculaId,
        usuarioId: u.id,
        usuarioNombre: `${u.nombre} ${u.apellido}`.trim(),
        usuarioEmail: u.email,
        puntos: this.puntajeModal(),
        comentario: this.comentarioModal.trim(),
      });

      // Actualizar mapa reactivo
      this.resenasUsuario.update((mapa) => ({
        ...mapa,
        [modalData.peliculaId]: resenaGuardada,
      }));

      this.mensajeExitoCalificacion.set('¡Tu calificación y reseña fueron guardadas con éxito!');

      setTimeout(() => {
        this.cerrarModalCalificar();
      }, 1100);
    } catch (err) {
      this.errorCalificacion.set(
        err instanceof Error ? err.message : 'No se pudo guardar la calificación.'
      );
    } finally {
      this.guardandoCalificacion.set(false);
    }
  }

  async eliminarCalificacion(id: string, peliculaId: string): Promise<void> {
    const u = this.usuario;
    if (!u || this.guardandoCalificacion()) return;

    this.guardandoCalificacion.set(true);
    try {
      await this.resenasService.eliminarMiResena(id, peliculaId, u.id);
      this.resenasUsuario.update((mapa) => {
        const nuevo = { ...mapa };
        delete nuevo[peliculaId];
        return nuevo;
      });
      this.cerrarModalCalificar();
    } catch (err) {
      this.errorCalificacion.set(
        err instanceof Error ? err.message : 'No se pudo eliminar la calificación.'
      );
    } finally {
      this.guardandoCalificacion.set(false);
    }
  }

  // ==========================================
  // Modal de Ticket / QR
  // ==========================================
  abrirTicketModal(compra: Compra): void {
    this.compraSeleccionadaModal.set(compra);
  }

  cerrarTicketModal(): void {
    this.compraSeleccionadaModal.set(null);
  }

  verTicketCompleto(compra: Compra): void {
    this.router.navigate(['/pago'], { queryParams: { codigo: compra.codigo } });
  }

  // ==========================================
  // Cancelación de compras
  // ==========================================
  puedeCancelar(compra: Compra): boolean {
    return this.comprasService.puedeCancelar(compra);
  }

  pedirCancelacion(compra: Compra): void {
    this.errorCancelacion.set(null);
    this.compraACancelar.set(compra);
  }

  cerrarCancelacion(): void {
    if (this.cancelando()) return;
    this.compraACancelar.set(null);
  }

  async confirmarCancelacion(): Promise<void> {
    const compra = this.compraACancelar();
    if (!compra || this.cancelando()) return;

    this.cancelando.set(true);
    this.errorCancelacion.set(null);
    try {
      const credito = await this.comprasService.cancelarCompra(compra);
      this.compras.update((lista) =>
        lista.map((c) => (c.id === compra.id ? { ...c, estado: 'cancelada' } : c))
      );
      this.mensajeCancelacion.set(
        `Compra ${compra.codigo} cancelada. Se acreditaron $${credito} como crédito a favor.`
      );
      this.compraACancelar.set(null);
    } catch (err) {
      this.errorCancelacion.set(
        err instanceof Error ? err.message : 'No se pudo cancelar la compra.'
      );
    } finally {
      this.cancelando.set(false);
    }
  }

  async cerrarSesion(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/home']);
  }
}
