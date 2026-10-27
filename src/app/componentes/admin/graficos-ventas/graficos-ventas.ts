import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComprasService } from '../../../servicios/compras';
import { Compra } from '../../../models/compra';

export type PeriodoGraficos = 'semana' | 'mes' | 'historico';

export interface RankingPeliculaItem {
  titulo: string;
  poster?: string;
  boletos: number;
  recaudacion: number;
  porcentajeRelativo: number;
  porcentajeTotal: number;
}

export interface RankingCandyItem {
  nombre: string;
  unidades: number;
  recaudacion: number;
  porcentajeRelativo: number;
  porcentajeTotal: number;
}

@Component({
  selector: 'app-graficos-ventas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graficos-ventas.html',
  styleUrl: './graficos-ventas.css',
})
export class GraficosVentasComponent implements OnInit {
  private comprasService = inject(ComprasService);

  compras = signal<Compra[]>([]);
  cargando = signal<boolean>(true);
  error = signal<string | null>(null);

  // Período de análisis: Semana (7 días) / Mes (30 días) / Todo el historial
  periodo = signal<PeriodoGraficos>('semana');

  // Compras consideradas según el período seleccionado (solo ventas válidas)
  comprasPeriodo = computed(() => {
    const lista = this.compras().filter((c) => c.estado !== 'cancelada');
    const p = this.periodo();
    const ahora = new Date();

    if (p === 'semana') {
      const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
      return lista.filter((c) => new Date(c.creadoEn || c.funcionInicio) >= hace7Dias);
    } else if (p === 'mes') {
      const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      return lista.filter((c) => new Date(c.creadoEn || c.funcionInicio) >= hace30Dias);
    }
    return lista;
  });

  // Ranking de Películas Más Vistas en el período
  rankingPeliculas = computed((): RankingPeliculaItem[] => {
    const compras = this.comprasPeriodo();
    const mapa = new Map<string, { boletos: number; recaudacion: number; poster?: string }>();

    let totalBoletosPeriodo = 0;

    for (const c of compras) {
      const titulo = c.peliculaTitulo || 'Sin título';
      const boletos = c.asientos?.length || (c.totalEntradas > 0 ? 1 : 0);
      const recaudacion = c.totalEntradas || 0;

      if (!mapa.has(titulo)) {
        mapa.set(titulo, { boletos: 0, recaudacion: 0, poster: c.peliculaPoster });
      }

      const item = mapa.get(titulo)!;
      item.boletos += boletos;
      item.recaudacion += recaudacion;
      if (!item.poster && c.peliculaPoster) item.poster = c.peliculaPoster;

      totalBoletosPeriodo += boletos;
    }

    const items = Array.from(mapa.entries())
      .map(([titulo, data]) => ({
        titulo,
        poster: data.poster,
        boletos: data.boletos,
        recaudacion: data.recaudacion,
        porcentajeRelativo: 0,
        porcentajeTotal: totalBoletosPeriodo > 0 ? Number(((data.boletos / totalBoletosPeriodo) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.boletos - a.boletos);

    const maxBoletos = items.length > 0 ? items[0].boletos : 1;
    for (const p of items) {
      p.porcentajeRelativo = Math.max(10, Math.round((p.boletos / maxBoletos) * 100));
    }

    return items;
  });

  // Ranking de Productos de Candy Bar Más Vendidos en el período
  rankingCandy = computed((): RankingCandyItem[] => {
    const compras = this.comprasPeriodo();
    const mapa = new Map<string, { unidades: number; recaudacion: number }>();

    let totalUnidadesPeriodo = 0;

    for (const c of compras) {
      if (!c.itemsCandy || !c.itemsCandy.length) continue;
      for (const item of c.itemsCandy) {
        const nombre = item.nombre || 'Producto Candy';
        const cant = Number(item.cantidad || 0);
        const subtotal = Number(item.subtotal || 0);

        if (!mapa.has(nombre)) {
          mapa.set(nombre, { unidades: 0, recaudacion: 0 });
        }

        const data = mapa.get(nombre)!;
        data.unidades += cant;
        data.recaudacion += subtotal;

        totalUnidadesPeriodo += cant;
      }
    }

    const items = Array.from(mapa.entries())
      .map(([nombre, data]) => ({
        nombre,
        unidades: data.unidades,
        recaudacion: data.recaudacion,
        porcentajeRelativo: 0,
        porcentajeTotal: totalUnidadesPeriodo > 0 ? Number(((data.unidades / totalUnidadesPeriodo) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.unidades - a.unidades);

    const maxUnidades = items.length > 0 ? items[0].unidades : 1;
    for (const c of items) {
      c.porcentajeRelativo = Math.max(10, Math.round((c.unidades / maxUnidades) * 100));
    }

    return items;
  });

  // Película estrella (Top 1)
  peliculaMasVista = computed(() => {
    const items = this.rankingPeliculas();
    return items.length > 0 ? items[0] : null;
  });

  // Producto estrella del Candy Bar (Top 1)
  productoMasVendidoCandy = computed(() => {
    const items = this.rankingCandy();
    return items.length > 0 ? items[0] : null;
  });

  // Totales acumulados del período
  totalesPeriodo = computed(() => {
    const pelis = this.rankingPeliculas();
    const candy = this.rankingCandy();

    const totalBoletos = pelis.reduce((acc, p) => acc + p.boletos, 0);
    const totalRecaudadoPelis = pelis.reduce((acc, p) => acc + p.recaudacion, 0);

    const totalUnidadesCandy = candy.reduce((acc, c) => acc + c.unidades, 0);
    const totalRecaudadoCandy = candy.reduce((acc, c) => acc + c.recaudacion, 0);

    return {
      totalBoletos,
      totalRecaudadoPelis,
      totalUnidadesCandy,
      totalRecaudadoCandy,
      granTotal: totalRecaudadoPelis + totalRecaudadoCandy,
    };
  });

  async ngOnInit(): Promise<void> {
    await this.cargarCompras();
  }

  async cargarCompras(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const data = await this.comprasService.obtenerTodasLasCompras();
      this.compras.set(data);
    } catch (err) {
      console.error('Error al cargar ventas para gráficos:', err);
      this.error.set(err instanceof Error ? err.message : 'Error al cargar datos.');
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarPeriodo(nuevo: PeriodoGraficos): void {
    this.periodo.set(nuevo);
  }

  formatearMoneda(monto: number): string {
    return '$' + (monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}
