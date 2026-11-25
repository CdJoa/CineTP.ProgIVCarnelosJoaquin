import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Pelicula, GenerosPelicula } from '../../../models/pelicula';
import { PeliculasService } from '../../../servicios/peliculas';
import { CartaPelicula } from '../../pelicula/carta-pelicula/carta-pelicula';
import { GENEROS_PELICULA, crearFormularioPelicula, generarPreviewPelicula } from '../../../validators/pelicula';
import { AdministrarBase } from '../administrar-base';
import { SelectorFecha } from '../../compartidos/selector-fecha/selector-fecha';
import { SalaService } from '../../../servicios/sala';
import {
  PREVENTA_PORCENTAJE_MAX,
  PREVENTA_PORCENTAJE_MIN,
  aplicarPorcentaje,
  describirPorcentaje,
  fechaLocalIso,
  formatearFechaCorta,
} from '../../../utils/preventa';

@Component({
  selector: 'app-administrar-peliculas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CartaPelicula, SelectorFecha],
  templateUrl: './administrar-peliculas.html',
  styleUrl: './administrar-peliculas.css',
})
export class AdministrarPeliculas extends AdministrarBase<Pelicula> implements OnInit {
  private peliculasService = inject(PeliculasService);
  private route = inject(ActivatedRoute);

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
  get preventaActiva() { return this.editForm.get('preventaActiva'); }
  get preventaPorcentaje() { return this.editForm.get('preventaPorcentaje'); }

  private salaService = inject(SalaService);
  readonly preventaMin = PREVENTA_PORCENTAJE_MIN;
  readonly preventaMax = PREVENTA_PORCENTAJE_MAX;
  readonly marcasPreventa = [-50, -25, 0, 25, 50];

  /** Precio de referencia (tarifa base de salas) para mostrar un ejemplo del ajuste. */
  get precioEjemplo(): number {
    return this.salaService.configuracionPrecios().precioBaseReferencia || 5000;
  }

  get textoPorcentajePreventa(): string {
    return describirPorcentaje(Number(this.preventaPorcentaje?.value || 0));
  }

  get precioEjemploPreventa(): number {
    return aplicarPorcentaje(this.precioEjemplo, Number(this.preventaPorcentaje?.value || 0));
  }

  /** Fecha de estreno en DD/MM/AAAA (o vacío si todavía no es válida). */
  get estrenoLegible(): string {
    const valor = String(this.fechaEstreno?.value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? formatearFechaCorta(valor) : '';
  }

  get errorEstreno(): string | null {
    const tocado = this.fechaEstreno?.touched || this.fechaEstreno?.dirty;
    if (this.fechaEstreno?.errors && tocado) {
      if (this.fechaEstreno.errors['required']) return 'La fecha de estreno es obligatoria.';
      return 'La fecha no es válida.';
    }
    if (this.editForm.errors?.['preventaEstrenoPasado']) {
      return 'Para usar preventa, el estreno tiene que ser una fecha futura.';
    }
    return null;
  }

  marcarPorcentaje(valor: number): void {
    this.preventaPorcentaje?.setValue(valor);
  }

  get peliculaEditandoPreview(): Pelicula | null {
    if (!this.modoModal()) return null;
    return generarPreviewPelicula(this.editForm.value, this.generosSeleccionados(), this.peliculaEditando() || undefined);
  }

  override async ngOnInit(): Promise<void> {
    await super.ngOnInit();

    // Si viene derivado desde una propuesta aceptada
    const queryParams = this.route.snapshot.queryParams;
    if (queryParams['titulo']) {
      this.abrirCreacion();
      this.editForm.patchValue({
        titulo: queryParams['titulo'] || '',
        sinopsis: queryParams['sinopsis'] || '',
      });
      this.mensajeExito.set(
        `¡Propuesta aceptada! Datos de "${queryParams['titulo']}" precargados. Completa la duración, géneros y poster para publicarla.`
      );
    }
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
      preventaActiva: Boolean(pelicula.preventaActiva),
      preventaPorcentaje: Number(pelicula.preventaPorcentaje || 0),
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
      fechaEstreno: fechaLocalIso(),
      poster: '',
      enCartelera: true,
      boletosVendidos: 0,
      preventaActiva: false,
      preventaPorcentaje: 0,
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


