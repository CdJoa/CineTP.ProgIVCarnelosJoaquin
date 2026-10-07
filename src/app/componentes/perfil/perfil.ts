import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../servicios/auth';
import { ComprasService } from '../../servicios/compras';
import { Compra } from '../../models/compra';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class PerfilComponent implements OnInit {
  authService = inject(Auth);
  private comprasService = inject(ComprasService);
  private router = inject(Router);

  compras = signal<Compra[]>([]);
  cargandoCompras = signal<boolean>(true);
  compraSeleccionadaModal = signal<Compra | null>(null);
  compraACancelar = signal<Compra | null>(null);
  cancelando = signal<boolean>(false);
  errorCancelacion = signal<string | null>(null);
  mensajeCancelacion = signal<string | null>(null);

  get usuario() {
    return this.authService.usuarioActual();
  }

  async ngOnInit(): Promise<void> {
    await this.cargarCompras();
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

  abrirTicketModal(compra: Compra): void {
    this.compraSeleccionadaModal.set(compra);
  }

  cerrarTicketModal(): void {
    this.compraSeleccionadaModal.set(null);
  }

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

  verTicketCompleto(compra: Compra): void {
    this.router.navigate(['/pago'], { queryParams: { codigo: compra.codigo } });
  }

  async cerrarSesion(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/home']);
  }
}
