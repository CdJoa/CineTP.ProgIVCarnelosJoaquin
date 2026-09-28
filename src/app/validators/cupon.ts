import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Cupon } from '../models/cupon';

export function edadMinimaOpcionalValidator(control: AbstractControl): ValidationErrors | null {
  if (control.value === null || control.value === undefined || control.value === '') {
    return null;
  }
  const val = Number(control.value);
  if (isNaN(val) || val < 0 || val > 120) {
    return { edadInvalida: true };
  }
  return null;
}

export const cuponValidators = {
  codigo: [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(20),
    Validators.pattern(/^[a-zA-Z0-9_-]+$/),
  ],
  nombre: [Validators.required, Validators.minLength(3), Validators.maxLength(50)],
  descripcion: [Validators.required, Validators.minLength(5), Validators.maxLength(200)],
  porcentajeDescuento: [
    Validators.required,
    Validators.min(1),
    Validators.max(100),
  ],
  edadMinimaRequerida: [edadMinimaOpcionalValidator],
};

export function crearFormularioCupon(fb: FormBuilder): FormGroup {
  return fb.group({
    codigo: ['', cuponValidators.codigo],
    nombre: ['', cuponValidators.nombre],
    descripcion: ['', cuponValidators.descripcion],
    porcentajeDescuento: [15, cuponValidators.porcentajeDescuento],
    edadMinimaRequerida: [null, cuponValidators.edadMinimaRequerida],
    esPrimeraCompra: [false],
    activo: [true],
  });
}

export function generarPreviewCupon(
  val: Record<string, any>,
  baseCupon?: Cupon | null
): Cupon {
  return {
    id: baseCupon?.id || 'preview',
    codigo: (val['codigo'] || baseCupon?.codigo || 'DESCUENTO15').toUpperCase(),
    nombre: val['nombre'] || baseCupon?.nombre || 'Nombre del Cupón',
    descripcion: val['descripcion'] || baseCupon?.descripcion || 'Descripción del descuento...',
    porcentajeDescuento: val['porcentajeDescuento'] !== undefined
      ? Number(val['porcentajeDescuento'])
      : (baseCupon?.porcentajeDescuento || 15),
    edadMinimaRequerida: val['edadMinimaRequerida'] ? Number(val['edadMinimaRequerida']) : undefined,
    esPrimeraCompra: !!val['esPrimeraCompra'],
    activo: val['activo'] !== undefined ? !!val['activo'] : (baseCupon?.activo ?? true),
  };
}
