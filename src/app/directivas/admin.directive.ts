import { Directive, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { Auth } from '../servicios/auth';

@Directive({
  selector: '[appAdmin]',
  standalone: true,
})
export class AdminDirective {
  private auth = inject(Auth);
  private template = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);

  constructor() {
    effect(() => {
      const usuario = this.auth.usuarioActual();
      if (usuario && usuario.rol === 'admin') {
        this.viewContainer.clear();
        this.viewContainer.createEmbeddedView(this.template);
      } else {
        this.viewContainer.clear();
      }
    });
  }
}
