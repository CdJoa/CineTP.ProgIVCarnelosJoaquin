import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CandyService } from '../../../servicios/candy';
import { FuncionesService } from '../../../servicios/funciones';
import { ProductoCandy, CategoriaCandy } from '../../../models/candy';
import { Funcion } from '../../../models/funcion';

export interface CompraContexto {
  funcionId: string;
  peliculaId?: string;
  peliculaTitulo?: string;
  salaNombre?: string;
  inicio?: string;
  formato?: string;
  idioma?: string;
  precioUnitario?: number;
  asientos: string[];
  totalEntradas: number;
  itemsCandy?: { producto: ProductoCandy; cantidad: number }[];
  totalCandy?: number;
}

@Component({
  selector: 'app-seleccion-candy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seleccion-candy.html',
  styleUrl: './seleccion-candy.css',
})
export class SeleccionCandyComponent implements OnInit {
  private candyService = inject(CandyService);
  private funcionesService = inject(FuncionesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  productos = signal<ProductoCandy[]>([]);
  cargando = signal<boolean>(true);
  categoriaFiltro = signal<string>('todas');
  carrito = signal<Record<string, number>>({}); // idProducto -> cantidad

  compraContexto = signal<CompraContexto | null>(null);
  funcion = signal<Funcion | null>(null);

  readonly categorias: { id: string; label: string }[] = [
    { id: 'todas', label: 'Todos' },
    { id: 'pochoclo', label: 'Pochoclos' },
    { id: 'bebida', label: 'Bebidas' },
    { id: 'snacks', label: 'Snacks' },
    { id: 'comida', label: 'Comida' },
  ];

  combos = computed<ProductoCandy[]>(() => {
    return this.productos().filter((p) => p.categoria === 'combo');
  });

  async ngOnInit(): Promise<void> {
    this.cargarContextoCompra();
    await this.cargarProductos();
  }

  private cargarContextoCompra(): void {
    if (typeof sessionStorage !== 'undefined') {
      const guardado = sessionStorage.getItem('cinetp_compra_actual');
      if (guardado) {
        try {
          const parsed = JSON.parse(guardado) as CompraContexto;
          this.compraContexto.set(parsed);
          if (parsed.itemsCandy) {
            const inicial: Record<string, number> = {};
            for (const item of parsed.itemsCandy) {
              inicial[item.producto.id] = item.cantidad;
            }
            this.carrito.set(inicial);
          }
        } catch {
          sessionStorage.removeItem('cinetp_compra_actual');
        }
      }
    }

    const funcionIdQuery = this.route.snapshot.queryParamMap.get('funcionId');
    const fId = funcionIdQuery || this.compraContexto()?.funcionId;
    if (fId) {
      this.funcionesService.obtenerPorId(fId).then((fn) => {
        if (fn) this.funcion.set(fn);
      }).catch(() => {});
    }
  }

  async cargarProductos(): Promise<void> {
    this.cargando.set(true);
    try {
      const list = await this.candyService.obtenerProductos();
      this.productos.set(list.filter((p) => p.activo !== false));
    } catch (err) {
      console.error('Error al cargar productos de Candy:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  get productosFiltrados(): ProductoCandy[] {
    const individuales = this.productos().filter((p) => p.categoria !== 'combo');
    const cat = this.categoriaFiltro();
    if (cat === 'todas') return individuales;
    return individuales.filter((p) => p.categoria === cat);
  }

  obtenerCantidad(productoId: string): number {
    return this.carrito()[productoId] || 0;
  }

  agregarProducto(producto: ProductoCandy): void {
    const actual = this.obtenerCantidad(producto.id);
    this.carrito.update((c) => ({ ...c, [producto.id]: actual + 1 }));
  }

  quitarProducto(producto: ProductoCandy): void {
    const actual = this.obtenerCantidad(producto.id);
    if (actual <= 1) {
      this.carrito.update((c) => {
        const nuevo = { ...c };
        delete nuevo[producto.id];
        return nuevo;
      });
    } else {
      this.carrito.update((c) => ({ ...c, [producto.id]: actual - 1 }));
    }
  }

  totalCandy = computed<number>(() => {
    let sum = 0;
    const mapa = this.carrito();
    for (const p of this.productos()) {
      const cant = mapa[p.id] || 0;
      sum += p.precio * cant;
    }
    return sum;
  });

  puntosCandy = computed<number>(() => {
    let sum = 0;
    const mapa = this.carrito();
    for (const p of this.productos()) {
      const cant = mapa[p.id] || 0;
      sum += (p.puntajeCompra || 0) * cant;
    }
    return sum;
  });

  itemsSeleccionados = computed<{ producto: ProductoCandy; cantidad: number }[]>(() => {
    const mapa = this.carrito();
    const resultado: { producto: ProductoCandy; cantidad: number }[] = [];
    for (const p of this.productos()) {
      const cant = mapa[p.id] || 0;
      if (cant > 0) {
        resultado.push({ producto: p, cantidad: cant });
      }
    }
    return resultado;
  });

  totalEntradas = computed<number>(() => {
    return this.compraContexto()?.totalEntradas || 0;
  });

  totalFinal = computed<number>(() => {
    return this.totalEntradas() + this.totalCandy();
  });

  guardarContexto(): void {
    const actual = this.compraContexto();
    if (actual && typeof sessionStorage !== 'undefined') {
      const actualizado: CompraContexto = {
        ...actual,
        itemsCandy: this.itemsSeleccionados(),
        totalCandy: this.totalCandy(),
      };
      sessionStorage.setItem('cinetp_compra_actual', JSON.stringify(actualizado));
      this.compraContexto.set(actualizado);
    }
  }

  volverASala(): void {
    this.guardarContexto();
    const fId = this.compraContexto()?.funcionId || this.route.snapshot.queryParamMap.get('funcionId');
    if (fId) {
      this.router.navigate(['/sala'], { queryParams: { funcionId: fId } });
    } else {
      this.router.navigate(['/home']);
    }
  }

  formatearFecha(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
