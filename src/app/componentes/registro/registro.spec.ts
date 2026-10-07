import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Registro } from './registro';

describe('Registro', () => {
  let component: Registro;
  let fixture: ComponentFixture<Registro>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Registro],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Registro);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('debe inicializar el formulario con los campos requeridos', () => {
    expect(component.registroForm.contains('nombre')).toBe(true);
    expect(component.registroForm.contains('apellido')).toBe(true);
    expect(component.registroForm.contains('email')).toBe(true);
    expect(component.registroForm.contains('fechaNacimiento')).toBe(true);
    expect(component.registroForm.contains('tipoSangre')).toBe(true);
    expect(component.registroForm.contains('colorOjos')).toBe(true);
    expect(component.registroForm.contains('diasVacaciones')).toBe(true);
    expect(component.registroForm.contains('password')).toBe(true);
    expect(component.registroForm.contains('confirmPassword')).toBe(true);
  });

  it('debe marcar inválido el formulario si faltan los nuevos campos', () => {
    component.registroForm.patchValue({
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@test.com',
      fechaNacimiento: '1990-01-01',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(component.registroForm.valid).toBe(false);
    expect(component.tipoSangre?.valid).toBe(false);
    expect(component.colorOjos?.valid).toBe(false);
    expect(component.diasVacaciones?.valid).toBe(false);
  });

  it('debe validar cuando todos los campos incluyendo tipoSangre, colorOjos y diasVacaciones son válidos', () => {
    component.registroForm.patchValue({
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@test.com',
      fechaNacimiento: '1990-01-01',
      tipoSangre: 'O+',
      colorOjos: 'Marrón',
      diasVacaciones: 15,
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(component.registroForm.valid).toBe(true);
  });

  it('debe invalidar fechas de nacimiento anteriores a 1900 con fechaMinima', () => {
    component.registroForm.get('fechaNacimiento')?.setValue('1899-12-31');
    expect(component.fechaNacimiento?.errors?.['fechaMinima']).toBe(true);
  });

  it('debe invalidar fechas de nacimiento futuras con fechaFutura', () => {
    component.registroForm.get('fechaNacimiento')?.setValue('2099-01-01');
    expect(component.fechaNacimiento?.errors?.['fechaFutura']).toBe(true);
  });
});
