import { Pipe, PipeTransform } from '@angular/core';
import { Pelicula } from '../models/pelicula';
import { aperturaVenta, estaEnPreventa, formatearFechaCorta, ventaHabilitada } from '../utils/preventa';

/**
 * Aviso de cuándo abre la venta de una película, o null si ya se pueden comprar entradas.
 * Uso: `@if (pelicula | ventaPreventa; as aviso) { <p>{{ aviso }}</p> }`
 *
 * Es pura: Angular solo la recalcula cuando cambia la película, no en cada detección de cambios.
 */
@Pipe({
  name: 'ventaPreventa',
  standalone: true,
})
export class VentaPreventaPipe implements PipeTransform {
  transform(pelicula: Pelicula | null | undefined): string | null {
    if (!pelicula || ventaHabilitada(pelicula)) return null;
    const apertura = formatearFechaCorta(aperturaVenta(pelicula)!);
    const tipo = estaEnPreventa(pelicula) ? 'Preventa habilitada' : 'Venta de entradas habilitada';
    return `🗓️ ${tipo} 1 semana antes del estreno: desde el ${apertura}.`;
  }
}
