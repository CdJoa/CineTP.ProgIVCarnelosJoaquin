import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Cupon } from '../../../models/cupon';
import { CuponesService } from '../../../servicios/cupones';
import { crearFormularioCupon, generarPreviewCupon } from '../../../validators/cupon';
import { AdministrarBase } from '../administrar-base';

@Component({
  selector: 'app-administrar-cupones',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './administrar-cupones.html',
  styleUrl: './administrar-cupones.css',
})
export class AdministrarCuponesComponent extends AdministrarBase<Cupon> {
  private cuponesService = inject(CuponesService);

  cupones = this.items;
  cuponSeleccionado = this.itemSeleccionado;
  cuponEditando = this.itemEditando;

  busqueda = signal<string>('');

  editForm: FormGroup = crearFormularioCupon(this.fb);

  // Getters para el formulario
  get codigo() { return this.editForm.get('codigo'); }
  get nombre() { return this.editForm.get('nombre'); }
  get descripcion() { return this.editForm.get('descripcion'); }
  get porcentajeDescuento() { return this.editForm.get('porcentajeDescuento'); }
  get edadMinimaRequerida() { return this.editForm.get('edadMinimaRequerida'); }
  get esPrimeraCompra() { return this.editForm.get('esPrimeraCompra'); }
  get activo() { return this.editForm.get('activo'); }

  get cuponesFiltrados(): Cupon[] {
    let lista = this.cupones();
    const q = this.busqueda().toLowerCase().trim();

    if (q) {
      lista = lista.filter(c =>
        c.codigo.toLowerCase().includes(q) ||
        c.nombre.toLowerCase().includes(q) ||
        c.descripcion.toLowerCase().includes(q)
      );
    }
    return lista;
  }

  get cuponEditandoPreview(): Cupon | null {
    if (!this.modoModal()) return null;
    return generarPreviewCupon(this.editForm.value, this.cuponEditando() || undefined);
  }

  protected override cargarData(): Promise<Cupon[]> {
    return this.cuponesService.obtenerCupones();
  }

  protected override crearData(payload: any): Promise<Cupon> {
    const dataFormatted = {
      codigo: (payload.codigo || '').toUpperCase().trim(),
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      porcentaje_descuento: Number(payload.porcentajeDescuento),
      edad_minima_requerida: payload.edadMinimaRequerida ? Number(payload.edadMinimaRequerida) : null,
      es_primera_compra: !!payload.esPrimeraCompra,
      activo: !!payload.activo,
    };
    return this.cuponesService.insertar(dataFormatted);
  }

  protected override actualizarData(id: string, payload: any): Promise<Cupon> {
    const dataFormatted = {
      codigo: (payload.codigo || '').toUpperCase().trim(),
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      porcentaje_descuento: Number(payload.porcentajeDescuento),
      edad_minima_requerida: payload.edadMinimaRequerida ? Number(payload.edadMinimaRequerida) : null,
      es_primera_compra: !!payload.esPrimeraCompra,
      activo: !!payload.activo,
    };
    return this.cuponesService.actualizar(id, dataFormatted);
  }

  protected override mapearFormulario(cupon: Cupon): Record<string, any> {
    return {
      codigo: cupon.codigo,
      nombre: cupon.nombre,
      descripcion: cupon.descripcion,
      porcentajeDescuento: cupon.porcentajeDescuento,
      edadMinimaRequerida: cupon.edadMinimaRequerida || null,
      esPrimeraCompra: cupon.esPrimeraCompra,
      activo: cupon.activo,
    };
  }

  protected override onFormularioReset(): void {
    this.editForm.patchValue({
      codigo: '',
      nombre: '',
      descripcion: '',
      porcentajeDescuento: 15,
      edadMinimaRequerida: null,
      esPrimeraCompra: false,
      activo: true,
    });
  }

  protected override esValidoFormulario(): boolean {
    const valido = this.editForm.valid;
    if (!valido) {
      this.mensajeError.set('Por favor completa todos los campos requeridos correctamente.');
    }
    return valido;
  }

  seleccionarCupon(cupon: Cupon): void {
    this.seleccionarItem(cupon);
  }
}
