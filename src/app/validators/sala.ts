import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FilaSala, FormatoSala, Sala } from '../models/sala';

export const salaValidators = {
  nombre: [Validators.required, Validators.minLength(3), Validators.maxLength(50)],
  formato: [Validators.required],
};

export function crearFormularioSala(fb: FormBuilder): FormGroup {
  return fb.group({
    nombre: ['', salaValidators.nombre],
    formato: ['2D' as FormatoSala, salaValidators.formato],
    activa: [true],
  });
}

export function generarPreviewSala(
  val: Record<string, any>,
  filas: FilaSala[],
  baseSala?: Sala | null
): Sala {
  const capacidadTotal = filas.reduce((sum, f) => sum + f.totalAsientos, 0);
  return {
    id: baseSala?.id || 'preview',
    nombre: val['nombre'] || baseSala?.nombre || 'Nombre de la Sala',
    formato: val['formato'] || baseSala?.formato || '2D',
    filas,
    capacidadTotal,
    activa: val['activa'] !== undefined ? val['activa'] : (baseSala?.activa ?? true),
  };
}
