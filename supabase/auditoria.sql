-- ==============================================================================
-- Tabla: auditoria
-- Descripción: Registro de auditoría del sistema (creación/edición de películas,
-- funciones, compras de funciones, escaneo de QR y cancelaciones de compras).
-- ==============================================================================

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accion TEXT NOT NULL,
  detalle TEXT,
  usuario_id UUID,
  usuario_nombre TEXT,
  usuario_email TEXT,
  usuario_rol TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Asegurar columnas nuevas en caso de que la tabla ya existiese previamente
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS usuario_nombre TEXT;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS usuario_rol TEXT;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS usuario_email TEXT;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS accion TEXT;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS detalle TEXT;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW();

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- 4. Limpiar políticas anteriores para evitar bloqueos
DROP POLICY IF EXISTS "Permitir insertar auditoria" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir leer auditoria" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir acceso total auditoria" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir insertar auditoria para todos" ON public.auditoria;
DROP POLICY IF EXISTS "Permitir lectura auditoria para todos" ON public.auditoria;

-- 5. Crear políticas de RLS para inserción y lectura
CREATE POLICY "Permitir insertar auditoria"
  ON public.auditoria
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir lectura auditoria"
  ON public.auditoria
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 6. Otorgar permisos a los roles anon y authenticated
GRANT ALL ON TABLE public.auditoria TO anon, authenticated;

-- 7. Publicación en Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'auditoria'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auditoria;
  END IF;
END;
$$;
