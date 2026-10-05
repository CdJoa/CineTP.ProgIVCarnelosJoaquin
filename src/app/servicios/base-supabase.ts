import { inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from './supabase-client';

export function camelToSnakeKey(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase();
}

export function objectToSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[camelToSnakeKey(key)] = value;
    }
  }
  return result;
}

export abstract class BaseSupabaseService<T> {
  protected readonly supabase: SupabaseClient = inject(SupabaseClientService).client;
  protected abstract readonly nombreTabla: string;

  protected abstract mapear(data: Record<string, any>): T;

  async obtenerTodos(ordenColumna: string = 'id', ascendente: boolean = true): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(this.nombreTabla)
      .select('*')
      .order(ordenColumna, { ascending: ascendente });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((item) => this.mapear(item));
  }

  async obtenerPorId(id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(this.nombreTabla)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return null;
    }

    return this.mapear(data);
  }

  async insertar(payload: Record<string, any>): Promise<T> {
    const { data, error } = await this.supabase
      .from(this.nombreTabla)
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return this.mapear(data);
  }

  async actualizar(id: string, payload: Record<string, any>): Promise<T> {
    const { data, error } = await this.supabase
      .from(this.nombreTabla)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return this.mapear(data);
  }

  async actualizarAuto(id: string, payload: Record<string, any>): Promise<T> {
    const snakePayload = objectToSnakeCase(payload);
    return this.actualizar(id, snakePayload);
  }

  async insertarAuto(payload: Record<string, any>): Promise<T> {
    const snakePayload = objectToSnakeCase(payload);
    return this.insertar(snakePayload);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.nombreTabla)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
