import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../servicios/auth';
import { loginValidators } from '../../validators/login';
import { rutaInicioPorRol } from '../../guards/role-guard';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loginForm: FormGroup = this.fb.group({
    email: ['', loginValidators.email],
    password: ['', loginValidators.password],
  });

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);

    const { email, password } = this.loginForm.value;
    const resultado = await this.authService.login({ email, password });

    this.cargando.set(false);

    if (resultado.exito) {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (returnUrl?.startsWith('/') && !returnUrl.startsWith('//')) {
        this.router.navigateByUrl(returnUrl);
        return;
      }

      this.router.navigateByUrl(rutaInicioPorRol(resultado.usuario?.rol));
    } else {
      this.mensajeError.set(resultado.mensaje || 'Error al iniciar sesión');
    }
  }
}
