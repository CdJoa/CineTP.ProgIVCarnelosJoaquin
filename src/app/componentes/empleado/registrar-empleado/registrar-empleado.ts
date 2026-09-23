import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../../servicios/auth';
import { registroValidators } from '../../../validators/registro';

@Component({
  selector: 'app-registrar-empleado',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registrar-empleado.html',
  styleUrl: './registrar-empleado.css',
})
export class RegistrarEmpleado {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private router = inject(Router);

  empleadoForm: FormGroup = this.fb.group(
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

  get nombre() {
    return this.empleadoForm.get('nombre');
  }

  get apellido() {
    return this.empleadoForm.get('apellido');
  }

  get email() {
    return this.empleadoForm.get('email');
  }

  get fechaNacimiento() {
    return this.empleadoForm.get('fechaNacimiento');
  }

  get password() {
    return this.empleadoForm.get('password');
  }

  get confirmPassword() {
    return this.empleadoForm.get('confirmPassword');
  }

  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (this.empleadoForm.invalid) {
      this.empleadoForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    const { nombre, apellido, email, fechaNacimiento, password } = this.empleadoForm.value;

    const resultado = await this.authService.registrarEmpleado({
      nombre,
      apellido,
      email,
      fechaNacimiento,
      password,
    });

    this.cargando.set(false);

    if (resultado.exito) {
      this.mensajeExito.set('¡Empleado registrado con éxito!');
      this.empleadoForm.reset();
      setTimeout(() => {
        this.router.navigate(['/admin']);
      }, 1500);
    } else {
      this.mensajeError.set(resultado.mensaje || 'Error al registrar el empleado.');
    }
  }

  cancelar(): void {
    this.router.navigate(['/admin']);
  }
}
