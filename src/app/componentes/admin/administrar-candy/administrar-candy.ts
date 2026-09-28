import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ProductoCandy } from '../../../models/candy';
import { CandyService } from '../../../servicios/candy';
import { CartaCandy } from '../../candy/carta-candy/carta-candy';
import { CATEGORIAS_CANDY, crearFormularioCandy, generarPreviewCandy } from '../../../validators/candy';
import { AdministrarBase } from '../administrar-base';

@Component({
  selector: 'app-administrar-candy',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CartaCandy],
  templateUrl: './administrar-candy.html',
  styleUrl: './administrar-candy.css',
})
export class AdministrarCandy extends AdministrarBase<ProductoCandy> {
  private candyService = inject(CandyService);

  readonly categoriasList = CATEGORIAS_CANDY;

  productos = this.items;
  productoSeleccionado = this.itemSeleccionado;
  productoEditando = this.itemEditando;

  categoriaFiltro = signal<string>('todos');
  busqueda = signal<string>('');

  editForm: FormGroup = crearFormularioCandy(this.fb);

  // Getters para el formulario
  get nombre() { return this.editForm.get('nombre'); }
  get descripcion() { return this.editForm.get('descripcion'); }
  get categoria() { return this.editForm.get('categoria'); }
  get precio() { return this.editForm.get('precio'); }
  get puntajeCompra() { return this.editForm.get('puntajeCompra'); }
  get imagen() { return this.editForm.get('imagen'); }

  get productosFiltrados(): ProductoCandy[] {
    let lista = this.productos();
    const cat = this.categoriaFiltro();
    const q = this.busqueda().toLowerCase().trim();

    if (cat !== 'todos') {
      lista = lista.filter(p => p.categoria === cat);
    }
    if (q) {
      lista = lista.filter(p => p.nombre.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q));
    }
    return lista;
  }

  get productoEditandoPreview(): ProductoCandy | null {
    if (!this.modoModal()) return null;
    return generarPreviewCandy(this.editForm.value, this.productoEditando() || undefined);
  }

  protected override cargarData(): Promise<ProductoCandy[]> {
    return this.candyService.obtenerProductos();
  }

  protected override crearData(payload: any): Promise<ProductoCandy> {
    return this.candyService.crearProducto(payload);
  }

  protected override actualizarData(id: string, payload: any): Promise<ProductoCandy> {
    return this.candyService.actualizarProducto(id, payload);
  }

  protected override mapearFormulario(producto: ProductoCandy): Record<string, any> {
    return {
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      categoria: producto.categoria,
      precio: producto.precio,
      puntajeCompra: producto.puntajeCompra,
      imagen: producto.imagen || '',
      activo: producto.activo,
    };
  }

  protected override onFormularioReset(): void {
    this.editForm.patchValue({
      nombre: '',
      descripcion: '',
      categoria: 'combos',
      precio: 0,
      puntajeCompra: 0,
      imagen: '',
      activo: true,
    });
  }

  seleccionarProducto(producto: ProductoCandy): void {
    this.seleccionarItem(producto);
  }

  onArchivoSeleccionado(event: Event): Promise<void> {
    return this.subirImagenControl(event, 'imagen');
  }
}


