import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EstadoFuncion, Formato, Idioma } from '../models/funcion';

export const FORMATOS_FUNCION: Formato[] = ['2D', '3D'];
export const IDIOMAS_FUNCION: Idioma[] = ['español', 'subtitulado', 'doblado'];
export const ESTADOS_FUNCION: EstadoFuncion[] = ['programada', 'cancelada', 'finalizada'];

export const funcionValidators = {
  peliculaId: [Validators.required],
  salaId: [Validators.required],
  fecha: [Validators.required],
  hora: [Validators.required],
  precio: [Validators.required, Validators.min(0.01)],
};

export function crearFormularioFuncion(fb: FormBuilder): FormGroup {
  return fb.group({
    peliculaId: ['', funcionValidators.peliculaId],
    salaId: ['', funcionValidators.salaId],
    fecha: ['', funcionValidators.fecha],
    hora: ['12:00', funcionValidators.hora],
    inicio: [''],
    precio: [5000, funcionValidators.precio],
    formato: ['2D'],
    idioma: ['español'],
    estado: ['programada'],
  });
}
