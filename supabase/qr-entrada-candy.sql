-- QR único con dos validaciones independientes: ingreso a sala y retiro de Candy Bar.
-- Cada una se puede usar una sola vez. Ejecutar completo en el SQL Editor de Supabase.

alter table public.compras
  add column if not exists entrada_usada_en timestamptz,
  add column if not exists candy_entregado_en timestamptz;

-- Las compras que ya estaban 'usado' se consideran con la entrada validada.
update public.compras
set entrada_usada_en = coalesce(entrada_usada_en, now())
where estado = 'usado';

comment on column public.compras.entrada_usada_en is 'Momento en que se validó el QR en la puerta de la sala';
comment on column public.compras.candy_entregado_en is 'Momento en que se validó el QR en el Candy Bar';

-- Recargar el esquema de PostgREST para que la API vea las columnas nuevas.
notify pgrst, 'reload schema';
