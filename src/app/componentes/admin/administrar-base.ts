import { Directive, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { CloudinaryService } from '../../servicios/cloudinary';

@Directive()
export abstract class AdministrarBase<T extends { id: string }> implements OnInit {
  protected fb = inject(FormBuilder);
  protected cloudinaryService = inject(CloudinaryService);

  // Signals de estado CRUD
  items: WritableSignal<T[]> = signal<T[]>([]);
  itemSeleccionado: WritableSignal<T | null> = signal<T | null>(null);
  itemEditando: WritableSignal<T | null> = signal<T | null>(null);
  modoModal: WritableSignal<'crear' | 'editar' | null> = signal<'crear' | 'editar' | null>(null);

  cargando: WritableSignal<boolean> = signal<boolean>(true);
  guardando: WritableSignal<boolean> = signal<boolean>(false);
  subiendoImagen: WritableSignal<boolean> = signal<boolean>(false);

  mensajeError: WritableSignal<string | null> = signal<string | null>(null);
  mensajeExito: WritableSignal<string | null> = signal<string | null>(null);

  abstract editForm: FormGroup;

  protected abstract cargarData(): Promise<T[]>;
  protected abstract actualizarData(id: string, payload: any): Promise<T>;
  protected abstract crearData(payload: any): Promise<T>;
  protected abstract mapearFormulario(item: T): Record<string, any>;

  protected onFormularioReset(): void {}
  protected onFormularioCargado(item: T): void {}

  async ngOnInit(): Promise<void> {
    await this.cargarItems();
  }

  async cargarItems(): Promise<void> {
    this.cargando.set(true);
    this.mensajeError.set(null);
    try {
      const lista = await this.cargarData();
      this.items.set(lista);
    } catch (err) {
      this.mensajeError.set(
        err instanceof Error ? err.message : 'Error al cargar los datos.'
      );
    } finally {
      this.cargando.set(false);
    }
  }

  seleccionarItem(item: T): void {
    if (this.itemSeleccionado()?.id === item.id) {
      this.itemSeleccionado.set(null);
    } else {
      this.itemSeleccionado.set(item);
    }
  }

  abrirCreacion(): void {
    this.itemEditando.set(null);
    this.modoModal.set('crear');
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.editForm.reset();
    this.onFormularioReset();
  }

  abrirEdicion(item: T): void {
    this.itemEditando.set(item);
    this.modoModal.set('editar');
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.editForm.reset();
    this.editForm.patchValue(this.mapearFormulario(item));
    this.onFormularioCargado(item);
  }

  cerrarEdicion(): void {
    this.modoModal.set(null);
    this.itemEditando.set(null);
  }

  async subirImagenControl(event: Event, controlName: string): Promise<void> {
    return this.cloudinaryService.procesarInputImagen(
      event,
      this.editForm,
      controlName,
      this.subiendoImagen
    );
  }

  protected esValidoFormulario(): boolean {
    return this.editForm.valid;
  }

  protected obtenerPayload(): any {
    return this.editForm.value;
  }

  async guardarCambios(): Promise<void> {
    const modo = this.modoModal();
    if (!modo) return;

    if (!this.esValidoFormulario()) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.mensajeError.set(null);

    try {
      const payload = this.obtenerPayload();

      if (modo === 'crear') {
        const itemCreado = await this.crearData(payload);
        this.items.set([itemCreado, ...this.items()]);
        this.itemSeleccionado.set(itemCreado);
        this.mensajeExito.set('¡Creado con éxito!');
      } else {
        const itemActual = this.itemEditando();
        if (!itemActual) return;
        const itemActualizado = await this.actualizarData(itemActual.id, payload);

        this.items.set(
          this.items().map((item) => (item.id === itemActualizado.id ? itemActualizado : item))
        );

        if (this.itemSeleccionado()?.id === itemActualizado.id) {
          this.itemSeleccionado.set(itemActualizado);
        }

        this.mensajeExito.set('¡Guardado con éxito!');
      }

      this.guardando.set(false);
      setTimeout(() => {
        this.cerrarEdicion();
        this.mensajeExito.set(null);
      }, 1200);
    } catch (err) {
      this.guardando.set(false);
      this.mensajeError.set(
        err instanceof Error ? err.message : 'Error al procesar la solicitud.'
      );
    }
  }
}
