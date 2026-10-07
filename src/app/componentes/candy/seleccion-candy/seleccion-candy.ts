import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CandyService } from '../../../servicios/candy';
import { FuncionesService } from '../../../servicios/funciones';
import { CuponesService } from '../../../servicios/cupones';
import { ComprasService } from '../../../servicios/compras';
import { Auth } from '../../../servicios/auth';
import { ProductoCandy, CategoriaCandy } from '../../../models/candy';
import { Funcion } from '../../../models/funcion';
import { Cupon } from '../../../models/cupon';

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
  cuponId?: string;
  cuponCodigo?: string;
  cuponNombre?: string;
  descuento?: number;
  porcentajeDescuento?: number;
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
  private cuponesService = inject(CuponesService);
  private comprasService = inject(ComprasService);
  authService = inject(Auth);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  productos = signal<ProductoCandy[]>([]);
  cargando = signal<boolean>(true);
  categoriaFiltro = signal<string>('todas');
  carrito = signal<Record<string, number>>({}); // idProducto -> cantidad

  compraContexto = signal<CompraContexto | null>(null);
  funcion = signal<Funcion | null>(null);

  // Cupones asignados al usuario en la BD por su ID
  cuponesDisponibles = signal<Cupon[]>([]);
  cargandoCupones = signal<boolean>(false);
  cuponSeleccionado = signal<Cupon | null>(null);

  constructor() {
    // Reaccionar de inmediato cuando el usuario se carga o cambia
    effect(() => {
      const u = this.authService.usuarioActual();
      if (u) {
        this.cargarCuponesDisponibles();
      }
    });
  }

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
    await this.cargarCuponesDisponibles();
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
      });
    }
  }

  private async cargarProductos(): Promise<void> {
    try {
      this.cargando.set(true);
      const items = await this.candyService.obtenerTodos();
      this.productos.set(items);
    } catch (err) {
      console.error('Error al cargar productos de Candy:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Carga los cupones que coinciden con el usuario_id del usuario actual en cupones_usuario
   */
  async cargarCuponesDisponibles(): Promise<void> {
    const usuario = await this.authService.obtenerUsuario();
    if (!usuario) {
      this.cuponesDisponibles.set([]);
      return;
    }

    this.cargandoCupones.set(true);
    try {
      const edad = this.calcularEdadUsuario(usuario.fechaNacimiento);
      const comprasPrevias = await this.comprasService.obtenerComprasUsuario(usuario.id);
      const esPrimeraCompra = comprasPrevias.length === 0;

      // Consultar en la base de datos los cupones asignados a este usuario
      const cupones = await this.cuponesService.obtenerCuponesDisponiblesUsuario(
        usuario.id,
        edad,
        esPrimeraCompra
      );

      this.cuponesDisponibles.set(cupones);

      // Si el contexto ya tenía un cupón guardado, restaurarlo
      const ctx = this.compraContexto();
      if (ctx?.cuponId) {
        const previo = cupones.find((c) => c.id === ctx.cuponId);
        if (previo) {
          this.cuponSeleccionado.set(previo);
        }
      }
    } catch (e) {
      console.warn('Error cargando cupones asignados al usuario:', e);
    } finally {
      this.cargandoCupones.set(false);
    }
  }

  private calcularEdadUsuario(fechaNacimiento?: string): number {
    if (!fechaNacimiento) return 0;
    const parts = fechaNacimiento.split('-').map(Number);
    if (parts.length !== 3) return 0;
    const [y, m, d] = parts;
    const hoy = new Date();
    let edad = hoy.getFullYear() - y;
    const mesActual = hoy.getMonth() + 1;
    if (mesActual < m || (mesActual === m && hoy.getDate() < d)) {
      edad--;
    }
    return Math.max(0, edad);
  }

  /**
   * Permite al usuario decidir si canjear el cupón o deseleccionarlo
   */
  toggleCupon(cupon: Cupon): void {
    const actual = this.cuponSeleccionado();
    if (actual?.id === cupon.id) {
      // El usuario decidió no usarlo
      this.cuponSeleccionado.set(null);
    } else {
      // El usuario decidió canjearlo
      this.cuponSeleccionado.set(cupon);
    }
    this.guardarContexto();
  }

  get productosFiltrados(): ProductoCandy[] {
    const f = this.categoriaFiltro();
    if (f === 'todas') return this.productos();
    return this.productos().filter((p) => p.categoria === f);
  }

  obtenerCantidad(productoId: string): number {
    return this.carrito()[productoId] || 0;
  }

  agregarProducto(producto: ProductoCandy): void {
    const actual = { ...this.carrito() };
    actual[producto.id] = (actual[producto.id] || 0) + 1;
    this.carrito.set(actual);
    this.guardarContexto();
  }

  quitarProducto(producto: ProductoCandy): void {
    const actual = { ...this.carrito() };
    const cantidad = actual[producto.id] || 0;
    if (cantidad <= 1) {
      delete actual[producto.id];
    } else {
      actual[producto.id] = cantidad - 1;
    }
    this.carrito.set(actual);
    this.guardarContexto();
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

  subtotalBruto = computed<number>(() => {
    return this.totalEntradas() + this.totalCandy();
  });

  descuentoMonto = computed<number>(() => {
    const c = this.cuponSeleccionado();
    if (!c || c.porcentajeDescuento <= 0) return 0;
    return Math.round((this.subtotalBruto() * c.porcentajeDescuento) / 100);
  });

  totalFinal = computed<number>(() => {
    const total = this.subtotalBruto() - this.descuentoMonto();
    return Math.max(0, total);
  });

  guardarContexto(): void {
    const actual = this.compraContexto();
    const cupon = this.cuponSeleccionado();
    if (actual && typeof sessionStorage !== 'undefined') {
      const actualizado: CompraContexto = {
        ...actual,
        itemsCandy: this.itemsSeleccionados(),
        totalCandy: this.totalCandy(),
        cuponId: cupon?.id,
        cuponCodigo: cupon?.codigo,
        cuponNombre: cupon?.nombre,
        descuento: this.descuentoMonto(),
        porcentajeDescuento: cupon?.porcentajeDescuento,
      };
      sessionStorage.setItem('cinetp_compra_actual', JSON.stringify(actualizado));
      this.compraContexto.set(actualizado);
    }
  }

  continuarAlPago(): void {
    this.guardarContexto();
    const actual = this.compraContexto();
    if (!actual || !actual.asientos || actual.asientos.length === 0) {
      alert('Debes seleccionar al menos una butaca antes de continuar.');
      this.volverASala();
      return;
    }
    this.router.navigate(['/pago']);
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
      : d.toLocaleString('es-AR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
  }
}
