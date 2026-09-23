import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategoriaCandy, ProductoCandy } from '../models/candy';

export const CATEGORIAS_CANDY: { value: CategoriaCandy; label: string }[] = [
  { value: 'pochoclo', label: 'Pochoclos' },
  { value: 'bebida', label: 'Bebidas' },
  { value: 'snacks', label: 'Snacks y Golosinas' },
  { value: 'comida', label: 'Comida Rápida' },
];

export const candyValidators = {
  nombre: [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
  descripcion: [Validators.required, Validators.minLength(5), Validators.maxLength(200)],
  categoria: [Validators.required],
  precio: [Validators.required, Validators.min(0.01)],
  puntajeCompra: [Validators.required, Validators.min(0)],
};

export function crearFormularioCandy(fb: FormBuilder): FormGroup {
  return fb.group({
    nombre: ['', candyValidators.nombre],
    descripcion: ['', candyValidators.descripcion],
    categoria: ['pochoclo' as CategoriaCandy, candyValidators.categoria],
    precio: ['', candyValidators.precio],
    puntajeCompra: [0, candyValidators.puntajeCompra],
    imagen: [''],
    activo: [true],
  });
}

export function generarPreviewCandy(
  val: Record<string, any>,
  baseCandy?: ProductoCandy | null
): ProductoCandy {
  return {
    id: baseCandy?.id || 'preview',
    nombre: val['nombre'] || baseCandy?.nombre || 'Nombre del Producto',
    descripcion: val['descripcion'] || baseCandy?.descripcion || 'Descripción del producto...',
    categoria: val['categoria'] || baseCandy?.categoria || 'pochoclo',
    precio: val['precio'] ? Number(val['precio']) : (baseCandy?.precio || 0),
    puntajeCompra: val['puntajeCompra'] !== undefined && val['puntajeCompra'] !== '' ? Number(val['puntajeCompra']) : (baseCandy?.puntajeCompra || 0),
    imagen: val['imagen'] !== undefined ? val['imagen'] : baseCandy?.imagen,
    activo: val['activo'] !== undefined ? val['activo'] : (baseCandy?.activo ?? true),
  };
}

