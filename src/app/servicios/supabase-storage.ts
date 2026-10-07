import { inject, Injectable, WritableSignal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from './supabase-client';

@Injectable({
  providedIn: 'root',
})
export class SupabaseStorageService {
  private supabase: SupabaseClient = inject(SupabaseClientService).client;

  /**
   * Sube una imagen a Supabase Storage y retorna la URL pública.
   * @param file Archivo de imagen a subir.
   * @param bucket Nombre del bucket en Supabase Storage (por defecto 'imagenes').
   */
  async subirImagen(file: File, bucket: string = 'imagenes'): Promise<string> {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.warn('Error al subir imagen a Supabase Storage:', error.message);
      throw error;
    }

    const { data: publicUrlData } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  }

  /**
   * Procesa el evento change de un input file: muestra vista previa local inmediatamente
   * y luego sube el archivo a Supabase Storage actualizando el control del formulario.
   */
  async procesarInputImagen(
    event: Event,
    formGroup: FormGroup,
    controlName: string,
    subiendoSignal?: WritableSignal<boolean>,
    bucket: string = 'imagenes'
  ): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const archivo = input.files[0];

    const reader = new FileReader();
    reader.onload = (e) => {
      formGroup.patchValue({ [controlName]: e.target?.result as string });
    };
    reader.readAsDataURL(archivo);

    if (subiendoSignal) {
      subiendoSignal.set(true);
    }

    try {
      const url = await this.subirImagen(archivo, bucket);
      formGroup.patchValue({ [controlName]: url });
    } catch (error) {
      formGroup.patchValue({ [controlName]: '' });
      console.error('Error al subir imagen a Supabase Storage:', error);
      throw error;
    } finally {
      if (subiendoSignal) {
        subiendoSignal.set(false);
      }
    }
  }
}
