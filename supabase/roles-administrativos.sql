-- Roles administrativos configurables por secciones y asignables a usuarios.
-- Ejecutar una vez en Supabase SQL Editor. El rol base admin siempre conserva acceso total.

CREATE TABLE IF NOT EXISTS public.roles_administrativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  secciones TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_administrativos_nombre_ci
  ON public.roles_administrativos (lower(nombre));

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS rol_personalizado_id UUID
  REFERENCES public.roles_administrativos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_rol_personalizado
  ON public.usuarios(rol_personalizado_id);

ALTER TABLE public.roles_administrativos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins administran roles personalizados" ON public.roles_administrativos;
CREATE POLICY "Admins administran roles personalizados"
  ON public.roles_administrativos FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id::TEXT = auth.uid()::TEXT AND u.rol = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id::TEXT = auth.uid()::TEXT AND u.rol = 'admin'
  ));

CREATE OR REPLACE FUNCTION public.es_admin_cinetp()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id::TEXT = auth.uid()::TEXT AND rol = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.obtener_secciones_admin_usuario()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario public.usuarios%ROWTYPE;
BEGIN
  SELECT * INTO v_usuario FROM public.usuarios WHERE id::TEXT = auth.uid()::TEXT;
  IF NOT FOUND THEN RETURN ARRAY[]::TEXT[]; END IF;

  IF v_usuario.rol = 'admin' THEN
    RETURN ARRAY['peliculas','propuestas','funciones','candy','salas','cupones','empleados','auditoria','facturacion','graficos']::TEXT[];
  END IF;

  RETURN COALESCE((
    SELECT r.secciones
    FROM public.roles_administrativos r
    WHERE r.id = v_usuario.rol_personalizado_id AND r.activo = TRUE
  ), ARRAY[]::TEXT[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_listar_roles()
RETURNS TABLE(id UUID, nombre TEXT, secciones TEXT[], activo BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.es_admin_cinetp() THEN
    RAISE EXCEPTION 'Solo un administrador puede gestionar roles.';
  END IF;
  RETURN QUERY
    SELECT r.id, r.nombre, r.secciones, r.activo
    FROM public.roles_administrativos r
    ORDER BY lower(r.nombre);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_listar_usuarios_roles()
RETURNS TABLE(
  id UUID,
  email TEXT,
  nombre TEXT,
  apellido TEXT,
  rol TEXT,
  rol_personalizado_id UUID,
  rol_personalizado_nombre TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.es_admin_cinetp() THEN
    RAISE EXCEPTION 'Solo un administrador puede asignar roles.';
  END IF;
  RETURN QUERY
    SELECT u.id::UUID, u.email::TEXT, COALESCE(u.nombre, '')::TEXT,
      COALESCE(u.apellido, '')::TEXT, COALESCE(u.rol, 'cliente')::TEXT,
      u.rol_personalizado_id, r.nombre::TEXT
    FROM public.usuarios u
    LEFT JOIN public.roles_administrativos r ON r.id = u.rol_personalizado_id
    ORDER BY lower(COALESCE(u.apellido, '') || ' ' || COALESCE(u.nombre, ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_guardar_rol(
  p_rol_id UUID,
  p_nombre TEXT,
  p_secciones TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_secciones TEXT[] := COALESCE(p_secciones, ARRAY[]::TEXT[]);
  v_validas CONSTANT TEXT[] := ARRAY['peliculas','propuestas','funciones','candy','salas','cupones','empleados','auditoria','facturacion','graficos']::TEXT[];
BEGIN
  IF NOT public.es_admin_cinetp() THEN
    RAISE EXCEPTION 'Solo un administrador puede guardar roles.';
  END IF;
  IF NULLIF(trim(p_nombre), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre del rol es obligatorio.';
  END IF;
  IF cardinality(v_secciones) = 0 THEN
    RAISE EXCEPTION 'Seleccioná al menos una sección.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_secciones) s WHERE NOT (s = ANY(v_validas))) THEN
    RAISE EXCEPTION 'El rol contiene una sección inválida.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.roles_administrativos r
    WHERE lower(r.nombre) = lower(trim(p_nombre))
      AND (p_rol_id IS NULL OR r.id <> p_rol_id)
  ) THEN
    RAISE EXCEPTION 'Ya existe un rol con ese nombre.';
  END IF;

  IF p_rol_id IS NULL THEN
    INSERT INTO public.roles_administrativos(nombre, secciones)
    VALUES (trim(p_nombre), ARRAY(SELECT DISTINCT s FROM unnest(v_secciones) AS t(s) ORDER BY s))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.roles_administrativos
    SET nombre = trim(p_nombre),
        secciones = ARRAY(SELECT DISTINCT s FROM unnest(v_secciones) AS t(s) ORDER BY s),
        actualizado_en = now()
    WHERE id = p_rol_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'No se encontró el rol a editar.'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_asignar_rol_usuario(p_usuario_id UUID, p_rol_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.es_admin_cinetp() THEN
    RAISE EXCEPTION 'Solo un administrador puede asignar roles.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_usuario_id) THEN
    RAISE EXCEPTION 'No se encontró el usuario.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_usuario_id AND rol = 'admin') THEN
    RAISE EXCEPTION 'El administrador ya tiene todos los permisos y no requiere un rol personalizado.';
  END IF;
  IF p_rol_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.roles_administrativos WHERE id = p_rol_id AND activo = TRUE
  ) THEN
    RAISE EXCEPTION 'El rol seleccionado no existe o está inactivo.';
  END IF;

  UPDATE public.usuarios SET rol_personalizado_id = p_rol_id WHERE id = p_usuario_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.es_admin_cinetp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_secciones_admin_usuario() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_listar_roles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_listar_usuarios_roles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_guardar_rol(UUID, TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_asignar_rol_usuario(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_secciones_admin_usuario() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listar_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listar_usuarios_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_guardar_rol(UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_asignar_rol_usuario(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
