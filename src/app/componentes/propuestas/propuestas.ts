import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../servicios/auth';
import { PropuestasService } from '../../servicios/propuestas';
import { PropuestaPelicula } from '../../models/propuesta';

@Component({
  selector: 'app-propuestas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './propuestas.html',
  styleUrl: './propuestas.css',
})
export class PropuestasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private propuestasService = inject(PropuestasService);

  propuestaForm: FormGroup = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(600)]],
    explicacion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(600)]],
  });

  cargando = signal<boolean>(true);
  enviando = signal<boolean>(false);
  cancelando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  propuestaActiva = signal<PropuestaPelicula | null>(null);
  mostrarFormularioNueva = signal<boolean>(false);

  // Getters para el formulario
  get titulo() { return this.propuestaForm.get('titulo'); }
  get descripcion() { return this.propuestaForm.get('descripcion'); }
  get explicacion() { return this.propuestaForm.get('explicacion'); }

  async ngOnInit(): Promise<void> {
    await this.cargarPropuestaDelCliente();
  }

  async cargarPropuestaDelCliente(): Promise<void> {
    this.cargando.set(true);
    this.mensajeError.set(null);
    try {
      const usuario = await this.authService.obtenerUsuario();
      if (!usuario) {
        this.mensajeError.set('Debes iniciar sesión para enviar propuestas.');
        return;
      }

      // Buscar si tiene propuesta activa (pendiente o última enviada)
      const activa = await this.propuestasService.obtenerPropuestaActiva(usuario.id);
      if (activa) {
        this.propuestaActiva.set(activa);
        this.mostrarFormularioNueva.set(false);
      } else {
        // Consultar la última que haya hecho (por si está aceptada o rechazada)
        const ultima = await this.propuestasService.obtenerUltimaPropuestaUsuario(usuario.id);
        this.propuestaActiva.set(ultima);
        this.mostrarFormularioNueva.set(!ultima || ultima.estado !== 'pendiente');
      }
    } catch (err: any) {
      this.mensajeError.set(err?.message || 'Error al cargar tu estado de propuestas.');
    } finally {
      this.cargando.set(false);
    }
  }

  habilitarNuevaPropuesta(): void {
    this.propuestaActiva.set(null);
    this.mostrarFormularioNueva.set(true);
    this.propuestaForm.reset();
  }

  async onSubmit(): Promise<void> {
    if (this.propuestaForm.invalid) {
      this.propuestaForm.markAllAsTouched();
      return;
    }

    const usuario = this.authService.usuarioActual();
    if (!usuario) {
      this.mensajeError.set('Tu sesión expiró. Por favor ingresa nuevamente.');
      return;
    }

    this.enviando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    try {
      const nuevaPropuesta = await this.propuestasService.crearPropuesta(
        {
          titulo: this.titulo?.value,
          descripcion: this.descripcion?.value,
          explicacion: this.explicacion?.value,
        },
        usuario
      );

      this.mensajeExito.set('¡Tu propuesta fue enviada con éxito! La administración la revisará a la brevedad.');
      this.propuestaActiva.set(nuevaPropuesta);
      this.mostrarFormularioNueva.set(false);
      this.propuestaForm.reset();
    } catch (err: any) {
      this.mensajeError.set(err?.message || 'Error al enviar la propuesta.');
    } finally {
      this.enviando.set(false);
    }
  }

  async cancelarPropuestaActual(): Promise<void> {
    const prop = this.propuestaActiva();
    if (!prop || prop.estado !== 'pendiente') return;

    if (!confirm('¿Seguro que deseas cancelar esta propuesta? Podrás redactar una nueva a continuación.')) {
      return;
    }

    this.cancelando.set(true);
    this.mensajeError.set(null);
    try {
      await this.propuestasService.cancelarPropuesta(prop.id);
      this.propuestaActiva.set(null);
      this.mostrarFormularioNueva.set(true);
      this.propuestaForm.reset();
      this.mensajeExito.set('Propuesta cancelada. Ahora puedes enviar una nueva.');
    } catch (err: any) {
      this.mensajeError.set(err?.message || 'Error al cancelar la propuesta.');
    } finally {
      this.cancelando.set(false);
    }
  }
}
