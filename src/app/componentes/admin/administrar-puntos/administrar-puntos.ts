import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { CanjePuntos, PuntosService } from '../../../servicios/puntos';

/**
 * Configuración del programa de puntos: el admin define a mano cuántos puntos
 * equivalen a $1 de crédito y el mínimo por conversión.
 */
@Component({
  selector: 'app-administrar-puntos',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './administrar-puntos.html',
  styleUrl: './administrar-puntos.css',
})
export class AdministrarPuntosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private puntosService = inject(PuntosService);

  config = this.puntosService.configuracion;

  form = this.fb.nonNullable.group({
    puntosPorPeso: [10, [Validators.required, Validators.min(1), Validators.max(1000)]],
    minimoPuntos: [100, [Validators.required, Validators.min(1)]],
  });

  /** Valores del formulario como signal para la vista previa en vivo. */
  private valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  guardando = signal(false);
  mensaje = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  historial = signal<(CanjePuntos & { usuario: string })[]>([]);
  cargandoHistorial = signal(true);

  async ngOnInit(): Promise<void> {
    const config = await this.puntosService.cargarConfiguracion();
    this.form.setValue(config);
    await this.cargarHistorial();
  }

  async cargarHistorial(): Promise<void> {
    this.cargandoHistorial.set(true);
    try {
      this.historial.set(await this.puntosService.obtenerHistorialGeneral());
    } catch (err) {
      this.mensaje.set({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo cargar el historial.' });
    } finally {
      this.cargandoHistorial.set(false);
    }
  }

  /** Ejemplo para la vista previa: cuánto crédito da una compra de $10.000. */
  ejemplo(): { puntos: number; credito: number } {
    const tasa = Math.max(1, Math.floor(Number(this.valores().puntosPorPeso) || 1));
    return { puntos: 10000, credito: Math.floor(10000 / tasa) };
  }

  porcentajeReintegro(): string {
    const tasa = Math.max(1, Number(this.valores().puntosPorPeso) || 1);
    return (100 / tasa).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.mensaje.set({ tipo: 'error', texto: 'La tasa debe estar entre 1 y 1000 y el mínimo ser mayor a 0.' });
      return;
    }
    this.guardando.set(true);
    this.mensaje.set(null);
    try {
      const { puntosPorPeso, minimoPuntos } = this.form.getRawValue();
      await this.puntosService.guardarConfiguracion({
        puntosPorPeso: Math.floor(Number(puntosPorPeso)),
        minimoPuntos: Math.floor(Number(minimoPuntos)),
      });
      this.mensaje.set({ tipo: 'ok', texto: 'Configuración guardada. Se aplica a las próximas conversiones.' });
    } catch (err) {
      this.mensaje.set({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo guardar.' });
    } finally {
      this.guardando.set(false);
    }
  }
}
