import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../servicios/auth';
import { RolesAdminService } from '../servicios/roles-admin';

export const adminAccessGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(Auth);
  const roles = inject(RolesAdminService);
  const router = inject(Router);
  const usuario = await auth.obtenerUsuario();
  if (!usuario) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  if (usuario.rol === 'admin') return true;
  const permitted = await roles.puedeAcceder();
  if (permitted) return true;
  return router.parseUrl(usuario.rol === 'empleado' ? '/empleado/validar' : '/home');
};

export const adminSectionGuard: CanActivateFn = async (route, state) => {
  const auth = inject(Auth);
  const roles = inject(RolesAdminService);
  const router = inject(Router);
  const usuario = await auth.obtenerUsuario();
  if (!usuario) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (usuario.rol === 'admin') return true;

  if (route.data?.['adminOnly']) {
    return router.parseUrl(await roles.obtenerPrimeraRuta());
  }

  const section = route.data?.['adminSection'] as string | undefined;
  if (section && await roles.puedeAcceder(section)) return true;
  return router.parseUrl(await roles.obtenerPrimeraRuta());
};
