import { Injectable, WritableSignal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { environment } from '../environments/environments';

@Injectable({
  providedIn: 'root',
})
export class CloudinaryService {
  /**
   * Sube una imagen a Cloudinary y retorna la URL pública (secure_url).
   * @param file Archivo de imagen a subir.
   */
  async subirImagen(file: File): Promise<string> {
    const cloudName = environment.cloudinaryCloudName || 'demo';
    const uploadPreset = environment.cloudinaryUploadPreset || 'ml_default';
    const apiKey = environment.cloudinaryApiKey;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    if (apiKey) {
      formData.append('api_key', apiKey);
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || 'Error al subir la imagen a Cloudinary.';
      throw new Error(errorMsg);
    }

    return data.secure_url || data.url;
  }

  /**
   * Procesa el evento change de un input file: muestra vista previa local inmediatamente
   * y luego sube el archivo a Cloudinary actualizando el control del formulario.
   */
  async procesarInputImagen(
    event: Event,
    formGroup: FormGroup,
    controlName: string,
    subiendoSignal?: WritableSignal<boolean>
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
      const url = await this.subirImagen(archivo);
      formGroup.patchValue({ [controlName]: url });
    } catch (error) {
      console.warn('Aviso: Cloudinary no respondió, usando imagen local:', error);
    } finally {
      if (subiendoSignal) {
        subiendoSignal.set(false);
      }
    }
  }
}
