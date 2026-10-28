-- Herramientas de demostración para ocupar/liberar butacas en una función.
-- Los asientos demo no crean compras, no generan ingresos y no cuentan como ventas.

ALTER TABLE public.asientos_funcion
  ADD COLUMN IF NOT EXISTS es_demo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.simular_sala_llena_demo(p_funcion_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agregados INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id::TEXT = auth.uid()::TEXT AND rol = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede simular asientos.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.funciones
    WHERE id::TEXT = p_funcion_id::TEXT AND estado = 'programada'
  ) THEN
    RAISE EXCEPTION 'La función no existe o no está programada.';
  END IF;

  -- Limpia únicamente retenciones vencidas; nunca modifica butacas reales activas.
  DELETE FROM public.asientos_funcion
  WHERE funcion_id::TEXT = p_funcion_id::TEXT
    AND estado = 'reservado'
    AND expira_en IS NOT NULL
    AND expira_en <= now();

  WITH filas AS (
    SELECT n,
      chr(64 + n) AS letra,
      CASE WHEN n IN (10, 11) THEN 14 ELSE 28 END AS cantidad
    FROM generate_series(1, 20) AS serie(n)
  ), butacas AS (
    SELECT f.letra || '-' || s.numero AS asiento_id
    FROM filas f
    CROSS JOIN LATERAL generate_series(1, f.cantidad) AS s(numero)
  ), disponibles AS (
    SELECT b.asiento_id
    FROM butacas b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.asientos_funcion af
      WHERE af.funcion_id::TEXT = p_funcion_id::TEXT
        AND af.asiento_id::TEXT = b.asiento_id
    )
  ), filas_insertadas AS (
    INSERT INTO public.asientos_funcion
      (funcion_id, asiento_id, sesion_id, sesion_hash, estado, expira_en, es_demo)
    SELECT r.funcion_id, r.asiento_id, r.sesion_id, r.sesion_hash, r.estado, r.expira_en, r.es_demo
    FROM disponibles d
    CROSS JOIN LATERAL jsonb_populate_record(
      NULL::public.asientos_funcion,
      jsonb_build_object(
        'funcion_id', p_funcion_id::TEXT,
        'asiento_id', d.asiento_id,
        'sesion_id', gen_random_uuid()::TEXT,
        'sesion_hash', md5(gen_random_uuid()::TEXT),
        'estado', 'vendido',
        'expira_en', NULL,
        'es_demo', TRUE
      )
    ) AS r
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_agregados FROM filas_insertadas;

  RETURN v_agregados;
END;
$$;

CREATE OR REPLACE FUNCTION public.liberar_asientos_demo(
  p_funcion_id UUID,
  p_cantidad INTEGER,
  p_tipo TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_liberados INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id::TEXT = auth.uid()::TEXT AND rol = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede liberar asientos demo.';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad < 1 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor que cero.';
  END IF;
  IF p_tipo NOT IN ('comun', 'vip', 'discapacitado') THEN
    RAISE EXCEPTION 'El tipo de asiento no es válido.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.funciones
    WHERE id::TEXT = p_funcion_id::TEXT AND estado = 'programada'
  ) THEN
    RAISE EXCEPTION 'La función no existe o no está programada.';
  END IF;

  WITH demo_a_liberar AS (
    SELECT ctid
    FROM public.asientos_funcion
    WHERE funcion_id::TEXT = p_funcion_id::TEXT
      AND estado = 'vendido'
      AND es_demo IS TRUE
      AND CASE
        WHEN split_part(asiento_id::TEXT, '-', 1) IN ('J', 'K') THEN p_tipo = 'discapacitado'
        WHEN split_part(asiento_id::TEXT, '-', 1) IN ('R', 'S', 'T') THEN p_tipo = 'vip'
        ELSE p_tipo = 'comun'
      END
    ORDER BY asiento_id
    LIMIT p_cantidad
  ), eliminados AS (
    DELETE FROM public.asientos_funcion af
    USING demo_a_liberar d
    WHERE af.ctid = d.ctid
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_liberados FROM eliminados;

  RETURN v_liberados;
END;
$$;

REVOKE ALL ON FUNCTION public.simular_sala_llena_demo(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.liberar_asientos_demo(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simular_sala_llena_demo(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_asientos_demo(UUID, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
