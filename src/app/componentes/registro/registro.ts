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
      tipoSangre: ['', registroValidators.tipoSangre],
      colorOjos: ['', registroValidators.colorOjos],
      diasVacaciones: ['', registroValidators.diasVacaciones],
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

  get tipoSangre() {
    return this.registroForm.get('tipoSangre');
  }

  get colorOjos() {
    return this.registroForm.get('colorOjos');
  }

  get diasVacaciones() {
    return this.registroForm.get('diasVacaciones');
  }

  get password() {
    return this.registroForm.get('password');
  }

  get confirmPassword() {
    return this.registroForm.get('confirmPassword');
  }

  diaNacimiento = '';
  mesNacimiento = '';
  anioNacimiento = '';

  constructor() {
    this.registroForm.get('fechaNacimiento')?.valueChanges.subscribe((val) => {
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
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    const {
      nombre,
      apellido,
      email,
      fechaNacimiento,
      tipoSangre,
      colorOjos,
      diasVacaciones,
      password,
    } = this.registroForm.value;

    const resultado = await this.authService.registro({
      nombre,
      apellido,
      email,
      fechaNacimiento,
      tipoSangre,
      colorOjos,
      diasVacaciones: Number(diasVacaciones),
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
