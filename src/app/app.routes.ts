import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';
import { adminAccessGuard, adminSectionGuard } from './guards/admin-access-guard';

export const routes: Routes = [
  // Redirección inicial
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // --- Autenticación ---
  {
    path: 'login',
    loadComponent: () => import('./componentes/login/login').then((m) => m.Login),
    canActivate: [authGuard],
  },
  {
    path: 'registro',
    loadComponent: () => import('./componentes/registro/registro').then((m) => m.Registro),
    canActivate: [authGuard],
  },
  { path: 'register', redirectTo: 'registro', pathMatch: 'full' },

  // --- Cartelera y Navegación Principal ---
  {
    path: 'home',
    loadComponent: () => import('./componentes/home/home').then((m) => m.Home),
  },

  // --- Perfil y Clientes ---
  {
    path: 'perfil',
    loadComponent: () => import('./componentes/perfil/perfil').then((m) => m.PerfilComponent),
    canActivate: [authGuard],
  },
  { path: 'mis-peliculas', redirectTo: 'perfil', pathMatch: 'full' },
  {
    path: 'propuestas',
    loadComponent: () =>
      import('./componentes/propuestas/propuestas').then((m) => m.PropuestasComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['cliente'] },
  },
  { path: 'proponer-pelicula', redirectTo: 'propuestas', pathMatch: 'full' },

  // --- Flujo de Compra (Sala -> Candy -> Pago) ---
  {
    path: 'sala',
    loadComponent: () =>
      import('./componentes/sala/mapa-sala/mapa-sala').then((m) => m.MapaSalaComponent),
  },
  {
    path: 'candy',
    loadComponent: () =>
      import('./componentes/candy/seleccion-candy/seleccion-candy').then(
        (m) => m.SeleccionCandyComponent
      ),
  },
  {
    path: 'pago',
    loadComponent: () => import('./componentes/pago/pago').then((m) => m.PagoComponent),
  },

  // --- Empleados / Personal ---
  {
    path: 'empleado/validar',
    // Carga diferida: el lector de cámara QR solo se descarga para el personal
    loadComponent: () =>
      import('./componentes/empleado/validar-entrada/validar-entrada').then((m) => m.ValidarEntrada),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['empleado', 'admin'] },
  },

  // --- Panel de Administración ---
  {
    path: 'admin',
    loadComponent: () => import('./componentes/admin/admin').then((m) => m.Admin),
    canActivate: [adminAccessGuard],
    canActivateChild: [adminSectionGuard],
    children: [
      { path: '', redirectTo: 'peliculas', pathMatch: 'full' },
      {
        path: 'peliculas',
        loadComponent: () =>
          import('./componentes/admin/administrar-peliculas/administrar-peliculas').then(
            (m) => m.AdministrarPeliculas
          ),
        data: { adminSection: 'peliculas' },
      },
      { path: 'peliculas/nueva', redirectTo: 'peliculas', pathMatch: 'full', data: { adminSection: 'peliculas' } },
      {
        path: 'propuestas',
        loadComponent: () =>
          import('./componentes/admin/administrar-propuestas/administrar-propuestas').then(
            (m) => m.AdministrarPropuestasComponent
          ),
        data: { adminSection: 'propuestas' },
      },
      {
        path: 'funciones',
        loadComponent: () =>
          import('./componentes/admin/administrar-funciones/administrar-funciones').then(
            (m) => m.AdministrarFunciones
          ),
        data: { adminSection: 'funciones' },
      },
      { path: 'funciones/nueva', redirectTo: 'funciones', pathMatch: 'full', data: { adminSection: 'funciones' } },
      {
        path: 'candy',
        loadComponent: () =>
          import('./componentes/admin/administrar-candy/administrar-candy').then(
            (m) => m.AdministrarCandy
          ),
        data: { adminSection: 'candy' },
      },
      { path: 'candy/nuevo', redirectTo: 'candy', pathMatch: 'full', data: { adminSection: 'candy' } },
      {
        path: 'salas',
        loadComponent: () =>
          import('./componentes/admin/administrar-salas/administrar-salas').then(
            (m) => m.AdministrarSalas
          ),
        data: { adminSection: 'salas' },
      },
      { path: 'salas/nueva', redirectTo: 'salas', pathMatch: 'full', data: { adminSection: 'salas' } },
      {
        path: 'cupones',
        loadComponent: () =>
          import('./componentes/admin/administrar-cupones/administrar-cupones').then(
            (m) => m.AdministrarCuponesComponent
          ),
        data: { adminSection: 'cupones' },
      },
      { path: 'cupones/nuevo', redirectTo: 'cupones', pathMatch: 'full', data: { adminSection: 'cupones' } },
      {
        path: 'empleados/nuevo',
        loadComponent: () =>
          import('./componentes/empleado/registrar-empleado/registrar-empleado').then(
            (m) => m.RegistrarEmpleado
          ),
        data: { adminSection: 'empleados' },
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./componentes/admin/auditoria/auditoria').then((m) => m.Auditoria),
        data: { adminSection: 'auditoria' },
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./componentes/admin/administrar-roles/administrar-roles').then(
            (m) => m.AdministrarRolesComponent
          ),
        data: { adminOnly: true },
      },
      {
        path: 'facturacion',
        // Carga diferida: exportación pesada jsPDF y XLSX
        loadComponent: () =>
          import('./componentes/admin/reporte-facturacion/reporte-facturacion').then(
            (m) => m.ReporteFacturacionComponent
          ),
        data: { adminSection: 'facturacion' },
      },
      {
        path: 'graficos',
        loadComponent: () =>
          import('./componentes/admin/graficos-ventas/graficos-ventas').then(
            (m) => m.GraficosVentasComponent
          ),
        data: { adminSection: 'graficos' },
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
