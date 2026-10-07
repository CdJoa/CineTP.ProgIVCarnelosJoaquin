import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../servicios/auth';
import { RolUsuario } from '../models/usuario';

/**
 * Pantalla de inicio que le corresponde a cada rol.
 */
export function rutaInicioPorRol(rol?: RolUsuario): string {
  if (rol === 'admin') return '/admin';
  if (rol === 'empleado') return '/empleado/validar';
  return '/home';
}

export const roleGuard: CanActivateFn = async (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);

  // Espera a que se restaure la sesión para no rebotar al login al recargar la página
  const usuario = await authService.obtenerUsuario();
  const rolesPermitidos: string[] = route.data?.['roles'] ?? [];

  if (!usuario) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (rolesPermitidos.length === 0 || rolesPermitidos.includes(usuario.rol)) {
    return true;
  }

  // Sin permiso para esta ruta: se lo envía a la pantalla de su rol
  return router.parseUrl(rutaInicioPorRol(usuario.rol));
};
