import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rating-estrellas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rating-estrellas.html',
  styleUrl: './rating-estrellas.css',
})
export class RatingEstrellas {
  @Input() valor: number = 0;
  @Input() soloLectura: boolean = false;
  @Input() tamano: 'sm' | 'md' | 'lg' = 'md';
  @Input() mostrarNumero: boolean = true;
  @Input() totalResenas?: number;

  @Output() valorChange = new EventEmitter<number>();

  estrellasIndices = [1, 2, 3, 4, 5];
  hoverValor = signal<number | null>(null);

  get valorVisible(): number {
    const h = this.hoverValor();
    return h !== null ? h : this.valor;
  }

  obtenerPorcentajeEstrella(indice: number): number {
    const v = this.valorVisible;
    if (v >= indice) return 100;
    if (v >= indice - 0.5) return 50;
    return 0;
  }

  onHover(puntaje: number): void {
    if (this.soloLectura) return;
    this.hoverValor.set(puntaje);
  }

  onMouseLeave(): void {
    if (this.soloLectura) return;
    this.hoverValor.set(null);
  }

  onSeleccionar(puntaje: number): void {
    if (this.soloLectura) return;
    this.valor = puntaje;
    this.hoverValor.set(null);
    this.valorChange.emit(puntaje);
  }
}
