import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../servicios/auth';
import { registroValidators } from '../../validators/registro';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private router = inject(Router);

  registroForm: FormGroup = this.fb.group(
    {
      nombre: ['', registroValidators.nombre],
      apellido: ['', registroValidators.apellido],
      email: ['', registroValidators.email],
      fechaNacimiento: ['', registroValidators.fechaNacimiento],
      password: ['', registroValidators.password],
      confirmPassword: ['', registroValidators.confirmPassword],
    },
    { validators: registroValidators.formMatch }
  );

  // Getters para acceso a los controles y validadores desde el template
  get nombre() {
    return this.registroForm.get('nombre');
  }

  get apellido() {
    return this.registroForm.get('apellido');
  }

  get email() {
    return this.registroForm.get('email');
  }

  get fechaNacimiento() {
    return this.registroForm.get('fechaNacimiento');
  }

  get password() {
    return this.registroForm.get('password');
  }

  get confirmPassword() {
    return this.registroForm.get('confirmPassword');
  }

  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    const { nombre, apellido, email, fechaNacimiento, password } = this.registroForm.value;

    const resultado = await this.authService.registro({
      nombre,
      apellido,
      email,
      fechaNacimiento,
      password,
    });

    this.cargando.set(false);

    if (resultado.exito) {
      this.mensajeExito.set('¡Registro exitoso! Redirigiendo...');
      setTimeout(() => {
        this.router.navigate(['/home']);
      }, 1500);
    } else {
      this.mensajeError.set(resultado.mensaje || 'Error al completar el registro.');
    }
  }
}
