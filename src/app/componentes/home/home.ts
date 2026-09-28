import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CarteleraComponent } from '../pelicula/cartelera/cartelera';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, CarteleraComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {}
