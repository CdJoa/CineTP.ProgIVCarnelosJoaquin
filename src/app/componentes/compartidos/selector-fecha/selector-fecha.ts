import { Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Fecha en tres cajas (DD / MM / AAAA) con salto automático entre cajas, igual que en el registro.
 * Funciona como un control de formulario: el valor es 'YYYY-MM-DD', '' si está vacío
 * o 'invalida' si está incompleta o no existe (ej: 31/02), para que el validador la marque.
 */
@Component({
  selector: 'app-selector-fecha',
  standalone: true,
  templateUrl: './selector-fecha.html',
  styleUrl: './selector-fecha.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectorFecha), multi: true },
  ],
})
export class SelectorFecha implements ControlValueAccessor {
  etiqueta = input<string>('Fecha');
  invalido = input<boolean>(false);

  dia = signal('');
  mes = signal('');
  anio = signal('');
  deshabilitado = signal(false);

  private mesInput = viewChild<ElementRef<HTMLInputElement>>('mesInput');
  private anioInput = viewChild<ElementRef<HTMLInputElement>>('anioInput');
  private diaInput = viewChild<ElementRef<HTMLInputElement>>('diaInput');

  private onChange: (valor: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(valor: string | null): void {
    const partes = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.split('-') : null;
    this.anio.set(partes?.[0] ?? '');
    this.mes.set(partes?.[1] ?? '');
    this.dia.set(partes?.[2] ?? '');
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  onDia(event: Event): void {
    const valor = this.soloDigitos(event, 2);
    this.dia.set(valor);
    if (valor.length === 2) this.mesInput()?.nativeElement.focus();
    this.emitir();
  }

  onMes(event: Event): void {
    const valor = this.soloDigitos(event, 2);
    this.mes.set(valor);
    if (valor.length === 2) this.anioInput()?.nativeElement.focus();
    this.emitir();
  }

  onAnio(event: Event): void {
    this.anio.set(this.soloDigitos(event, 4));
    this.emitir();
  }

  /** Con la caja vacía, el backspace vuelve a la caja anterior. */
  volverSiVacio(caja: 'mes' | 'anio'): void {
    if (caja === 'mes' && !this.mes()) this.diaInput()?.nativeElement.focus();
    if (caja === 'anio' && !this.anio()) this.mesInput()?.nativeElement.focus();
  }

  marcarTocado(): void {
    this.onTouched();
  }

  private soloDigitos(event: Event, max: number): string {
    const input = event.target as HTMLInputElement;
    const valor = input.value.replace(/\D/g, '').slice(0, max);
    input.value = valor;
    return valor;
  }

  private emitir(): void {
    const d = this.dia();
    const m = this.mes();
    const a = this.anio();
    if (!d && !m && !a) {
      this.onChange('');
      return;
    }
    if (!d || !m || a.length !== 4) {
      this.onChange('invalida');
      return;
    }
    const iso = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const fecha = new Date(`${iso}T00:00:00`);
    const existe =
      !isNaN(fecha.getTime()) &&
      fecha.getFullYear() === Number(a) &&
      fecha.getMonth() + 1 === Number(m) &&
      fecha.getDate() === Number(d);
    this.onChange(existe ? iso : 'invalida');
  }
}
