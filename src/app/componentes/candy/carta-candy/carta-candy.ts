import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductoCandy } from '../../../models/candy';
import { HoverZoomDirective } from '../../../directivas/hover-zoom.directive';

@Component({
  selector: 'app-carta-candy',
  standalone: true,
  imports: [CommonModule, HoverZoomDirective],
  templateUrl: './carta-candy.html',
  styleUrl: './carta-candy.css',
})
export class CartaCandy {
  producto = input.required<ProductoCandy>();
  seleccionado = input<boolean>(false);
  mostrarBotonEditar = input<boolean>(false);

  seleccionar = output<ProductoCandy>();
  editar = output<ProductoCandy>();

  onCardClick(): void {
    this.seleccionar.emit(this.producto());
  }

  onEditarClick(event: MouseEvent): void {
    event.stopPropagation();
    this.editar.emit(this.producto());
  }
}
