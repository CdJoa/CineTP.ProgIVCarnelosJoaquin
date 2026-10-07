import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../servicios/auth';
import { AdminDirective } from '../../directivas/admin.directive';
import { EmpleadoDirective } from '../../directivas/empleado.directive';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, AdminDirective, EmpleadoDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  authService = inject(Auth);
  private router = inject(Router);

  async cerrarSesion(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/home']);
  }
}
