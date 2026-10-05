import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../servicios/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);

  const usuario = authService.usuarioActual();

  if (usuario) {
    // Si ya está autenticado y trata de ir al login/registro, redirigir a home
    if (state.url === '/login' || state.url === '/registro') {
      router.navigate(['/home']);
      return false;
    }
    return true;
  }

  // No autenticado: puede ver home, login y registro
  if (state.url === '/home' || state.url === '/login' || state.url === '/registro' || state.url === '/') {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
