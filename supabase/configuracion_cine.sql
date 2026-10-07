-- ==============================================================================
-- Tabla: configuracion_cine
-- Descripción: Almacena parámetros globales del cine (tarifas y multiplicadores de butacas)
-- ==============================================================================

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS public.configuracion_cine (
  id TEXT PRIMARY KEY,
  multiplicador_comun NUMERIC NOT NULL DEFAULT 1,
  multiplicador_vip NUMERIC NOT NULL DEFAULT 1.5,
  multiplicador_discapacitado NUMERIC NOT NULL DEFAULT 1,
  precio_base_referencia NUMERIC NOT NULL DEFAULT 5000, -- Valor de muestra/simulador en panel
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.configuracion_cine ENABLE ROW LEVEL SECURITY;

-- 3. Limpiar políticas anteriores si existían
DROP POLICY IF EXISTS "Permitir lectura publica de configuracion" ON public.configuracion_cine;
DROP POLICY IF EXISTS "Permitir modificacion de configuracion" ON public.configuracion_cine;
DROP POLICY IF EXISTS "Permitir acceso total configuracion_cine" ON public.configuracion_cine;

-- 4. Política compatible 100% con PostgreSQL para acceso total
CREATE POLICY "Permitir acceso total configuracion_cine"
  ON public.configuracion_cine
  FOR ALL
  TO public
  USING (true);

-- 5. Insertar registro inicial si no existe
INSERT INTO public.configuracion_cine (id, multiplicador_comun, multiplicador_vip, multiplicador_discapacitado, precio_base_referencia)
VALUES ('tarifas_butacas', 1, 1.5, 1, 5000)
ON CONFLICT (id) DO NOTHING;
