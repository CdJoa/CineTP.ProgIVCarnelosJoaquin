import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../servicios/auth';
import { rutaInicioPorRol } from './role-guard';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);

  // Espera a que se restaure la sesión para no rebotar al login al recargar la página
  const usuario = await authService.obtenerUsuario();

  if (usuario) {
    // Si ya está autenticado y trata de ir al login/registro, va a la pantalla de su rol
    if (state.url.startsWith('/login') || state.url.startsWith('/registro')) {
      return router.parseUrl(rutaInicioPorRol(usuario.rol));
    }
    return true;
  }

  // No autenticado: puede ver home, login y registro
  if (state.url === '/home' || state.url.startsWith('/login') || state.url.startsWith('/registro') || state.url === '/') {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
