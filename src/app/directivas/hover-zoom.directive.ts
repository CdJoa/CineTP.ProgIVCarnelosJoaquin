import { Directive, ElementRef, HostListener, inject, Input, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appHoverZoom]',
  standalone: true,
  host: {
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

  @HostListener('mouseenter') onMouseEnter() {
    this.render.setStyle(this.el.nativeElement, 'transform', `scale(${this.appHoverZoom})`);
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.render.setStyle(this.el.nativeElement, 'transform', 'scale(1)');
  }
}
