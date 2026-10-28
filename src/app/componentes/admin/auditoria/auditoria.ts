import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditoriaService } from '../../../servicios/auditoria';
import { AccionAuditoria, RegistroAuditoria } from '../../../models/auditoria';

const NOMBRES_ACCION: Record<string, string> = {
  pelicula_creada: 'Película creada',
  pelicula_editada: 'Película editada',
  funcion_creada: 'Función creada',
  funcion_editada: 'Función editada',
  compra_realizada: 'Compra de función',
  lectura_qr: 'Escaneo de QR',
  compra_cancelada: 'Cancelación de compra',
  precio_modificado: 'Precio modificado',
  funcion_cancelada: 'Función cancelada',
  funcion_estado_modificado: 'Estado de función',
  funcion_eliminada: 'Función eliminada',
  butacas_demo_simuladas: 'Butacas demo ocupadas',
  butacas_demo_liberadas: 'Butacas demo liberadas',
  sala_creada: 'Sala creada',
  sala_editada: 'Sala editada',
  producto_candy_creado: 'Producto Candy creado',
  producto_candy_editado: 'Producto Candy editado',
  cupon_creado: 'Cupón creado',
  cupon_editado: 'Cupón editado',
  empleado_registrado: 'Empleado registrado',
  rol_creado: 'Rol creado',
  rol_editado: 'Rol editado',
  rol_asignado: 'Rol asignado',
  propuesta_pelicula_creada: 'Propuesta enviada',
  propuesta_pelicula_aceptada: 'Propuesta aceptada',
  propuesta_pelicula_rechazada: 'Propuesta rechazada',
  propuesta_pelicula_cancelada: 'Propuesta cancelada',
  resena_creada: 'Reseña publicada',
  resena_eliminada: 'Reseña eliminada',
};

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auditoria.html',
  styleUrl: './auditoria.css',
})
export class Auditoria implements OnInit {
  private auditoriaService = inject(AuditoriaService);

  registros = signal<RegistroAuditoria[]>([]);
  cargando = signal<boolean>(true);
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.registros.set(await this.auditoriaService.obtenerRegistros());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'No se pudo cargar la auditoría.');
    } finally {
      this.cargando.set(false);
    }
  }

  nombreAccion(accion: AccionAuditoria): string {
    return NOMBRES_ACCION[accion] || accion;
  }

  formatearFechaHora(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
  }
}
