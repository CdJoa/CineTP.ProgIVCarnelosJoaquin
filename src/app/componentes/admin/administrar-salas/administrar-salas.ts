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
  salaEditando = this.itemEditando;

  busqueda = signal<string>('');

  editForm: FormGroup = crearFormularioSala(this.fb);

  get nombre() {
    return this.editForm.get('nombre');
  }

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

  protected override cargarData(): Promise<Sala[]> {
    return this.salaService.obtenerSalas();
  }

  protected override crearData(payload: any): Promise<Sala> {
    return this.salaService.crearSala({
      nombre: payload.nombre,
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
    this.editForm.patchValue({
      nombre: '',
      formato: '2D',
      activa: true,
    });
  }

  protected override onFormularioCargado(_sala: Sala): void {
  }

  public seleccionarSala(sala: Sala): void {
    this.seleccionarItem(sala);
  }

  public getCapacidadTotal(sala: Sala): number {
    return sala.capacidadTotal || 0;
  }
}
