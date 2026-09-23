import { Component, input, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sala } from '../../../models/sala';
import { SalaService } from '../../../servicios/sala';

@Component({
  selector: 'app-mapa-sala',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-sala.html',
  styleUrl: './mapa-sala.css',
})
export class MapaSalaComponent implements OnInit {
  private salaService = inject(SalaService);

  salaInput = input<Sala | null>(null);
  mostrarPantalla = input<boolean>(true);
  mostrarLeyenda = input<boolean>(true);
  titulo = input<string>('');
  subtituloScreen = input<string>('');

  salaFallback = signal<Sala | null>(null);

  sala = computed<Sala | null>(() => {
    return this.salaInput() || this.salaFallback();
  });

  async ngOnInit(): Promise<void> {
    if (!this.salaInput()) {
      const salas = await this.salaService.obtenerSalas();
      if (salas.length > 0) {
        this.salaFallback.set(salas[0]);
      }
    }
  }
}
