import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Auth } from '../../../servicios/auth';
import { CanjePuntos, PuntosService } from '../../../servicios/puntos';

/**
 * Convertidor de puntos a crédito del perfil del usuario.
 * La tasa y el mínimo los define el admin; la conversión se hace en una RPC atómica.
 */
@Component({
  selector: 'app-convertidor-puntos',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './convertidor-puntos.html',
  styleUrl: './convertidor-puntos.css',
})
export class ConvertidorPuntosComponent implements OnInit {
  private auth = inject(Auth);
  private puntosService = inject(PuntosService);

  config = this.puntosService.configuracion;
  historial = signal<CanjePuntos[]>([]);
  cargandoHistorial = signal(true);
  puntosAConvertir = signal(0);
  convirtiendo = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);

  saldoPuntos = computed(() => this.auth.usuarioActual()?.puntos || 0);

  /** Máximo convertible: el saldo redondeado hacia abajo al múltiplo de la tasa. */
  maximoConvertible = computed(() => {
    const tasa = this.config().puntosPorPeso;
    return Math.floor(this.saldoPuntos() / tasa) * tasa;
  });

  creditoResultante = computed(() => this.puntosService.calcularCredito(this.puntosAConvertir()));

  /** Motivo por el que no se puede convertir la cantidad elegida (null = se puede). */
  motivoInvalido = computed<string | null>(() => {
    const puntos = this.puntosAConvertir();
    const { puntosPorPeso, minimoPuntos } = this.config();
    if (this.saldoPuntos() < minimoPuntos) return `Necesitás al menos ${minimoPuntos} puntos para convertir.`;
    if (!puntos || puntos < minimoPuntos) return `El mínimo es ${minimoPuntos} puntos.`;
    if (puntos % puntosPorPeso !== 0) return `Ingresá un múltiplo de ${puntosPorPeso}.`;
    if (puntos > this.saldoPuntos()) return 'No tenés tantos puntos.';
    return null;
  });

  async ngOnInit(): Promise<void> {
    await this.puntosService.cargarConfiguracion();
    this.puntosAConvertir.set(this.maximoConvertible() >= this.config().minimoPuntos ? this.maximoConvertible() : 0);
    await this.cargarHistorial();
  }

  async cargarHistorial(): Promise<void> {
    const usuario = this.auth.usuarioActual();
    if (!usuario) return;
    this.cargandoHistorial.set(true);
    try {
      this.historial.set(await this.puntosService.obtenerHistorial(usuario.id));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
    } finally {
      this.cargandoHistorial.set(false);
    }
  }

  cambiarPuntos(valor: string): void {
    this.puntosAConvertir.set(Math.max(0, Math.floor(Number(valor) || 0)));
    this.exito.set(null);
  }

  usarMaximo(): void {
    this.puntosAConvertir.set(this.maximoConvertible());
  }

  async convertir(): Promise<void> {
    if (this.motivoInvalido() || this.convirtiendo()) return;
    this.convirtiendo.set(true);
    this.error.set(null);
    this.exito.set(null);
    try {
      const puntos = this.puntosAConvertir();
      const acreditado = await this.puntosService.convertir(puntos);
      this.exito.set(`Convertiste ${puntos} puntos en $${acreditado} de crédito.`);
      this.puntosAConvertir.set(0);
      await this.cargarHistorial();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo convertir.');
    } finally {
      this.convirtiendo.set(false);
    }
  }
}
