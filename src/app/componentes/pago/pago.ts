import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ComprasService } from '../../servicios/compras';
import { Auth } from '../../servicios/auth';
import { Compra, CrearCompraDto } from '../../models/compra';
import { CompraContexto } from '../candy/seleccion-candy/seleccion-candy';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pago.html',
  styleUrl: './pago.css',
})
export class PagoComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private comprasService = inject(ComprasService);
  private authService = inject(Auth);

  compra = signal<Compra | null>(null);
  cargando = signal<boolean>(true);
  errorMensaje = signal<string | null>(null);
  copiado = signal<boolean>(false);
  confirmandoCancelacion = signal<boolean>(false);
  cancelando = signal<boolean>(false);
  errorCancelacion = signal<string | null>(null);
  creditoAcreditado = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    const compraIdQuery = this.route.snapshot.queryParamMap.get('compraId');
    const codigoQuery = this.route.snapshot.queryParamMap.get('codigo');

    // 1. Si viene con un código o ID específico
    if (codigoQuery) {
      try {
        const encontrada = await this.comprasService.obtenerPorCodigo(codigoQuery);
        if (encontrada) {
          this.compra.set(encontrada);
          this.cargando.set(false);
          return;
        }
      } catch (err) {
        this.errorMensaje.set(err instanceof Error ? err.message : 'No se pudo cargar la compra.');
        this.cargando.set(false);
        return;
      }
    }

    if (compraIdQuery) {
      const encontrada = await this.comprasService.obtenerPorId(compraIdQuery);
      if (encontrada) {
        if (!encontrada.qrImage && encontrada.qrData) {
          encontrada.qrImage = await this.comprasService.generarQrImagen(encontrada.qrData);
        }
        this.compra.set(encontrada);
        this.cargando.set(false);
        return;
      }
    }

    // 2. Si viene desde el flujo activo de compra guardado en sessionStorage
    await this.procesarCompraDesdeContexto();
  }

  private async procesarCompraDesdeContexto(): Promise<void> {
    if (typeof sessionStorage === 'undefined') {
      this.errorMensaje.set('No se encontró información de compra.');
      this.cargando.set(false);
      return;
    }

    const raw = sessionStorage.getItem('cinetp_compra_actual');
    if (!raw) {
      this.errorMensaje.set('No hay ninguna compra en proceso. Selecciona tus entradas desde la cartelera.');
      this.cargando.set(false);
      return;
    }

    try {
      const ctx: CompraContexto = JSON.parse(raw);
      if (!ctx.funcionId || !ctx.asientos || ctx.asientos.length === 0) {
        this.errorMensaje.set('No se seleccionaron butacas válidas.');
        this.cargando.set(false);
        return;
      }

      const usuario = this.authService.usuarioActual();
      const totalCandy = ctx.totalCandy || 0;
      const totalEntradas = ctx.totalEntradas || 0;
      const descuento = ctx.descuento || 0;
      const totalFinal = Math.max(0, totalEntradas + totalCandy - descuento);

      const dto: CrearCompraDto = {
        usuarioId: usuario?.id,
        usuarioEmail: usuario?.email,
        funcionId: ctx.funcionId,
        peliculaId: ctx.peliculaId,
        peliculaTitulo: ctx.peliculaTitulo || 'Película',
        salaNombre: ctx.salaNombre || 'Sala Principal',
        funcionInicio: ctx.inicio || new Date().toISOString(),
        formato: ctx.formato || '2D',
        idioma: ctx.idioma || 'español',
        asientos: ctx.asientos,
        totalEntradas,
        itemsCandy: (ctx.itemsCandy || []).map((it) => ({
          productoId: it.producto.id,
          nombre: it.producto.nombre,
          cantidad: it.cantidad,
          precioUnitario: it.producto.precio,
          subtotal: it.producto.precio * it.cantidad,
        })),
        totalCandy,
        descuento,
        cuponId: ctx.cuponId,
        cuponCodigo: ctx.cuponCodigo,
        totalFinal,
        puntosGanados: Math.round(totalFinal),
      };

      const compraCreada = await this.comprasService.crearCompra(dto);
      this.compra.set(compraCreada);

      // Limpiar contexto de compra completada
      sessionStorage.removeItem('cinetp_compra_actual');
    } catch (err) {
      console.error('Error al procesar la compra:', err);
      this.errorMensaje.set(
        err instanceof Error ? err.message : 'Ocurrió un error al registrar la compra.'
      );
    } finally {
      this.cargando.set(false);
    }
  }

  pedirCancelacion(): void {
    const c = this.compra();
    if (!c) return;

    if (!this.comprasService.puedeCancelar(c)) {
      this.confirmandoCancelacion.set(false);
      this.errorCancelacion.set(
        'Esta compra ya no se puede cancelar: solo se permite hasta 2 horas antes de la función.'
      );
      return;
    }
    this.errorCancelacion.set(null);
    this.confirmandoCancelacion.set(true);
  }

  cerrarCancelacion(): void {
    if (this.cancelando()) return;
    this.confirmandoCancelacion.set(false);
  }

  async confirmarCancelacion(): Promise<void> {
    const c = this.compra();
    if (!c || this.cancelando()) return;

    this.cancelando.set(true);
    this.errorCancelacion.set(null);
    try {
      const credito = await this.comprasService.cancelarCompra(c);
      this.compra.set({ ...c, estado: 'cancelada' });
      this.creditoAcreditado.set(credito);
    } catch (err) {
      this.errorCancelacion.set(
        err instanceof Error ? err.message : 'No se pudo cancelar la compra.'
      );
    } finally {
      this.cancelando.set(false);
      this.confirmandoCancelacion.set(false);
    }
  }

  copiarCodigo(): void {
    const c = this.compra()?.codigo;
    if (!c) return;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(c).then(() => {
        this.copiado.set(true);
        setTimeout(() => this.copiado.set(false), 2500);
      });
    } else {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = c;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    }
  }

  imprimirTicket(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  formatearFechaHora(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleString('es-AR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        });
  }
}
