-- Cancelación administrativa de funciones: aplicar en Supabase SQL Editor.
-- La operación de cancelación, acreditación, liberación de butacas y notificaciones
-- se ejecuta en una única transacción PostgreSQL.

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS credito_usado NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info',
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_creado
  ON public.notificaciones(usuario_id, creado_en DESC);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios leen sus notificaciones" ON public.notificaciones;
CREATE POLICY "Usuarios leen sus notificaciones"
  ON public.notificaciones FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "Usuarios marcan sus notificaciones" ON public.notificaciones;
CREATE POLICY "Usuarios marcan sus notificaciones"
  ON public.notificaciones FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Impide que se agreguen ventas a una función cancelada y serializa la inserción
-- de compras con la cancelación (ambas operaciones bloquean la fila de función).
CREATE OR REPLACE FUNCTION public.validar_funcion_compra_activa()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado TEXT;
BEGIN
  SELECT estado INTO v_estado
  FROM public.funciones
  WHERE id::TEXT = NEW.funcion_id::TEXT
  FOR UPDATE;

  IF NOT FOUND OR v_estado <> 'programada' THEN
    RAISE EXCEPTION 'La función ya no está disponible para la compra.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_validar_funcion_compra_activa ON public.compras;
CREATE TRIGGER tr_validar_funcion_compra_activa
  BEFORE INSERT ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.validar_funcion_compra_activa();

DROP TRIGGER IF EXISTS tr_validar_funcion_asiento_activa ON public.asientos_funcion;
CREATE TRIGGER tr_validar_funcion_asiento_activa
  BEFORE INSERT OR UPDATE ON public.asientos_funcion
  FOR EACH ROW EXECUTE FUNCTION public.validar_funcion_compra_activa();

-- Confirma únicamente reservas vigentes que pertenezcan a la sesión que las creó.
CREATE OR REPLACE FUNCTION public.confirmar_asientos(
  p_funcion_id UUID,
  p_asientos TEXT[],
  p_session_id UUID,
  p_session_token UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmados INTEGER;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'La sesión de reserva no es válida.';
  END IF;

  UPDATE public.asientos_funcion
  SET estado = 'vendido', expira_en = NULL
  WHERE funcion_id::TEXT = p_funcion_id::TEXT
    AND asiento_id = ANY(COALESCE(p_asientos, ARRAY[]::TEXT[]))
    AND sesion_id::TEXT = p_session_id::TEXT
    AND estado = 'reservado'
    AND expira_en > now();

  GET DIAGNOSTICS v_confirmados = ROW_COUNT;
  RETURN v_confirmados;
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_asientos(UUID, TEXT[], UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_asientos(UUID, TEXT[], UUID, UUID) TO authenticated, anon;

-- Registra la compra y descuenta crédito en la misma transacción.
CREATE OR REPLACE FUNCTION public.crear_compra_con_credito(
  p_compra JSONB,
  p_aplicar_credito BOOLEAN DEFAULT FALSE,
  p_session_id UUID DEFAULT NULL,
  p_session_token UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_total NUMERIC(12, 2);
  v_credito_usado NUMERIC(12, 2) := 0;
  v_credito_actual NUMERIC(12, 2) := 0;
  v_asientos_confirmados INTEGER;
  v_compra public.compras%ROWTYPE;
BEGIN
  PERFORM id FROM public.funciones
  WHERE id::TEXT = NULLIF(p_compra->>'funcion_id', '')
    AND estado = 'programada'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La función ya no está disponible para la compra.';
  END IF;

  SELECT public.confirmar_asientos(
    NULLIF(p_compra->>'funcion_id', '')::UUID,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_compra->'asientos', '[]'::jsonb))),
    p_session_id,
    p_session_token
  ) INTO v_asientos_confirmados;
  IF v_asientos_confirmados <> jsonb_array_length(COALESCE(p_compra->'asientos', '[]'::jsonb)) THEN
    RAISE EXCEPTION 'No se pudieron confirmar todas las butacas. Actualiza la selección e intenta nuevamente.';
  END IF;

  v_usuario_id := NULLIF(p_compra->>'usuario_id', '')::UUID;
  v_total := GREATEST(COALESCE((p_compra->>'total_final')::NUMERIC, 0), 0);

  IF v_usuario_id IS NOT NULL THEN
    IF auth.uid() IS DISTINCT FROM v_usuario_id THEN
      RAISE EXCEPTION 'No puedes crear compras para otra cuenta.';
    END IF;
    IF p_aplicar_credito THEN
      UPDATE public.usuarios
      SET credito = GREATEST(COALESCE(credito, 0), 0)
      WHERE id::TEXT = v_usuario_id::TEXT;
      SELECT credito INTO v_credito_actual
      FROM public.usuarios WHERE id::TEXT = v_usuario_id::TEXT FOR UPDATE;
      v_credito_usado := LEAST(v_credito_actual, v_total);
      UPDATE public.usuarios
      SET credito = credito - v_credito_usado
      WHERE id::TEXT = v_usuario_id::TEXT
      RETURNING credito INTO v_credito_actual;
    END IF;
  ELSIF p_aplicar_credito THEN
    RAISE EXCEPTION 'Debes iniciar sesión para usar crédito.';
  END IF;

  INSERT INTO public.compras (
    codigo, usuario_id, funcion_id, pelicula_id, asientos, total_entradas,
    items_candy, total_candy, descuento, cupon_codigo, total_final,
    puntos_ganados, qr_data, estado, credito_usado
  ) VALUES (
    p_compra->>'codigo', v_usuario_id,
    NULLIF(p_compra->>'funcion_id', '')::UUID,
    NULLIF(p_compra->>'pelicula_id', '')::UUID,
    COALESCE(p_compra->'asientos', '[]'::jsonb),
    COALESCE((p_compra->>'total_entradas')::NUMERIC, 0),
    COALESCE(p_compra->'items_candy', '[]'::jsonb),
    COALESCE((p_compra->>'total_candy')::NUMERIC, 0),
    COALESCE((p_compra->>'descuento')::NUMERIC, 0),
    NULLIF(p_compra->>'cupon_codigo', ''), v_total,
    COALESCE((p_compra->>'puntos_ganados')::INTEGER, 0),
    COALESCE(p_compra->>'qr_data', ''), 'confirmada', v_credito_usado
  ) RETURNING * INTO v_compra;

  RETURN to_jsonb(v_compra) || jsonb_build_object('credito_actual', v_credito_actual);
END;
$$;

REVOKE ALL ON FUNCTION public.crear_compra_con_credito(JSONB, BOOLEAN, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_compra_con_credito(JSONB, BOOLEAN, UUID, UUID) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.cancelar_funcion(p_funcion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_funcion public.funciones%ROWTYPE;
  v_total_usuarios INTEGER;
  v_total_compras INTEGER;
  v_credito_total NUMERIC(12, 2);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id::TEXT = auth.uid()::TEXT AND rol = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede cancelar funciones.';
  END IF;

  SELECT * INTO v_funcion
  FROM public.funciones
  WHERE id::TEXT = p_funcion_id::TEXT
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La función no existe.';
  END IF;
  IF v_funcion.estado <> 'programada' THEN
    RAISE EXCEPTION 'Solo se pueden cancelar funciones programadas.';
  END IF;

  -- Mantiene estable el conjunto de compras mientras se calcula y se acredita.
  PERFORM id FROM public.compras
  WHERE funcion_id::TEXT = p_funcion_id::TEXT AND estado <> 'cancelada'
  ORDER BY id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.compras
    WHERE funcion_id::TEXT = p_funcion_id::TEXT AND estado <> 'cancelada' AND usuario_id IS NULL
  ) THEN
    RAISE EXCEPTION 'No se puede cancelar: hay compras sin una cuenta de usuario asociada.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.compras c
    LEFT JOIN public.usuarios u ON u.id::TEXT = c.usuario_id::TEXT
    WHERE c.funcion_id::TEXT = p_funcion_id::TEXT AND c.estado <> 'cancelada' AND u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'No se puede cancelar: falta una cuenta de comprador.';
  END IF;

  SELECT COUNT(DISTINCT usuario_id), COUNT(*),
    COALESCE(SUM(total_final), 0)
  INTO v_total_usuarios, v_total_compras, v_credito_total
  FROM public.compras
  WHERE funcion_id::TEXT = p_funcion_id::TEXT AND estado <> 'cancelada';

  -- Una única actualización agregada por cuenta evita sobrescribir saldos
  -- cuando un usuario compró más de una vez para esta función.
  UPDATE public.usuarios u
  SET credito = COALESCE(u.credito, 0) + saldos.importe
  FROM (
    SELECT usuario_id, SUM(total_final) AS importe
    FROM public.compras
    WHERE funcion_id::TEXT = p_funcion_id::TEXT AND estado <> 'cancelada'
    GROUP BY usuario_id
  ) saldos
  WHERE u.id::TEXT = saldos.usuario_id::TEXT;

  INSERT INTO public.notificaciones (usuario_id, titulo, mensaje, tipo, metadata)
  SELECT c.usuario_id::UUID,
    'Función cancelada',
    format('La función de %s fue cancelada por un inconveniente técnico. Acreditamos $%s a tu cuenta. Puedes elegir otra función de la misma película usando ese crédito.', COALESCE(p.titulo, 'la película'), to_char(SUM(c.total_final), 'FM999999999990.00')),
    'funcion_cancelada',
    jsonb_build_object(
      'pelicula_id', v_funcion.pelicula_id,
      'funcion_id', p_funcion_id,
      'credito', SUM(c.total_final),
      'ruta_reubicacion', '/home?reubicar=' || v_funcion.pelicula_id::TEXT
    )
  FROM public.compras c
  LEFT JOIN public.peliculas p ON p.id::TEXT = v_funcion.pelicula_id::TEXT
  WHERE c.funcion_id::TEXT = p_funcion_id::TEXT AND c.estado <> 'cancelada'
  GROUP BY c.usuario_id, p.titulo;

  UPDATE public.compras
  SET estado = 'cancelada'
  WHERE funcion_id::TEXT = p_funcion_id::TEXT AND estado <> 'cancelada';

  -- Marcar primero la función para que el trigger de lista de espera no oferte
  -- butacas de una función que se está cancelando.
  UPDATE public.funciones SET estado = 'cancelada' WHERE id::TEXT = p_funcion_id::TEXT;

  -- Libera tanto butacas vendidas como reservas temporales de esa función.
  DELETE FROM public.asientos_funcion WHERE funcion_id::TEXT = p_funcion_id::TEXT;

  RETURN jsonb_build_object(
    'funcion_id', p_funcion_id,
    'compras_canceladas', v_total_compras,
    'usuarios_notificados', v_total_usuarios,
    'credito_total', v_credito_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_funcion(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_funcion(UUID) TO authenticated;

-- Fuerza a PostgREST a actualizar su caché de funciones RPC.
NOTIFY pgrst, 'reload schema';
