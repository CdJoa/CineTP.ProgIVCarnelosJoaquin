import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  Renderer2,
  SimpleChanges,
  inject,
} from '@angular/core';

@Directive({
  selector: '[appInsertarComentario]',
  standalone: true,
})
export class InsertarComentarioDirective implements OnChanges {
  @Input('appInsertarComentario') puntaje: number = 0;

  private el = inject(ElementRef<HTMLElement>);
  private render = inject(Renderer2);

  constructor() {
    // Estilos base para revelación suave y moderna del contenedor de comentarios
    this.render.setStyle(this.el.nativeElement, 'transition', 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)');
    this.render.setStyle(this.el.nativeElement, 'overflow', 'hidden');
    this.render.setStyle(this.el.nativeElement, 'display', 'block');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['puntaje']) {
      this.actualizarVisibilidad(this.puntaje > 0);
    }
  }

  private actualizarVisibilidad(activo: boolean): void {
    const native = this.el.nativeElement;

    if (activo) {
      this.render.setStyle(native, 'opacity', '1');
      this.render.setStyle(native, 'max-height', '320px');
      this.render.setStyle(native, 'transform', 'translateY(0)');
      this.render.setStyle(native, 'pointer-events', 'auto');
      this.render.addClass(native, 'comentario-activo');

      // Autofocus en el textarea interno para agilizar la escritura del comentario corto
      setTimeout(() => {
        const textarea = native.querySelector('textarea, input[type="text"]') as HTMLElement | null;
        if (textarea) {
          textarea.focus();
        }
      }, 150);
    } else {
      this.render.setStyle(native, 'opacity', '0');
      this.render.setStyle(native, 'max-height', '0');
      this.render.setStyle(native, 'transform', 'translateY(-8px)');
      this.render.setStyle(native, 'pointer-events', 'none');
      this.render.removeClass(native, 'comentario-activo');
    }
  }
}
