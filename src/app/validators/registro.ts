import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

// Validador personalizado: comprobar que las contraseñas coincidan
export function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (password && confirmPassword && password !== confirmPassword) {
    return { passwordsMismatch: true };
  }
  return null;
}

// Validador personalizado: fecha de nacimiento no futura y válida
export function fechaNacimientoValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null;
  }
  const fecha = new Date(control.value);
  const hoy = new Date();
  if (isNaN(fecha.getTime())) {
    return { fechaInvalida: true };
  }
  if (fecha > hoy) {
    return { fechaFutura: true };
  }
  return null;
}

export const registroValidators = {
  nombre: [
    Validators.required,
    Validators.minLength(2),
    Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/),
  ],
  apellido: [
    Validators.required,
    Validators.minLength(2),
    Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/),
  ],
  email: [
    Validators.required,
    Validators.email,
    Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  ],
  fechaNacimiento: [
    Validators.required,
    fechaNacimientoValidator,
  ],
  tipoSangre: [
    Validators.required,
  ],
  colorOjos: [
    Validators.required,
  ],
  diasVacaciones: [
    Validators.required,
    Validators.min(0),
    Validators.pattern(/^[0-9]+$/),
  ],
  password: [
    Validators.required,
    Validators.minLength(6),
  ],
  confirmPassword: [
    Validators.required,
  ],
  formMatch: passwordsMatchValidator,
};
