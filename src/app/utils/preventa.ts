import { Pelicula } from '../models/pelicula';

export const PREVENTA_PORCENTAJE_MIN = -50;
export const PREVENTA_PORCENTAJE_MAX = 50;

/** Fecha local en formato YYYY-MM-DD (no UTC, para que el cambio ocurra a medianoche en Argentina). */
export function fechaLocalIso(fecha: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

/**
 * Una película está en preventa si el admin la activó y todavía no llegó su estreno.
 * El día del estreno ya se cobra el precio normal: no hace falta ningún proceso que la
 * "apague", el estado se calcula cada vez a partir de la fecha.
 */
export function estaEnPreventa(
  pelicula: Pick<Pelicula, 'preventaActiva' | 'fechaEstreno'> | null | undefined,
  ahora: Date = new Date()
): boolean {
  if (!pelicula?.preventaActiva || !pelicula.fechaEstreno) return false;
  return fechaLocalIso(ahora) < pelicula.fechaEstreno.slice(0, 10);
}

/**
 * Primer día en que se pueden programar funciones de la película (YYYY-MM-DD):
 * el estreno, o hoy si el estreno ya pasó. Antes del estreno solo hay venta anticipada.
 */
export function primerDiaFunciones(
  pelicula: Pick<Pelicula, 'fechaEstreno'> | null | undefined,
  ahora: Date = new Date()
): string {
  const hoy = fechaLocalIso(ahora);
  const estreno = pelicula?.fechaEstreno?.slice(0, 10);
  return estreno && estreno > hoy ? estreno : hoy;
}

/** La venta de entradas abre esta cantidad de días antes del estreno (mail del 08/03). */
export const DIAS_PREVENTA = 7;

/** Día en que abre la venta de entradas (YYYY-MM-DD): una semana antes del estreno. */
export function aperturaVenta(pelicula: Pick<Pelicula, 'fechaEstreno'> | null | undefined): string | null {
  if (!pelicula?.fechaEstreno) return null;
  const apertura = new Date(`${pelicula.fechaEstreno.slice(0, 10)}T00:00:00`);
  apertura.setDate(apertura.getDate() - DIAS_PREVENTA);
  return fechaLocalIso(apertura);
}

/** Se pueden comprar entradas si ya se llegó a la apertura (o la película no tiene estreno cargado). */
export function ventaHabilitada(
  pelicula: Pick<Pelicula, 'fechaEstreno'> | null | undefined,
  ahora: Date = new Date()
): boolean {
  const apertura = aperturaVenta(pelicula);
  return !apertura || fechaLocalIso(ahora) >= apertura;
}

/** YYYY-MM-DD → DD/MM/AAAA */
export function formatearFechaCorta(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Aplica el porcentaje de preventa (-50% a +50%) al precio normal de la función. */
export function aplicarPorcentaje(precioNormal: number, porcentaje: number): number {
  const pct = Math.min(PREVENTA_PORCENTAJE_MAX, Math.max(PREVENTA_PORCENTAJE_MIN, Number(porcentaje) || 0));
  return Math.round(Number(precioNormal || 0) * (1 + pct / 100));
}

/** Precio que corresponde cobrar hoy para una función de esta película. */
export function precioVigente(
  precioNormal: number,
  pelicula: Pick<Pelicula, 'preventaActiva' | 'fechaEstreno' | 'preventaPorcentaje'> | null | undefined,
  ahora: Date = new Date()
): number {
  if (!estaEnPreventa(pelicula, ahora)) return Number(precioNormal || 0);
  return aplicarPorcentaje(precioNormal, pelicula?.preventaPorcentaje || 0);
}

/** Texto legible del ajuste, ej: "20% más barato", "10% más caro", "mismo precio". */
export function describirPorcentaje(porcentaje: number): string {
  const pct = Number(porcentaje) || 0;
  if (pct === 0) return 'mismo precio que el normal';
  return pct < 0 ? `${Math.abs(pct)}% más barato` : `${pct}% más caro`;
}
