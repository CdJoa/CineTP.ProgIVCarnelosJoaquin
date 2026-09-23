import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../servicios/auth';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);

  const usuario = authService.usuarioActual();
  const rolesPermitidos: string[] = route.data?.['roles'] ?? [];

  if (!usuario) {
    router.navigate(['/login']);
    return false;
  }

  if (rolesPermitidos.length === 0 || rolesPermitidos.includes(usuario.rol)) {
    return true;
  }

  router.navigate(['/home']);
  return false;
};
