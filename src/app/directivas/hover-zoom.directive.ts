import { Directive, ElementRef, inject, Input, Renderer2 } from '@angular/core';

/**
 * Agranda el elemento al pasar el mouse. Uso: `<img [appHoverZoom]="1.05">`.
 * Los eventos se declaran en `host`, la forma recomendada en Angular moderno
 * (equivale a usar @HostListener).
 */
@Directive({
  selector: '[appHoverZoom]',
  standalone: true,
  host: {
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',
  },
})
export class HoverZoomDirective {
  @Input() appHoverZoom: number = 1.05;

  private el = inject(ElementRef);
  private render = inject(Renderer2);

  constructor() {
    this.render.setStyle(this.el.nativeElement, 'transition', 'transform 0.25s ease-in-out');
  }

  onMouseEnter(): void {
    this.render.setStyle(this.el.nativeElement, 'transform', `scale(${this.appHoverZoom})`);
  }

  onMouseLeave(): void {
    this.render.setStyle(this.el.nativeElement, 'transform', 'scale(1)');
  }
}
