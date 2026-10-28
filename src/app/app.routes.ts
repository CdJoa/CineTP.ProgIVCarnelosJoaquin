import { Routes } from '@angular/router';
import { Login } from './componentes/login/login';
import { Registro } from './componentes/registro/registro';
import { Home } from './componentes/home/home';
import { Admin } from './componentes/admin/admin';
import { Dashboard } from './componentes/admin/dashboard/dashboard';
import { AdministrarPeliculas } from './componentes/admin/administrar-peliculas/administrar-peliculas';
import { RegistrarEmpleado } from './componentes/empleado/registrar-empleado/registrar-empleado';
import { AdministrarCandy } from './componentes/admin/administrar-candy/administrar-candy';
import { AdministrarSalas } from './componentes/admin/administrar-salas/administrar-salas';
import { AdministrarFunciones } from './componentes/admin/administrar-funciones/administrar-funciones';
import { MapaSalaComponent } from './componentes/sala/mapa-sala/mapa-sala';
import { SeleccionCandyComponent } from './componentes/candy/seleccion-candy/seleccion-candy';
import { AdministrarCuponesComponent } from './componentes/admin/administrar-cupones/administrar-cupones';
import { PerfilComponent } from './componentes/perfil/perfil';
import { PagoComponent } from './componentes/pago/pago';
import { Auditoria } from './componentes/admin/auditoria/auditoria';
import { GraficosVentasComponent } from './componentes/admin/graficos-ventas/graficos-ventas';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';
import { adminAccessGuard, adminSectionGuard } from './guards/admin-access-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'login', component: Login, canActivate: [authGuard] },
  { path: 'registro', component: Registro, canActivate: [authGuard] },
  { path: 'register', redirectTo: 'registro', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'perfil', component: PerfilComponent, canActivate: [authGuard] },
  { path: 'mis-peliculas', component: PerfilComponent, canActivate: [authGuard] },
  {
    path: 'propuestas',
    loadComponent: () =>
      import('./componentes/propuestas/propuestas').then(
        (m) => m.PropuestasComponent
      ),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['cliente'] },
  },
  { path: 'proponer-pelicula', redirectTo: 'propuestas', pathMatch: 'full' },
  { path: 'sala', component: MapaSalaComponent },
  { path: 'candy', component: SeleccionCandyComponent },
  { path: 'pago', component: PagoComponent },
  {
    path: 'empleado/validar',
    // Carga diferida: el lector de QR solo se descarga para el personal
    loadComponent: () =>
      import('./componentes/empleado/validar-entrada/validar-entrada').then((m) => m.ValidarEntrada),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['empleado', 'admin'] },
  },
  {
    path: 'admin',
    component: Admin,
    canActivate: [adminAccessGuard],
    canActivateChild: [adminSectionGuard],
    children: [
      { path: '', redirectTo: 'peliculas', pathMatch: 'full' },
      { path: 'peliculas', component: AdministrarPeliculas, data: { adminSection: 'peliculas' } },
      { path: 'peliculas/nueva', redirectTo: 'peliculas', pathMatch: 'full', data: { adminSection: 'peliculas' } },
      {
        path: 'propuestas',
        loadComponent: () =>
          import('./componentes/admin/administrar-propuestas/administrar-propuestas').then(
            (m) => m.AdministrarPropuestasComponent
          ),
        data: { adminSection: 'propuestas' },
      },
      { path: 'funciones', component: AdministrarFunciones, data: { adminSection: 'funciones' } },
      { path: 'funciones/nueva', redirectTo: 'funciones', pathMatch: 'full', data: { adminSection: 'funciones' } },
      { path: 'candy', component: AdministrarCandy, data: { adminSection: 'candy' } },
      { path: 'candy/nuevo', redirectTo: 'candy', pathMatch: 'full', data: { adminSection: 'candy' } },
      { path: 'salas', component: AdministrarSalas, data: { adminSection: 'salas' } },
      { path: 'salas/nueva', redirectTo: 'salas', pathMatch: 'full', data: { adminSection: 'salas' } },
      { path: 'cupones', component: AdministrarCuponesComponent, data: { adminSection: 'cupones' } },
      { path: 'cupones/nuevo', redirectTo: 'cupones', pathMatch: 'full', data: { adminSection: 'cupones' } },
      { path: 'empleados/nuevo', component: RegistrarEmpleado, data: { adminSection: 'empleados' } },
      { path: 'auditoria', component: Auditoria, data: { adminSection: 'auditoria' } },
      {
        path: 'roles',
        loadComponent: () => import('./componentes/admin/administrar-roles/administrar-roles').then((m) => m.AdministrarRolesComponent),
        data: { adminOnly: true },
      },
      {
        path: 'facturacion',
        //lazy loading):jsPDF y XLSX
        loadComponent: () =>
          import('./componentes/admin/reporte-facturacion/reporte-facturacion').then(
            (m) => m.ReporteFacturacionComponent
          ),
        data: { adminSection: 'facturacion' },
      },
      { path: 'graficos', component: GraficosVentasComponent, data: { adminSection: 'graficos' } },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
