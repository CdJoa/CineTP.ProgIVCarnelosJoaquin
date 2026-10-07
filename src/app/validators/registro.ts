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

// Validador personalizado: fecha de nacimiento no futura, a partir de 1900 y válida
export function fechaNacimientoValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null;
  }

  const str = String(control.value).trim();
  const partes = str.split('-');
  if (partes.length !== 3) {
    return { fechaInvalida: true };
  }

  const anio = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);

  if (!anio || !mes || !dia || isNaN(anio) || isNaN(mes) || isNaN(dia)) {
    return { fechaInvalida: true };
  }

  // El año debe ser 1900 para arriba
  if (anio < 1900) {
    return { fechaMinima: true };
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return { fechaInvalida: true };
  }

  // Verificar que sea una fecha real de calendario (evita ej. 31/02)
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return { fechaInvalida: true };
  }

  // La fecha no puede ser posterior a la actual
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
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
