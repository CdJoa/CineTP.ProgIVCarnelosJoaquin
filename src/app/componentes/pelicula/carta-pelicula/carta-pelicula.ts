import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Pelicula } from '../../../models/pelicula';
import { HoverZoomDirective } from '../../../directivas/hover-zoom.directive';

@Component({
  selector: 'app-carta-pelicula',
  standalone: true,
  imports: [CommonModule, HoverZoomDirective],
  templateUrl: './carta-pelicula.html',
  styleUrl: './carta-pelicula.css',
})
export class CartaPelicula {
  pelicula = input.required<Pelicula>();
  seleccionada = input<boolean>(false);
  mostrarBotonEditar = input<boolean>(false);

  seleccionar = output<Pelicula>();
  editar = output<Pelicula>();

  onCardClick(): void {
    this.seleccionar.emit(this.pelicula());
  }

  onEditarClick(event: MouseEvent): void {
    event.stopPropagation(); // Evitar disparar el click de la card
    this.editar.emit(this.pelicula());
  }
}
