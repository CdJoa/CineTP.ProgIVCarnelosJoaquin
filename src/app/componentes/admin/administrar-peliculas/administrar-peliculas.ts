import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Pelicula, GenerosPelicula } from '../../../models/pelicula';
import { PeliculasService } from '../../../servicios/peliculas';
import { CartaPelicula } from '../../pelicula/carta-pelicula/carta-pelicula';
import { GENEROS_PELICULA, crearFormularioPelicula, generarPreviewPelicula } from '../../../validators/pelicula';
import { AdministrarBase } from '../administrar-base';

@Component({
  selector: 'app-administrar-peliculas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CartaPelicula],
  templateUrl: './administrar-peliculas.html',
  styleUrl: './administrar-peliculas.css',
})
export class AdministrarPeliculas extends AdministrarBase<Pelicula> {
  private peliculasService = inject(PeliculasService);

  readonly generosList = GENEROS_PELICULA;

  // Aliases de Signals para mantener compatibilidad total con el template HTML
  peliculas = this.items;
  peliculaSeleccionada = this.itemSeleccionado;
  peliculaEditando = this.itemEditando;
  subiendoPoster = this.subiendoImagen;

  generosSeleccionados = signal<GenerosPelicula[]>([]);

  editForm: FormGroup = crearFormularioPelicula(this.fb);

  // Getters para el formulario
  get titulo() { return this.editForm.get('titulo'); }
  get sinopsis() { return this.editForm.get('sinopsis'); }
  get duracion() { return this.editForm.get('duracion'); }
  get restriccionEdad() { return this.editForm.get('restriccionEdad'); }
  get puntajeCompra() { return this.editForm.get('puntajeCompra'); }
  get fechaEstreno() { return this.editForm.get('fechaEstreno'); }
  get poster() { return this.editForm.get('poster'); }
  get enCartelera() { return this.editForm.get('enCartelera'); }
  get boletosVendidos() { return this.editForm.get('boletosVendidos'); }

  get peliculaEditandoPreview(): Pelicula | null {
    if (!this.modoModal()) return null;
    return generarPreviewPelicula(this.editForm.value, this.generosSeleccionados(), this.peliculaEditando() || undefined);
  }

  protected override cargarData(): Promise<Pelicula[]> {
    return this.peliculasService.obtenerPeliculas();
  }

  protected override crearData(payload: any): Promise<Pelicula> {
    return this.peliculasService.crearPelicula(payload);
  }

  protected override actualizarData(id: string, payload: any): Promise<Pelicula> {
    return this.peliculasService.actualizarPelicula(id, payload);
  }

  protected override mapearFormulario(pelicula: Pelicula): Record<string, any> {
    return {
      titulo: pelicula.titulo,
      sinopsis: pelicula.sinopsis,
      duracion: pelicula.duracion,
      restriccionEdad: pelicula.restriccionEdad,
      puntajeCompra: pelicula.puntajeCompra,
      fechaEstreno: pelicula.fechaEstreno,
      poster: pelicula.poster || '',
      enCartelera: pelicula.enCartelera ?? true,
      boletosVendidos: pelicula.boletosVendidos || 0,
    };
  }

  protected override onFormularioReset(): void {
    this.generosSeleccionados.set([]);
    this.editForm.patchValue({
      titulo: '',
      sinopsis: '',
      duracion: 120,
      restriccionEdad: 13,
      puntajeCompra: 100,
      fechaEstreno: new Date().toISOString().split('T')[0],
      poster: '',
      enCartelera: true,
      boletosVendidos: 0,
    });
  }

  protected override onFormularioCargado(pelicula: Pelicula): void {
    this.generosSeleccionados.set([...(pelicula.generos || [])]);
  }

  protected override esValidoFormulario(): boolean {
    const esValido = this.editForm.valid && this.generosSeleccionados().length > 0;
    if (this.generosSeleccionados().length === 0) {
      this.mensajeError.set('Debe seleccionar al menos un género.');
    }
    return esValido;
  }

  protected override obtenerPayload(): any {
    return {
      ...this.editForm.value,
      generos: this.generosSeleccionados(),
    };
  }

  toggleGenero(genero: GenerosPelicula): void {
    const actual = this.generosSeleccionados();
    if (actual.includes(genero)) {
      this.generosSeleccionados.set(actual.filter(g => g !== genero));
    } else {
      this.generosSeleccionados.set([...actual, genero]);
    }
  }

  estaSeleccionado(genero: GenerosPelicula): boolean {
    return this.generosSeleccionados().includes(genero);
  }

  onArchivoPosterSeleccionado(event: Event): Promise<void> {
    return this.subirImagenControl(event, 'poster');
  }
}


