import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SalaService } from '../../../servicios/sala';
import { Sala } from '../../../models/sala';
import { AdministrarBase } from '../administrar-base';
import { crearFormularioSala, generarPreviewSala } from '../../../validators/sala';
import { MapaSalaComponent } from '../../sala/mapa-sala/mapa-sala';

@Component({
  selector: 'app-administrar-salas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MapaSalaComponent],
  templateUrl: './administrar-salas.html',
  styleUrl: './administrar-salas.css',
})
export class AdministrarSalas extends AdministrarBase<Sala> {
  private salaService = inject(SalaService);

  salas = this.items;
  salaSeleccionada = this.itemSeleccionado;

  busqueda = signal<string>('');

  editForm: FormGroup = crearFormularioSala(this.fb);

  get salaEditandoPreview(): Sala | null {
    if (!this.modoModal()) return null;
    const filas = this.salaService.generarFilas();
    return generarPreviewSala(this.editForm.value, filas, this.itemEditando() || undefined);
  }

  get salasFiltradas(): Sala[] {
    let lista = this.salas();
    const q = this.busqueda().toLowerCase().trim();
    if (q) {
      lista = lista.filter((s) => s.nombre.toLowerCase().includes(q));
    }
    return lista;
  }

  get proximoNumeroDisponible(): number {
    const usadas = new Set<number>();
    const editandoId = this.itemEditando()?.id;

    for (const s of this.salas()) {
      if (editandoId && s.id === editandoId) continue;
      const match = s.nombre.match(/\d+/);
      if (match) {
        usadas.add(parseInt(match[0], 10));
      }
    }

    let num = 1;
    while (usadas.has(num)) {
      num++;
    }
    return num;
  }

  get listaNumerosDisponibles(): number[] {
    const usadas = new Set<number>();
    const editandoId = this.itemEditando()?.id;

    for (const s of this.salas()) {
      if (editandoId && s.id === editandoId) continue;
      const match = s.nombre.match(/\d+/);
      if (match) {
        usadas.add(parseInt(match[0], 10));
      }
    }

    const numActual = this.itemEditando()?.nombre.match(/\d+/)?.[0];
    const numEditandoInt = numActual ? parseInt(numActual, 10) : null;

    const lista: number[] = [];
    if (numEditandoInt) {
      lista.push(numEditandoInt);
    }

    for (let n = 1; n <= 50; n++) {
      if (!usadas.has(n) && !lista.includes(n)) {
        lista.push(n);
      }
    }
    return lista.sort((a, b) => a - b);
  }

  get numeroSalaSeleccionado(): number {
    const nombreVal = this.editForm.get('nombre')?.value || '';
    const match = nombreVal.match(/\d+/);
    if (match) return parseInt(match[0], 10);
    return this.proximoNumeroDisponible;
  }

  public onNumeroSalaChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (val) {
      this.editForm.patchValue({
        nombre: `Sala ${val}`,
      });
    }
  }

  protected override cargarData(): Promise<Sala[]> {
    return this.salaService.obtenerSalas();
  }

  protected override crearData(payload: any): Promise<Sala> {
    return this.salaService.crearSala({
      nombre: payload.nombre || `Sala ${this.proximoNumeroDisponible}`,
      formato: payload.formato || '2D',
    });
  }

  protected override actualizarData(id: string, payload: any): Promise<Sala> {
    const filasActualizadas = this.salaService.generarFilas();
    return this.salaService.actualizarSala(id, {
      ...payload,
      filas: filasActualizadas,
    });
  }

  protected override mapearFormulario(sala: Sala): Record<string, any> {
    return {
      nombre: sala.nombre,
      formato: sala.formato || '2D',
      activa: sala.activa ?? true,
    };
  }

  protected override onFormularioReset(): void {
    const proximoNum = this.proximoNumeroDisponible;
    this.editForm.patchValue({
      nombre: `Sala ${proximoNum}`,
      formato: '2D',
      activa: true,
    });
  }

  protected override onFormularioCargado(_sala: Sala): void {
  }

  protected override esValidoFormulario(): boolean {
    const valido = this.editForm.valid;
    if (!valido) {
      this.mensajeError.set('Por favor seleccione un número de sala válido.');
    }
    return valido;
  }

  public seleccionarSala(sala: Sala): void {
    this.seleccionarItem(sala);
  }

}
