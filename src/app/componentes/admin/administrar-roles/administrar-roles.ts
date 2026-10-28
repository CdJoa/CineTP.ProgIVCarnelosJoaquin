import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  RolAdministrativo,
  RolesAdminService,
  SECCIONES_ADMIN,
  UsuarioAsignable,
} from '../../../servicios/roles-admin';

@Component({
  selector: 'app-administrar-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './administrar-roles.html',
  styleUrl: './administrar-roles.css',
})
export class AdministrarRolesComponent implements OnInit {
  private rolesService = inject(RolesAdminService);
  readonly secciones = SECCIONES_ADMIN;

  roles = signal<RolAdministrativo[]>([]);
  usuarios = signal<UsuarioAsignable[]>([]);
  rolSeleccionado = signal<RolAdministrativo | null>(null);
  nombreRol = signal('');
  seccionesSeleccionadas = signal<string[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  error = signal('');
  exito = signal('');
  filtroUsuarios = signal('');

  async ngOnInit(): Promise<void> {
    await this.recargar();
  }

  async recargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const [roles, usuarios] = await Promise.all([
        this.rolesService.listarRoles(),
        this.rolesService.listarUsuarios(),
      ]);
      this.roles.set(roles);
      this.usuarios.set(usuarios);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar roles y usuarios.');
    } finally {
      this.cargando.set(false);
    }
  }

  crearRol(): void {
    this.rolSeleccionado.set(null);
    this.nombreRol.set('');
    this.seccionesSeleccionadas.set([]);
    this.error.set('');
    this.exito.set('');
  }

  editarRol(rol: RolAdministrativo): void {
    this.rolSeleccionado.set(rol);
    this.nombreRol.set(rol.nombre);
    this.seccionesSeleccionadas.set([...rol.secciones]);
    this.error.set('');
    this.exito.set('');
  }

  alternarSeccion(id: string, checked: boolean): void {
    this.seccionesSeleccionadas.update((actuales) => checked
      ? [...new Set([...actuales, id])]
      : actuales.filter((seccion) => seccion !== id));
  }

  async guardarRol(): Promise<void> {
    const nombre = this.nombreRol().trim();
    if (!nombre) {
      this.error.set('Ingresá un nombre para el rol.');
      return;
    }
    if (!this.seccionesSeleccionadas().length) {
      this.error.set('Elegí al menos una sección del administrador.');
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    this.exito.set('');
    try {
      await this.rolesService.guardarRol({
        id: this.rolSeleccionado()?.id,
        nombre,
        secciones: this.seccionesSeleccionadas(),
      });
      this.exito.set('Rol guardado.');
      await this.recargar();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el rol.');
    } finally {
      this.guardando.set(false);
    }
  }

  async asignarRol(usuario: UsuarioAsignable, valor: string): Promise<void> {
    this.error.set('');
    this.exito.set('');
    try {
      const rol = this.roles().find((item) => item.id === valor) || null;
      await this.rolesService.asignarRol(usuario, rol);
      this.usuarios.update((items) => items.map((item) => item.id === usuario.id
        ? {
            ...item,
            rolPersonalizadoId: rol?.id || null,
            rolPersonalizadoNombre: rol?.nombre || null,
          }
        : item));
      this.exito.set(`Permisos actualizados para ${usuario.nombre} ${usuario.apellido}.`);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo asignar el rol.');
      await this.recargar();
    }
  }

  get usuariosFiltrados(): UsuarioAsignable[] {
    const query = this.filtroUsuarios().trim().toLowerCase();
    if (!query) return this.usuarios();
    return this.usuarios().filter((usuario) =>
      `${usuario.nombre} ${usuario.apellido} ${usuario.email} ${usuario.rolPersonalizadoNombre || ''}`
        .toLowerCase()
        .includes(query)
    );
  }
}
