create extension if not exists pgcrypto with schema extensions;

create table if not exists public.asientos_funcion (
  funcion_id text not null,
  asiento_id text not null,
  sesion_id uuid not null,
  sesion_hash text not null,
  usuario_id uuid references auth.users (id) on delete set null,
  estado text not null default 'reservado'
    check (estado in ('reservado', 'vendido')),
  expira_en timestamptz,
  actualizado_en timestamptz not null default now(),
  primary key (funcion_id, asiento_id),
  check (
    (estado = 'reservado' and expira_en is not null)
    or (estado = 'vendido' and expira_en is null)
  )
);

-- Migra instalaciones creadas con la versión anterior que requería login.
alter table public.asientos_funcion add column if not exists sesion_id uuid;
alter table public.asientos_funcion add column if not exists sesion_hash text;
alter table public.asientos_funcion alter column usuario_id drop not null;
update public.asientos_funcion
set sesion_id = coalesce(sesion_id, extensions.gen_random_uuid()),
    sesion_hash = coalesce(sesion_hash, encode(extensions.digest(extensions.gen_random_uuid()::text, 'sha256'), 'hex')),
    expira_en = case when estado = 'reservado' then least(coalesce(expira_en, now()), now()) else null end
where sesion_id is null or sesion_hash is null;
alter table public.asientos_funcion alter column sesion_id set not null;
alter table public.asientos_funcion alter column sesion_hash set not null;

alter table public.asientos_funcion enable row level security;
alter table public.asientos_funcion replica identity full;

revoke all on public.asientos_funcion from anon, authenticated;
grant select on public.asientos_funcion to anon, authenticated;

drop policy if exists "Usuarios autenticados pueden ver estado de asientos" on public.asientos_funcion;
drop policy if exists "Todos pueden ver estado publico de asientos" on public.asientos_funcion;
create policy "Todos pueden ver estado publico de asientos"
  on public.asientos_funcion
  for select
  to anon, authenticated
  using (true);

drop function if exists public.confirmar_asientos(text, text[]);
drop function if exists public.reservar_asiento(text, text);
drop function if exists public.liberar_asiento(text, text);

create or replace function public.reservar_asiento(
  p_funcion_id text,
  p_asiento_id text,
  p_session_id uuid,
  p_session_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  filas_afectadas integer;
  hash_sesion text;
begin
  if p_session_id is null or p_session_token is null or length(p_session_token) < 36 then
    raise exception 'Sesión de reserva inválida.';
  end if;
  hash_sesion := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  insert into public.asientos_funcion (
    funcion_id, asiento_id, sesion_id, sesion_hash, usuario_id, estado, expira_en, actualizado_en
  ) values (
    p_funcion_id, p_asiento_id, p_session_id, hash_sesion, auth.uid(), 'reservado', now() + interval '10 minutes', now()
  )
  on conflict (funcion_id, asiento_id) do update
    set sesion_id = excluded.sesion_id,
        sesion_hash = excluded.sesion_hash,
        usuario_id = excluded.usuario_id,
        estado = 'reservado',
        expira_en = excluded.expira_en,
        actualizado_en = now()
    where public.asientos_funcion.estado = 'reservado'
      and (
        public.asientos_funcion.expira_en <= now()
        or (
          public.asientos_funcion.sesion_id = p_session_id
          and public.asientos_funcion.sesion_hash = hash_sesion
        )
      );

  get diagnostics filas_afectadas = row_count;
  return filas_afectadas > 0;
end;
$$;

create or replace function public.liberar_asiento(
  p_funcion_id text,
  p_asiento_id text,
  p_session_id uuid,
  p_session_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  filas_afectadas integer;
  hash_sesion text;
begin
  if p_session_id is null or p_session_token is null or length(p_session_token) < 36 then
    raise exception 'Sesión de reserva inválida.';
  end if;
  hash_sesion := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  delete from public.asientos_funcion
  where funcion_id = p_funcion_id
    and asiento_id = p_asiento_id
    and sesion_id = p_session_id
    and sesion_hash = hash_sesion
    and estado = 'reservado';

  get diagnostics filas_afectadas = row_count;
  return filas_afectadas > 0;
end;
$$;

create or replace function public.confirmar_asientos(
  p_funcion_id text,
  p_asientos text[],
  p_session_id uuid,
  p_session_token text
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  filas_afectadas integer;
  hash_sesion text;
begin
  if p_session_id is null or p_session_token is null or length(p_session_token) < 36 then
    raise exception 'Sesión de reserva inválida.';
  end if;
  if coalesce(cardinality(p_asientos), 0) = 0 then
    raise exception 'Selecciona al menos un asiento.';
  end if;
  hash_sesion := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  update public.asientos_funcion
  set estado = 'vendido', expira_en = null, actualizado_en = now()
  where funcion_id = p_funcion_id
    and asiento_id = any(p_asientos)
    and sesion_id = p_session_id
    and sesion_hash = hash_sesion
    and estado = 'reservado'
    and expira_en > now();

  get diagnostics filas_afectadas = row_count;
  if filas_afectadas <> cardinality(p_asientos) then
    raise exception 'Uno o más asientos ya no están reservados. Actualiza el mapa e inténtalo de nuevo.';
  end if;

  return filas_afectadas;
end;
$$;

revoke all on function public.reservar_asiento(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.liberar_asiento(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.confirmar_asientos(text, text[], uuid, text) from public, anon, authenticated;
grant execute on function public.reservar_asiento(text, text, uuid, text) to anon, authenticated;
grant execute on function public.liberar_asiento(text, text, uuid, text) to anon, authenticated;
grant execute on function public.confirmar_asientos(text, text[], uuid, text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'asientos_funcion'
  ) then
    alter publication supabase_realtime add table public.asientos_funcion;
  end if;
end;
$$;
