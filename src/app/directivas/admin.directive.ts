import { Directive, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { Auth } from '../servicios/auth';
import { RolesAdminService } from '../servicios/roles-admin';

/**
 * Muestra el contenido a quien puede entrar al panel de administración:
 * el rol base `admin` (acceso total) o un usuario con un rol personalizado que le habilite
 * alguna sección (ej: "Solo reportes"). Uso: `<a *appAdmin routerLink="/admin">`.
 *
 * El acceso real a las rutas lo controlan adminAccessGuard / adminSectionGuard;
 * esta directiva solo decide si se dibuja el elemento.
 */
@Directive({
  selector: '[appAdmin]',
  standalone: true,
})
export class AdminDirective {
  private auth = inject(Auth);
  private rolesAdmin = inject(RolesAdminService);
  private template = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private visible = false;

  constructor() {
    // Se vuelve a evaluar cuando cambia el usuario o sus secciones habilitadas (ambos son signals).
    effect(() => {
      const usuario = this.auth.usuarioActual();
      const tieneSecciones = this.rolesAdmin.seccionesActuales().length > 0;
      const mostrar = !!usuario && (usuario.rol === 'admin' || tieneSecciones);

      // Solo toca el DOM si cambió el estado, para no recrear la vista sin necesidad.
      if (mostrar && !this.visible) {
        this.viewContainer.createEmbeddedView(this.template);
      } else if (!mostrar && this.visible) {
        this.viewContainer.clear();
      }
      this.visible = mostrar;
    });
  }
}
