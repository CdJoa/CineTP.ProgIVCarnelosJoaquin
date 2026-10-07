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

  diaNacimiento = '';
  mesNacimiento = '';
  anioNacimiento = '';

  constructor() {
    this.empleadoForm.get('fechaNacimiento')?.valueChanges.subscribe((val) => {
      if (val && typeof val === 'string' && val.includes('-')) {
        const partes = val.split('-');
        if (partes.length === 3) {
          this.anioNacimiento = partes[0];
          this.mesNacimiento = partes[1];
          this.diaNacimiento = partes[2];
        }
      } else if (!val) {
        this.diaNacimiento = '';
        this.mesNacimiento = '';
        this.anioNacimiento = '';
      }
    });
  }

  onDiaChange(event: Event, nextInput: HTMLInputElement): void {
    const input = event.target as HTMLInputElement;
    this.diaNacimiento = input.value.replace(/\D/g, '').slice(0, 2);
    input.value = this.diaNacimiento;
    if (this.diaNacimiento.length === 2) {
      nextInput.focus();
    }
    this.sincronizarFechaNacimiento();
  }

  onMesChange(event: Event, nextInput: HTMLInputElement): void {
    const input = event.target as HTMLInputElement;
    this.mesNacimiento = input.value.replace(/\D/g, '').slice(0, 2);
    input.value = this.mesNacimiento;
    if (this.mesNacimiento.length === 2) {
      nextInput.focus();
    }
    this.sincronizarFechaNacimiento();
  }

  onBackspaceMes(prevInput: HTMLInputElement): void {
    if (!this.mesNacimiento) {
      prevInput.focus();
    }
  }

  onAnioChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.anioNacimiento = input.value.replace(/\D/g, '').slice(0, 4);
    input.value = this.anioNacimiento;
    this.sincronizarFechaNacimiento();
  }

  onBackspaceAnio(prevInput: HTMLInputElement): void {
    if (!this.anioNacimiento) {
      prevInput.focus();
    }
  }

  onFechaBlur(): void {
    this.fechaNacimiento?.markAsTouched();
  }

  private sincronizarFechaNacimiento(): void {
    if (!this.diaNacimiento && !this.mesNacimiento && !this.anioNacimiento) {
      this.fechaNacimiento?.setValue('');
    } else if (this.diaNacimiento && this.mesNacimiento && this.anioNacimiento && this.anioNacimiento.length === 4) {
      const d = this.diaNacimiento.padStart(2, '0');
      const m = this.mesNacimiento.padStart(2, '0');
      const y = this.anioNacimiento;
      this.fechaNacimiento?.setValue(`${y}-${m}-${d}`);
    } else {
      this.fechaNacimiento?.setValue('invalida');
    }
    this.fechaNacimiento?.markAsDirty();
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
