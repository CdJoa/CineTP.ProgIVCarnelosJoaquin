import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../servicios/auth';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class PerfilComponent {
  authService = inject(Auth);
  private router = inject(Router);

  get usuario() {
    return this.authService.usuarioActual();
  }

  formatearFecha(fecha?: string): string {
    if (!fecha) return '-';
    const parts = fecha.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fecha;
  }

  async cerrarSesion(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/home']);
  }
}
