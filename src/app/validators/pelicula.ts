import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GenerosPelicula, Pelicula } from '../models/pelicula';

export const GENEROS_PELICULA = [
  { value: 'accion', label: 'Acción' },
  { value: 'comedia', label: 'Comedia' },
  { value: 'drama', label: 'Drama' },
  { value: 'terror', label: 'Terror' },
  { value: 'romance', label: 'Romance' },
  { value: 'animacion', label: 'Animación' },
  { value: 'ciencia_ficcion', label: 'Ciencia Ficción' },
  { value: 'documental', label: 'Documental' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'aventura', label: 'Aventura' },
  { value: 'fantasia', label: 'Fantasía' },
  { value: 'musical', label: 'Musical' },
];

export const peliculaValidators = {
  titulo: [Validators.required, Validators.minLength(2)],
  sinopsis: [Validators.required, Validators.minLength(10)],
  duracion: [Validators.required, Validators.min(1), Validators.max(600)],
  generos: [Validators.required],
  restriccionEdad: [Validators.required, Validators.min(0), Validators.max(18)],
  puntajeCompra: [Validators.required, Validators.min(0)],
  precioNormal: [Validators.required, Validators.min(0.01)],
  fechaEstreno: [Validators.required],
};

export function crearFormularioPelicula(fb: FormBuilder): FormGroup {
  return fb.group({
    titulo: ['', peliculaValidators.titulo],
    sinopsis: ['', peliculaValidators.sinopsis],
    duracion: ['', peliculaValidators.duracion],
    restriccionEdad: [0, peliculaValidators.restriccionEdad],
    puntajeCompra: [0, peliculaValidators.puntajeCompra],
    precioNormal: ['', peliculaValidators.precioNormal],
    fechaEstreno: ['', peliculaValidators.fechaEstreno],
    esPreventa: [false],
    precioPreventa: [''],
    poster: [''],
  });
}

export function generarPreviewPelicula(
  val: Record<string, any>,
  generos: GenerosPelicula[],
  basePelicula?: Pelicula | null
): Pelicula {
  return {
    id: basePelicula?.id || 'preview',
    titulo: val['titulo'] || basePelicula?.titulo || 'Título de la película',
    sinopsis: val['sinopsis'] || basePelicula?.sinopsis || 'Sinopsis...',
    duracion: val['duracion'] ? Number(val['duracion']) : (basePelicula?.duracion || 0),
    generos: generos,
    restriccionEdad: val['restriccionEdad'] !== undefined && val['restriccionEdad'] !== '' ? Number(val['restriccionEdad']) : (basePelicula?.restriccionEdad || 0),
    puntajeCompra: val['puntajeCompra'] !== undefined && val['puntajeCompra'] !== '' ? Number(val['puntajeCompra']) : (basePelicula?.puntajeCompra || 0),
    poster: val['poster'] !== undefined ? val['poster'] : basePelicula?.poster,
    esPreventa: val['esPreventa'] !== undefined ? val['esPreventa'] : (basePelicula?.esPreventa || false),
    precioPreventa: val['precioPreventa'] ? Number(val['precioPreventa']) : basePelicula?.precioPreventa,
    precioNormal: val['precioNormal'] !== undefined && val['precioNormal'] !== '' ? Number(val['precioNormal']) : (basePelicula?.precioNormal || 0),
    fechaEstreno: val['fechaEstreno'] || basePelicula?.fechaEstreno || 'YYYY-MM-DD',
    activa: basePelicula?.activa ?? true,
  };
}

