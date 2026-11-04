import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import jsQR from 'jsqr';
import { ComprasService, PuntoValidacion, ResultadoUsoCompra } from '../../../servicios/compras';
import { AuditoriaService } from '../../../servicios/auditoria';

const DESCRIPCION_RESULTADO: Record<ResultadoUsoCompra['resultado'], string> = {
  usada: 'válido, marcado como usado',
  ya_usada: 'rechazado, ya había sido usado',
  cancelada: 'rechazado, la compra está cancelada',
  inexistente: 'rechazado, el código no existe',
  sin_candy: 'rechazado, la compra no incluye productos de candy',
};

const NOMBRE_PUNTO: Record<PuntoValidacion, string> = {
  entrada: 'ingreso a sala',
  candy: 'Candy Bar',
};

@Component({
  selector: 'app-validar-entrada',
  standalone: true,
  templateUrl: './validar-entrada.html',
  styleUrl: './validar-entrada.css',
})
export class ValidarEntrada implements OnDestroy {
  private comprasService = inject(ComprasService);
  private auditoriaService = inject(AuditoriaService);

  @ViewChild('video') private videoRef?: ElementRef<HTMLVideoElement>;

  /** Punto donde está trabajando el empleado: puerta de la sala o mostrador del candy. */
  punto = signal<PuntoValidacion>('entrada');
  codigo = signal<string>('');
  escaneando = signal<boolean>(false);
  procesando = signal<boolean>(false);
  resultado = signal<ResultadoUsoCompra | null>(null);
  error = signal<string | null>(null);

  private stream?: MediaStream;
  private cuadroId?: number;
  private canvas?: HTMLCanvasElement;

  cambiarPunto(punto: PuntoValidacion): void {
    this.punto.set(punto);
    this.resultado.set(null);
    this.error.set(null);
  }

  ngOnDestroy(): void {
    this.detenerEscaner();
  }

  async iniciarEscaner(): Promise<void> {
    this.error.set(null);
    this.resultado.set(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('Este navegador no permite usar la cámara. Ingresá el código manualmente.');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
    } catch {
      this.error.set('No se pudo acceder a la cámara. Revisá los permisos o ingresá el código manualmente.');
      return;
    }

    const video = this.videoRef?.nativeElement;
    if (!video) {
      this.detenerEscaner();
      return;
    }

    video.srcObject = this.stream;
    await video.play();
    this.escaneando.set(true);
    this.cuadroId = requestAnimationFrame(this.leerCuadro);
  }

  detenerEscaner(): void {
    if (this.cuadroId !== undefined) {
      cancelAnimationFrame(this.cuadroId);
      this.cuadroId = undefined;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.escaneando.set(false);
  }

  private leerCuadro = (): void => {
    const video = this.videoRef?.nativeElement;
    if (!video || !this.stream) return;

    if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      this.canvas ??= document.createElement('canvas');
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;
      const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
        const imagen = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const qr = jsQR(imagen.data, imagen.width, imagen.height);
        if (qr?.data) {
          this.detenerEscaner();
          void this.validar(this.extraerCodigo(qr.data), 'QR');
          return;
        }
      }
    }

    this.cuadroId = requestAnimationFrame(this.leerCuadro);
  };

  /**
   * El QR del ticket contiene un JSON con el código; si no lo es, se toma el texto tal cual.
   */
  private extraerCodigo(contenido: string): string {
    try {
      const datos = JSON.parse(contenido);
      if (datos && typeof datos['codigo'] === 'string') return datos['codigo'];
    } catch {
      // No es JSON: se usa el texto leído como código
    }
    return contenido;
  }

  validarManual(): void {
    void this.validar(this.codigo(), 'código manual');
  }

  async validar(codigo: string, medio: 'QR' | 'código manual'): Promise<void> {
    const limpio = codigo.trim();
    if (!limpio || this.procesando()) return;

    const punto = this.punto();
    this.procesando.set(true);
    this.error.set(null);
    this.resultado.set(null);
    try {
      const resultado = await this.comprasService.usarCompra(limpio, punto);
      this.resultado.set(resultado);
      this.codigo.set('');
      void this.auditoriaService.registrar(
        'lectura_qr',
        `${limpio.toUpperCase()} leído por ${medio} en ${NOMBRE_PUNTO[punto]}: ${DESCRIPCION_RESULTADO[resultado.resultado]}`
      );
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo validar la compra.';
      this.error.set(mensaje);
      void this.auditoriaService.registrar(
        'lectura_qr',
        `${limpio.toUpperCase()} leído por ${medio} en ${NOMBRE_PUNTO[punto]}: error al validar (${mensaje})`
      );
    } finally {
      this.procesando.set(false);
    }
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
}
