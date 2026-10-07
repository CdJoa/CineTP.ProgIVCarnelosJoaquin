import { Directive, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { Auth } from '../servicios/auth';

/**
 * Muestra el contenido al personal del cine: empleados y también administradores,
 * que tienen control total.
 */
@Directive({
  selector: '[appEmpleado]',
  standalone: true,
})
export class EmpleadoDirective {
  private auth = inject(Auth);
  private template = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  constructor() {
    effect(() => {
      const usuario = this.auth.usuarioActual();
      if (usuario && (usuario.rol === 'empleado' || usuario.rol === 'admin')) {
        this.viewContainer.clear();
        this.viewContainer.createEmbeddedView(this.template);
      } else {
        this.viewContainer.clear();
      }
    });
  }
}
