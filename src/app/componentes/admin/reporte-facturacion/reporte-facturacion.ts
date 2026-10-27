import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ComprasService } from '../../../servicios/compras';
import { Auth } from '../../../servicios/auth';
import { Compra } from '../../../models/compra';

export type PresetFecha = 'todo' | 'hoy' | 'semana' | 'mes' | 'personalizado';
export type FiltroEstado = 'todos' | 'confirmada' | 'usado' | 'cancelada' | 'validas';

@Component({
  selector: 'app-reporte-facturacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporte-facturacion.html',
  styleUrl: './reporte-facturacion.css',
})
export class ReporteFacturacionComponent implements OnInit {
  private comprasService = inject(ComprasService);
  private authService = inject(Auth);

  compras = signal<Compra[]>([]);
  cargando = signal<boolean>(true);
  error = signal<string | null>(null);

  // Filtros de la tabla de facturación
  presetFecha = signal<PresetFecha>('todo');
  fechaDesde = signal<string>('');
  fechaHasta = signal<string>('');
  filtroEstado = signal<FiltroEstado>('todos');
  busqueda = signal<string>('');
  peliculaFiltro = signal<string>('todas');

  // Modal detalle de compra
  compraDetalle = signal<Compra | null>(null);

  get usuarioAdmin() {
    return this.authService.usuarioActual();
  }

  // Lista única de películas para el desplegable de filtro
  peliculasDisponibles = computed(() => {
    const set = new Set<string>();
    for (const c of this.compras()) {
      if (c.peliculaTitulo) set.add(c.peliculaTitulo);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  // ========================================================
  // COMPRAS FILTRADAS PARA LA TABLA DE FACTURACIÓN
  // ========================================================
  comprasFiltradas = computed(() => {
    let lista = this.compras();
    const preset = this.presetFecha();
    const fDesde = this.fechaDesde();
    const fHasta = this.fechaHasta();
    const estado = this.filtroEstado();
    const q = this.busqueda().toLowerCase().trim();
    const peli = this.peliculaFiltro();

    const ahora = new Date();

    // 1. Filtro de Fechas
    if (preset === 'hoy') {
      const hoyStr = ahora.toISOString().slice(0, 10);
      lista = lista.filter((c) => (c.creadoEn || '').slice(0, 10) === hoyStr);
    } else if (preset === 'semana') {
      const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
      lista = lista.filter((c) => new Date(c.creadoEn) >= hace7Dias);
    } else if (preset === 'mes') {
      const mesActual = ahora.toISOString().slice(0, 7); // YYYY-MM
      lista = lista.filter((c) => (c.creadoEn || '').slice(0, 7) === mesActual);
    } else if (preset === 'personalizado') {
      if (fDesde) {
        const d = new Date(fDesde + 'T00:00:00');
        lista = lista.filter((c) => new Date(c.creadoEn) >= d);
      }
      if (fHasta) {
        const h = new Date(fHasta + 'T23:59:59');
        lista = lista.filter((c) => new Date(c.creadoEn) <= h);
      }
    }

    // 2. Filtro de Estado
    if (estado === 'validas') {
      lista = lista.filter((c) => c.estado === 'confirmada' || c.estado === 'usado');
    } else if (estado !== 'todos') {
      lista = lista.filter((c) => c.estado === estado);
    }

    // 3. Filtro de Película
    if (peli !== 'todas') {
      lista = lista.filter((c) => c.peliculaTitulo === peli);
    }

    // 4. Búsqueda por texto (código, cliente, sala, película)
    if (q) {
      lista = lista.filter(
        (c) =>
          c.codigo.toLowerCase().includes(q) ||
          (c.usuarioEmail && c.usuarioEmail.toLowerCase().includes(q)) ||
          c.peliculaTitulo.toLowerCase().includes(q) ||
          c.salaNombre.toLowerCase().includes(q)
      );
    }

    return lista;
  });

  // Métricas financieras calculadas sobre la selección filtrada
  metricas = computed(() => {
    const lista = this.comprasFiltradas();

    let totalNeto = 0; // Solo confirmadas y usadas
    let totalEntradas = 0;
    let totalCandy = 0;
    let totalDescuentos = 0;
    let totalCancelado = 0;
    let cantidadEntradas = 0;
    let ordenesValidas = 0;
    let ordenesCanceladas = 0;

    for (const c of lista) {
      if (c.estado === 'cancelada') {
        totalCancelado += c.totalFinal;
        ordenesCanceladas++;
      } else {
        totalNeto += c.totalFinal;
        totalEntradas += c.totalEntradas;
        totalCandy += c.totalCandy || 0;
        totalDescuentos += c.descuento || 0;
        cantidadEntradas += c.asientos?.length || 0;
        ordenesValidas++;
      }
    }

    return {
      totalNeto,
      totalEntradas,
      totalCandy,
      totalDescuentos,
      totalCancelado,
      cantidadEntradas,
      ordenesValidas,
      ordenesCanceladas,
      totalOrdenes: lista.length,
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
      console.error('Error al cargar compras de facturación:', err);
      this.error.set(err instanceof Error ? err.message : 'Error al cargar datos de compras.');
    } finally {
      this.cargando.set(false);
    }
  }

  seleccionarPreset(preset: PresetFecha): void {
    this.presetFecha.set(preset);
  }

  formatearFechaHora(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  }

  formatearMoneda(monto: number): string {
    return '$' + (monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  abrirDetalle(compra: Compra): void {
    this.compraDetalle.set(compra);
  }

  cerrarDetalle(): void {
    this.compraDetalle.set(null);
  }

  // ========================================================
  // EXPORTAR A PDF (EXCLUSIVO CONTABILIDAD Y FACTURACIÓN)
  // ========================================================
  exportarPDF(): void {
    const lista = this.comprasFiltradas();
    const m = this.metricas();
    const admin = this.usuarioAdmin;
    const ahora = new Date();
    const fechaEmision = ahora.toLocaleString('es-AR');

    // Documento A4 horizontal (landscape)
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // 1. Encabezado institucional / Membrete
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, 297, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('CINETP - REPORTE CONTABLE Y DE FACTURACIÓN', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Emisión: ${fechaEmision} | Administrador: ${admin ? admin.nombre + ' ' + admin.apellido + ' (' + admin.email + ')' : 'Admin'}`, 14, 18);

    // 2. Tarjetas de Resumen Financiero
    const yCards = 29;
    const cardWidth = 50;
    const cardHeight = 16;
    const gap = 6;
    let xOffset = 14;

    const cardsData = [
      { titulo: 'FACTURACIÓN NETA', valor: this.formatearMoneda(m.totalNeto), colorBg: [236, 253, 245], colorTxt: [5, 150, 105] },
      { titulo: 'VENTAS ENTRADAS', valor: this.formatearMoneda(m.totalEntradas), colorBg: [241, 245, 249], colorTxt: [30, 41, 59] },
      { titulo: 'VENTAS CANDY BAR', valor: this.formatearMoneda(m.totalCandy), colorBg: [254, 243, 199], colorTxt: [180, 83, 9] },
      { titulo: 'TOTAL DESCUENTOS', valor: this.formatearMoneda(m.totalDescuentos), colorBg: [241, 245, 249], colorTxt: [71, 85, 105] },
      { titulo: 'CANCELACIONES', valor: this.formatearMoneda(m.totalCancelado), colorBg: [254, 242, 242], colorTxt: [220, 38, 38] },
    ];

    for (const card of cardsData) {
      doc.setFillColor(card.colorBg[0], card.colorBg[1], card.colorBg[2]);
      doc.roundedRect(xOffset, yCards, cardWidth, cardHeight, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(card.titulo, xOffset + 4, yCards + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(card.colorTxt[0], card.colorTxt[1], card.colorTxt[2]);
      doc.text(card.valor, xOffset + 4, yCards + 12);

      xOffset += cardWidth + gap;
    }

    // 3. Filas para la tabla contable
    const body = lista.map((c) => [
      c.codigo,
      this.formatearFechaHora(c.creadoEn),
      c.usuarioEmail || 'Invitado',
      c.peliculaTitulo,
      `${c.salaNombre} (${c.asientos.join(', ')})`,
      `$${(c.totalEntradas || 0).toLocaleString('es-AR')}`,
      `$${(c.totalCandy || 0).toLocaleString('es-AR')}`,
      c.descuento ? `-$${c.descuento.toLocaleString('es-AR')}` : '$0',
      `$${c.totalFinal.toLocaleString('es-AR')}`,
      c.estado.toUpperCase(),
    ]);

    // 4. Tabla generada con autoTable
    autoTable(doc, {
      startY: 50,
      head: [
        [
          'Código',
          'Fecha / Hora',
          'Cliente',
          'Película',
          'Sala / Butacas',
          'Entradas',
          'Candy',
          'Descuento',
          'Total Final',
          'Estado',
        ],
      ],
      body: body,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: 'bold', halign: 'center' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 42 },
        3: { cellWidth: 44, fontStyle: 'bold' },
        4: { cellWidth: 38 },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' },
        7: { cellWidth: 20, halign: 'right' },
        8: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        9: { cellWidth: 20, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 9) {
          const val = String(data.cell.raw).toLowerCase();
          if (val === 'cancelada') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'usado') {
            data.cell.styles.textColor = [5, 150, 105];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [15, 23, 42];
          }
        }
      },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `CineTP Contabilidad y Facturación - Página ${data.pageNumber} de ${pageCount}`,
          14,
          doc.internal.pageSize.height - 6
        );
      },
    });

    // Guardar archivo PDF
    const timestamp = ahora.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    doc.save(`Reporte_Contable_Facturacion_${timestamp}.pdf`);
  }

  // ========================================================
  // EXPORTAR A EXCEL (EXCLUSIVO CONTABILIDAD Y FACTURACIÓN)
  // ========================================================
  exportarExcel(): void {
    const lista = this.comprasFiltradas();
    const m = this.metricas();
    const admin = this.usuarioAdmin;
    const ahora = new Date();
    const fechaEmision = ahora.toLocaleString('es-AR');

    // Hoja 1: Planilla Contable Detallada
    const filasDetalle = lista.map((c) => ({
      'Código de Venta': c.codigo,
      'Fecha Emisión': this.formatearFechaHora(c.creadoEn),
      'Email Cliente': c.usuarioEmail || 'Invitado',
      'Película': c.peliculaTitulo,
      'Sala': c.salaNombre,
      'Fecha de Función': this.formatearFechaHora(c.funcionInicio),
      'Formato': c.formato || '2D',
      'Idioma': c.idioma || 'Español',
      'Butacas': c.asientos.join(', '),
      'Cant. Butacas': c.asientos.length,
      'Subtotal Entradas ($)': c.totalEntradas || 0,
      'Subtotal Candy ($)': c.totalCandy || 0,
      'Descuento ($)': c.descuento || 0,
      'Cupón Aplicado': c.cuponCodigo || '-',
      'Total Facturado ($)': c.totalFinal,
      'Puntos Ganados': c.puntosGanados || 0,
      'Estado': c.estado.toUpperCase(),
    }));

    // Hoja 2: Resumen Contable Ejecutivo
    const filasResumen = [
      { 'Métrica Financiera': 'Facturación Neta (Ventas Válidas)', 'Valor': m.totalNeto },
      { 'Métrica Financiera': 'Ventas de Entradas ($)', 'Valor': m.totalEntradas },
      { 'Métrica Financiera': 'Ventas de Candy Bar ($)', 'Valor': m.totalCandy },
      { 'Métrica Financiera': 'Total Descuentos por Cupones ($)', 'Valor': m.totalDescuentos },
      { 'Métrica Financiera': 'Monto Cancelado ($ devuelto a crédito)', 'Valor': m.totalCancelado },
      { 'Métrica Financiera': 'Cantidad de Butacas Vendidas', 'Valor': m.cantidadEntradas },
      { 'Métrica Financiera': 'Órdenes Válidas (Confirmadas / Usadas)', 'Valor': m.ordenesValidas },
      { 'Métrica Financiera': 'Órdenes Canceladas', 'Valor': m.ordenesCanceladas },
      { 'Métrica Financiera': 'Total de Operaciones Registradas', 'Valor': m.totalOrdenes },
      { 'Métrica Financiera': 'Fecha de Emisión del Reporte', 'Valor': fechaEmision },
      { 'Métrica Financiera': 'Generado por Administrador', 'Valor': admin ? `${admin.nombre} ${admin.apellido} (${admin.email})` : 'Admin' },
    ];

    const wb = XLSX.utils.book_new();

    const wsDetalle = XLSX.utils.json_to_sheet(filasDetalle);
    const wsResumen = XLSX.utils.json_to_sheet(filasResumen);

    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Planilla Contable');
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Contable');

    const timestamp = ahora.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    XLSX.writeFile(wb, `Reporte_Contable_Facturacion_${timestamp}.xlsx`);
  }
}
