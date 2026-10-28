-- Lista de espera por función, ofertas temporales de butacas y notificaciones in-app.
-- Ejecutar después de cancelacion-funciones.sql. pg_cron se usa para avanzar ofertas
-- vencidas aunque el usuario no tenga abierta la aplicación.

CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.asientos_funcion
  ADD COLUMN IF NOT EXISTS es_demo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.lista_espera_funciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcion_id TEXT NOT NULL,
  pelicula_id TEXT NOT NULL,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  estado TEXT NOT NULL DEFAULT 'espera'
    CHECK (estado IN ('espera', 'ofrecida', 'comprada', 'cancelada', 'vencida')),
  asiento_id TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  oferta_hasta TIMESTAMPTZ,
  actualizada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conserva compatibilidad si ya se ejecutó una versión anterior de este script.
ALTER TABLE public.lista_espera_funciones
  ADD COLUMN IF NOT EXISTS pelicula_id TEXT;
UPDATE public.lista_espera_funciones e
SET pelicula_id = f.pelicula_id::TEXT
FROM public.funciones f
WHERE f.id::TEXT = e.funcion_id
  AND e.pelicula_id IS NULL;
DELETE FROM public.lista_espera_funciones WHERE pelicula_id IS NULL;
ALTER TABLE public.lista_espera_funciones
  ALTER COLUMN pelicula_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lista_espera_usuario_activo
  ON public.lista_espera_funciones(funcion_id, usuario_id)
  WHERE estado IN ('espera', 'ofrecida');
CREATE INDEX IF NOT EXISTS idx_lista_espera_turno
  ON public.lista_espera_funciones(funcion_id, creada_en)
  WHERE estado = 'espera';
CREATE INDEX IF NOT EXISTS idx_lista_espera_ofertas_vencimiento
  ON public.lista_espera_funciones(oferta_hasta)
  WHERE estado = 'ofrecida';

ALTER TABLE public.lista_espera_funciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cada cliente consulta su lista de espera" ON public.lista_espera_funciones;
CREATE POLICY "Cada cliente consulta su lista de espera"
  ON public.lista_espera_funciones FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lista_espera_funciones;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.unirse_lista_espera(p_funcion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario UUID := auth.uid();
  v_funcion TEXT := p_funcion_id::TEXT;
  v_pelicula TEXT;
  v_entrada public.lista_espera_funciones%ROWTYPE;
  v_posicion BIGINT;
  v_capacidad BIGINT;
  v_ocupadas BIGINT;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Iniciá sesión para anotarte en la lista de espera.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id::TEXT = v_usuario::TEXT AND rol IN ('cliente', 'empleado', 'admin')
  ) THEN
    RAISE EXCEPTION 'Solo usuarios autenticados pueden anotarse en la lista de espera.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.funciones
    WHERE id::TEXT = v_funcion AND estado = 'programada'
  ) THEN
    RAISE EXCEPTION 'La función no está disponible.';
  END IF;

  SELECT pelicula_id::TEXT INTO v_pelicula
  FROM public.funciones WHERE id::TEXT = v_funcion;

  SELECT s.capacidad_total INTO v_capacidad
  FROM public.funciones f
  JOIN public.salas s ON s.id::TEXT = f.sala_id::TEXT
  WHERE f.id::TEXT = v_funcion;
  SELECT COUNT(*) INTO v_ocupadas
  FROM public.asientos_funcion a
  WHERE a.funcion_id::TEXT = v_funcion
    AND a.estado IN ('reservado', 'vendido')
    AND (a.estado <> 'reservado' OR a.expira_en IS NULL OR a.expira_en > now());
  IF v_capacidad IS NOT NULL AND v_ocupadas < v_capacidad THEN
    RAISE EXCEPTION 'La función todavía tiene butacas disponibles.';
  END IF;

  SELECT * INTO v_entrada
  FROM public.lista_espera_funciones
  WHERE funcion_id = v_funcion AND usuario_id = v_usuario
    AND estado IN ('espera', 'ofrecida')
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.lista_espera_funciones(funcion_id, pelicula_id, usuario_id)
    VALUES (v_funcion, v_pelicula, v_usuario)
    RETURNING * INTO v_entrada;
  END IF;

  IF v_entrada.estado = 'ofrecida' THEN
    v_posicion := 0;
  ELSE
    SELECT COUNT(*) INTO v_posicion
    FROM public.lista_espera_funciones e
    WHERE e.funcion_id = v_funcion
      AND e.estado = 'espera'
      AND (e.creada_en, e.id) <= (v_entrada.creada_en, v_entrada.id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_entrada.id,
    'estado', v_entrada.estado,
    'posicion', v_posicion,
    'asiento_id', v_entrada.asiento_id,
    'oferta_hasta', v_entrada.oferta_hasta
  );
END;
$$;

-- La salida incluye ahora pelicula_id; PostgreSQL requiere recrear la RPC cuando
-- cambia el tipo/orden de columnas devueltas por RETURNS TABLE.
DROP FUNCTION IF EXISTS public.obtener_mis_listas_espera();
CREATE FUNCTION public.obtener_mis_listas_espera()
RETURNS TABLE (
  id UUID,
  funcion_id TEXT,
  pelicula_id TEXT,
  pelicula_titulo TEXT,
  sala_nombre TEXT,
  inicio TIMESTAMPTZ,
  estado TEXT,
  posicion BIGINT,
  asiento_id TEXT,
  oferta_hasta TIMESTAMPTZ,
  creada_en TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.funcion_id, e.pelicula_id,
    COALESCE(p.titulo, 'Película')::TEXT,
    COALESCE(s.nombre, 'Sala')::TEXT,
    f.inicio::TIMESTAMPTZ,
    e.estado,
    CASE WHEN e.estado = 'ofrecida' THEN 0 ELSE (
      SELECT COUNT(*) FROM public.lista_espera_funciones antes
      WHERE antes.funcion_id = e.funcion_id AND antes.estado = 'espera'
        AND (antes.creada_en, antes.id) <= (e.creada_en, e.id)
    ) END,
    e.asiento_id, e.oferta_hasta, e.creada_en
  FROM public.lista_espera_funciones e
  LEFT JOIN public.funciones f ON f.id::TEXT = e.funcion_id
  LEFT JOIN public.peliculas p ON p.id::TEXT = f.pelicula_id::TEXT
  LEFT JOIN public.salas s ON s.id::TEXT = f.sala_id::TEXT
  WHERE e.usuario_id = auth.uid()
    AND e.estado IN ('espera', 'ofrecida')
  ORDER BY e.creada_en DESC;
$$;

CREATE OR REPLACE FUNCTION public.salir_lista_espera(p_entrada_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrada public.lista_espera_funciones%ROWTYPE;
BEGIN
  SELECT * INTO v_entrada
  FROM public.lista_espera_funciones
  WHERE id = p_entrada_id AND usuario_id = auth.uid()
    AND estado IN ('espera', 'ofrecida')
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE public.lista_espera_funciones
  SET estado = 'cancelada', actualizada_en = now()
  WHERE id = p_entrada_id;

  IF v_entrada.estado = 'ofrecida' AND v_entrada.asiento_id IS NOT NULL THEN
    DELETE FROM public.asientos_funcion
    WHERE funcion_id::TEXT = v_entrada.funcion_id
      AND asiento_id::TEXT = v_entrada.asiento_id
      AND sesion_id::TEXT = v_entrada.usuario_id::TEXT
      AND estado = 'reservado';
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_conteos_lista_espera()
RETURNS TABLE(funcion_id TEXT, cantidad BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id::TEXT = auth.uid()::TEXT AND rol = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar las listas de espera.';
  END IF;

  RETURN QUERY
  SELECT e.funcion_id,
    COUNT(*) FILTER (WHERE e.estado IN ('espera', 'ofrecida'))::BIGINT
  FROM public.lista_espera_funciones e
  GROUP BY e.funcion_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tomar_oferta_lista_espera(
  p_funcion_id UUID,
  p_session_id UUID,
  p_session_token UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrada public.lista_espera_funciones%ROWTYPE;
  v_actualizado INTEGER;
BEGIN
  SELECT * INTO v_entrada
  FROM public.lista_espera_funciones
  WHERE funcion_id = p_funcion_id::TEXT
    AND usuario_id = auth.uid()
    AND estado = 'ofrecida'
    AND oferta_hasta > now()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE public.asientos_funcion
  SET sesion_id = p_session_id,
      sesion_hash = md5(p_session_token::TEXT)
  WHERE funcion_id::TEXT = v_entrada.funcion_id
    AND asiento_id::TEXT = v_entrada.asiento_id
    AND sesion_id::TEXT IN (v_entrada.usuario_id::TEXT, p_session_id::TEXT)
    AND estado = 'reservado'
    AND expira_en > now();
  GET DIAGNOSTICS v_actualizado = ROW_COUNT;

  IF v_actualizado = 0 THEN
    RAISE EXCEPTION 'La butaca ofertada ya no está disponible. Actualizá la función.';
  END IF;
  RETURN v_entrada.asiento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.promover_siguiente_lista_espera(
  p_funcion_id TEXT,
  p_asiento_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrada public.lista_espera_funciones%ROWTYPE;
  v_funcion_activa BOOLEAN;
  v_vence TIMESTAMPTZ := now() + INTERVAL '15 minutes';
BEGIN
  SELECT (estado = 'programada') INTO v_funcion_activa
  FROM public.funciones WHERE id::TEXT = p_funcion_id;
  IF NOT COALESCE(v_funcion_activa, FALSE) THEN RETURN; END IF;

  -- Serializa promociones para esta butaca: una liberación da una única oferta
  -- al primer usuario de la cola, nunca a todos los anotados.
  PERFORM pg_advisory_xact_lock(hashtext(p_funcion_id), hashtext(p_asiento_id));

  IF EXISTS (
    SELECT 1 FROM public.lista_espera_funciones
    WHERE funcion_id = p_funcion_id
      AND asiento_id = p_asiento_id
      AND estado = 'ofrecida'
      AND oferta_hasta > now()
  ) THEN
    RETURN;
  END IF;

  -- Si la butaca ya fue reservada o vendida por otro flujo, no se la ofertes
  -- a una segunda persona.
  IF EXISTS (
    SELECT 1 FROM public.asientos_funcion
    WHERE funcion_id::TEXT = p_funcion_id
      AND asiento_id::TEXT = p_asiento_id
  ) THEN
    RETURN;
  END IF;

  UPDATE public.lista_espera_funciones
  SET estado = 'vencida', actualizada_en = now()
  WHERE funcion_id = p_funcion_id AND asiento_id = p_asiento_id
    AND estado = 'ofrecida' AND oferta_hasta <= now();

  SELECT * INTO v_entrada
  FROM public.lista_espera_funciones
  WHERE funcion_id = p_funcion_id AND estado = 'espera'
  -- FIFO estricto: el más antiguo recibe primero los 15 minutos.
  ORDER BY creada_en, id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.lista_espera_funciones
  SET estado = 'ofrecida', asiento_id = p_asiento_id,
      oferta_hasta = v_vence, actualizada_en = now()
  WHERE id = v_entrada.id;

  INSERT INTO public.asientos_funcion
    (funcion_id, asiento_id, sesion_id, sesion_hash, estado, expira_en, es_demo)
  SELECT r.funcion_id, r.asiento_id, r.sesion_id, r.sesion_hash, r.estado, r.expira_en, r.es_demo
  FROM jsonb_populate_record(
    NULL::public.asientos_funcion,
    jsonb_build_object(
      'funcion_id', p_funcion_id,
      'asiento_id', p_asiento_id,
      'sesion_id', v_entrada.usuario_id::TEXT,
      'sesion_hash', md5(gen_random_uuid()::TEXT),
      'estado', 'reservado',
      'expira_en', v_vence,
      'es_demo', FALSE
    )
  ) AS r;

  INSERT INTO public.notificaciones(usuario_id, titulo, mensaje, tipo, metadata)
  SELECT v_entrada.usuario_id,
    '¡Se liberó una butaca!',
    format('Tenés 15 minutos para comprar la butaca %s para %s.', p_asiento_id, COALESCE(p.titulo, 'la película')),
    'lista_espera',
    jsonb_build_object(
      'funcion_id', p_funcion_id,
      'asiento_id', p_asiento_id,
      'lista_espera_id', v_entrada.id,
      'oferta_hasta', v_vence
    )
  FROM public.funciones f
  LEFT JOIN public.peliculas p ON p.id::TEXT = f.pelicula_id::TEXT
  WHERE f.id::TEXT = p_funcion_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.al_liberar_asiento_promover_lista_espera()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.es_demo, FALSE) IS FALSE THEN
    PERFORM public.promover_siguiente_lista_espera(OLD.funcion_id::TEXT, OLD.asiento_id::TEXT);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_promover_lista_espera_asiento_liberado ON public.asientos_funcion;
CREATE TRIGGER tr_promover_lista_espera_asiento_liberado
  AFTER DELETE ON public.asientos_funcion
  FOR EACH ROW EXECUTE FUNCTION public.al_liberar_asiento_promover_lista_espera();

CREATE OR REPLACE FUNCTION public.al_confirmar_asiento_cerrar_oferta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado = 'reservado' AND NEW.estado = 'vendido' THEN
    UPDATE public.lista_espera_funciones
    SET estado = 'comprada', actualizada_en = now()
    WHERE funcion_id = NEW.funcion_id::TEXT
      AND asiento_id = NEW.asiento_id::TEXT
      AND estado = 'ofrecida';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_cerrar_oferta_lista_espera ON public.asientos_funcion;
CREATE TRIGGER tr_cerrar_oferta_lista_espera
  AFTER UPDATE OF estado ON public.asientos_funcion
  FOR EACH ROW EXECUTE FUNCTION public.al_confirmar_asiento_cerrar_oferta();

CREATE OR REPLACE FUNCTION public.procesar_ofertas_lista_espera_vencidas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_procesadas INTEGER := 0;
  v_oferta RECORD;
BEGIN
  FOR v_oferta IN
    SELECT e.funcion_id, e.asiento_id
    FROM public.lista_espera_funciones e
    WHERE e.estado = 'ofrecida' AND e.oferta_hasta <= now()
    ORDER BY e.oferta_hasta
    FOR UPDATE SKIP LOCKED
  LOOP
    DELETE FROM public.asientos_funcion
    WHERE funcion_id::TEXT = v_oferta.funcion_id
      AND asiento_id::TEXT = v_oferta.asiento_id
      AND estado = 'reservado'
      AND expira_en <= now();
    v_procesadas := v_procesadas + 1;
  END LOOP;
  RETURN v_procesadas;
END;
$$;

REVOKE ALL ON FUNCTION public.unirse_lista_espera(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_mis_listas_espera() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salir_lista_espera(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_conteos_lista_espera() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tomar_oferta_lista_espera(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unirse_lista_espera(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_mis_listas_espera() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salir_lista_espera(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_conteos_lista_espera() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tomar_oferta_lista_espera(UUID, UUID, UUID) TO authenticated;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'procesar-ofertas-lista-espera'
    LOOP
      PERFORM cron.unschedule(v_job_id);
    END LOOP;
    PERFORM cron.schedule(
      'procesar-ofertas-lista-espera',
      '* * * * *',
      $job$SELECT public.procesar_ofertas_lista_espera_vencidas();$job$
    );
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
