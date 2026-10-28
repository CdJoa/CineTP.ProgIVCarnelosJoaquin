import { Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Auth } from '../../servicios/auth';
import { EmpleadoDirective } from '../../directivas/empleado.directive';
import { Notificacion, NotificacionesService } from '../../servicios/notificaciones';
import { RolesAdminService } from '../../servicios/roles-admin';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, EmpleadoDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnDestroy {
  authService = inject(Auth);
  private notificacionesService = inject(NotificacionesService);
  rolesAdminService = inject(RolesAdminService);
  private router = inject(Router);
  notificaciones = signal<Notificacion[]>([]);
  mostrarNotificaciones = signal(false);
  private canalNotificaciones?: RealtimeChannel;

  constructor() {
    effect(() => {
      const usuario = this.authService.usuarioActual();
      if (usuario) void this.rolesAdminService.obtenerMisSecciones().catch(() => undefined);
    });

    effect(() => {
      const usuario = this.authService.usuarioActual();
      if (usuario?.rol === 'cliente') {
        if (this.canalNotificaciones) {
          void this.authService.clienteSupabase.removeChannel(this.canalNotificaciones);
        }
        this.canalNotificaciones = this.notificacionesService.suscribirCambios(usuario.id, () => {
          void this.cargarNotificaciones(usuario.id);
        });
        void this.cargarNotificaciones(usuario.id);
      } else {
        if (this.canalNotificaciones) {
          void this.authService.clienteSupabase.removeChannel(this.canalNotificaciones);
          this.canalNotificaciones = undefined;
        }
        this.notificaciones.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.canalNotificaciones) {
      void this.authService.clienteSupabase.removeChannel(this.canalNotificaciones);
    }
  }

  private async cargarNotificaciones(usuarioId: string): Promise<void> {
    try {
      await this.authService.recargarSaldo();
      this.notificaciones.set(await this.notificacionesService.obtenerMisNotificaciones(usuarioId));
    } catch {
      this.notificaciones.set([]);
    }
  }

  get notificacionesNoLeidas(): number {
    return this.notificaciones().filter((item) => !item.leida).length;
  }

  verNotificaciones(): void {
    this.mostrarNotificaciones.update((visible) => !visible);
  }

  abrirNotificaciones(): void {
    this.mostrarNotificaciones.set(false);
    this.router.navigate(['/perfil']);
  }

  async cerrarSesion(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/home']);
  }
}
