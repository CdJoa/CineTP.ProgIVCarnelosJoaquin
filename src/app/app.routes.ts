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
import { AdministrarCuponesComponent } from './componentes/admin/administrar-cupones/administrar-cupones';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'login', component: Login, canActivate: [authGuard] },
  { path: 'registro', component: Registro, canActivate: [authGuard] },
  { path: 'register', redirectTo: 'registro', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'sala', component: MapaSalaComponent, canActivate: [authGuard] },
  {
    path: 'admin',
    component: Admin,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    children: [
      { path: '', redirectTo: 'peliculas', pathMatch: 'full' },
      { path: 'peliculas', component: AdministrarPeliculas },
      { path: 'peliculas/nueva', redirectTo: 'peliculas', pathMatch: 'full' },
      { path: 'funciones', component: AdministrarFunciones },
      { path: 'funciones/nueva', redirectTo: 'funciones', pathMatch: 'full' },
      { path: 'candy', component: AdministrarCandy },
      { path: 'candy/nuevo', redirectTo: 'candy', pathMatch: 'full' },
      { path: 'salas', component: AdministrarSalas },
      { path: 'salas/nueva', redirectTo: 'salas', pathMatch: 'full' },
      { path: 'cupones', component: AdministrarCuponesComponent },
      { path: 'cupones/nuevo', redirectTo: 'cupones', pathMatch: 'full' },
      { path: 'empleados/nuevo', component: RegistrarEmpleado },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
