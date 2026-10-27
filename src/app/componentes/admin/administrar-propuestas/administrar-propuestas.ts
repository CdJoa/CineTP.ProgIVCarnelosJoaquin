import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PropuestasService } from '../../../servicios/propuestas';
import { PropuestaPelicula, EstadoPropuesta } from '../../../models/propuesta';

@Component({
  selector: 'app-administrar-propuestas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './administrar-propuestas.html',
  styleUrl: './administrar-propuestas.css',
})
export class AdministrarPropuestasComponent implements OnInit {
  private propuestasService = inject(PropuestasService);
  private router = inject(Router);

  propuestas = signal<PropuestaPelicula[]>([]);
  cargando = signal<boolean>(true);
  procesandoId = signal<string | null>(null);

  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  filtroEstado = signal<'todas' | EstadoPropuesta>('todas');

  propuestasFiltradas = computed(() => {
    const filtro = this.filtroEstado();
    const lista = this.propuestas();
    if (filtro === 'todas') return lista;
    return lista.filter((p) => p.estado === filtro);
  });

  cantidadPendientes = computed(() => {
    return this.propuestas().filter((p) => p.estado === 'pendiente').length;
  });

  async ngOnInit(): Promise<void> {
    await this.cargarPropuestas();
  }

  async cargarPropuestas(): Promise<void> {
    this.cargando.set(true);
    this.mensajeError.set(null);
    try {
      const lista = await this.propuestasService.obtenerTodasLasPropuestas();
      this.propuestas.set(lista);
    } catch (err: any) {
      this.mensajeError.set(err?.message || 'Error al cargar las propuestas de clientes.');
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarFiltro(estado: 'todas' | EstadoPropuesta): void {
    this.filtroEstado.set(estado);
  }

  async rechazarPropuesta(propuesta: PropuestaPelicula): Promise<void> {
    if (!confirm(`¿Rechazar la propuesta "${propuesta.titulo}" enviada por ${propuesta.usuarioNombre}?`)) {
      return;
    }

    this.procesandoId.set(propuesta.id);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    try {
      const actualizada = await this.propuestasService.actualizarEstado(
        propuesta.id,
        'rechazada',
        propuesta.titulo
      );

      this.propuestas.set(
        this.propuestas().map((p) => (p.id === propuesta.id ? actualizada : p))
      );
      this.mensajeExito.set(`Propuesta "${propuesta.titulo}" rechazada.`);
    } catch (err: any) {
      this.mensajeError.set(err?.message || 'Error al rechazar la propuesta.');
    } finally {
      this.procesandoId.set(null);
    }
  }

  async aceptarPropuesta(propuesta: PropuestaPelicula): Promise<void> {
    this.procesandoId.set(propuesta.id);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    try {
      // 1. Marcar como aceptada
      const actualizada = await this.propuestasService.actualizarEstado(
        propuesta.id,
        'aceptada',
        propuesta.titulo
      );

      this.propuestas.set(
        this.propuestas().map((p) => (p.id === propuesta.id ? actualizada : p))
      );

      // 2. Navegar a la pantalla de crear película con los datos enviados
      await this.router.navigate(['/admin/peliculas'], {
        queryParams: {
          titulo: propuesta.titulo,
          sinopsis: propuesta.descripcion,
          origen: 'propuesta',
          propuestaId: propuesta.id,
        },
      });
    } catch (err: any) {
      this.mensajeError.set(err?.message || 'Error al aceptar la propuesta.');
      this.procesandoId.set(null);
    }
  }
}
