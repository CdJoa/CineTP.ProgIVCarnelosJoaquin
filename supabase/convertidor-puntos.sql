-- Convertidor de puntos a crédito (programa de fidelización).
-- El usuario gana 1 punto por cada peso y puede convertir sus puntos en crédito
-- según una tasa que configura el admin (por defecto 10 puntos = $1).
-- Ejecutar completo en el SQL Editor de Supabase.

-- 1. Configuración (una sola fila)
create table if not exists public.configuracion_puntos (
  id int primary key default 1 check (id = 1),
  puntos_por_peso int not null default 10 check (puntos_por_peso > 0),
  minimo_puntos int not null default 100 check (minimo_puntos > 0),
  actualizado_en timestamptz not null default now()
);

insert into public.configuracion_puntos (id) values (1) on conflict (id) do nothing;

alter table public.configuracion_puntos enable row level security;

drop policy if exists "configuracion_puntos lectura" on public.configuracion_puntos;
create policy "configuracion_puntos lectura" on public.configuracion_puntos
  for select using (true);

drop policy if exists "configuracion_puntos admin" on public.configuracion_puntos;
create policy "configuracion_puntos admin" on public.configuracion_puntos
  for update using (
    exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

-- 2. Historial de canjes (solo se escribe desde la RPC)
create table if not exists public.canjes_puntos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  puntos int not null check (puntos > 0),
  credito numeric not null check (credito > 0),
  puntos_por_peso int not null,
  creado_en timestamptz not null default now()
);

create index if not exists canjes_puntos_usuario_idx on public.canjes_puntos (usuario_id, creado_en desc);

alter table public.canjes_puntos enable row level security;

drop policy if exists "canjes_puntos propios" on public.canjes_puntos;
create policy "canjes_puntos propios" on public.canjes_puntos
  for select using (
    usuario_id = auth.uid()
    or exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

-- 3. Conversión atómica: descuenta puntos, suma crédito y guarda el historial
--    en una sola transacción. Usa auth.uid(), así nadie puede gastar puntos ajenos.
create or replace function public.convertir_puntos_a_credito(p_puntos int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_tasa int;
  v_minimo int;
  v_saldo int;
  v_credito numeric;
  v_puntos_final int;
  v_credito_final numeric;
begin
  if v_usuario is null then
    raise exception 'Tenés que iniciar sesión para convertir puntos.';
  end if;

  select puntos_por_peso, minimo_puntos into v_tasa, v_minimo
  from configuracion_puntos where id = 1;
  v_tasa := coalesce(v_tasa, 10);
  v_minimo := coalesce(v_minimo, 100);

  if p_puntos is null or p_puntos < v_minimo then
    raise exception 'El mínimo para convertir es % puntos.', v_minimo;
  end if;
  if p_puntos % v_tasa <> 0 then
    raise exception 'Los puntos deben ser múltiplo de %.', v_tasa;
  end if;

  -- Bloquea la fila del usuario para que dos conversiones simultáneas no gasten el mismo saldo
  select coalesce(puntos, 0) into v_saldo from usuarios where id = v_usuario for update;
  if v_saldo < p_puntos then
    raise exception 'No tenés puntos suficientes (saldo: %).', v_saldo;
  end if;

  v_credito := p_puntos / v_tasa;

  update usuarios
  set puntos = coalesce(puntos, 0) - p_puntos,
      credito = coalesce(credito, 0) + v_credito
  where id = v_usuario
  returning puntos, credito into v_puntos_final, v_credito_final;

  insert into canjes_puntos (usuario_id, puntos, credito, puntos_por_peso)
  values (v_usuario, p_puntos, v_credito, v_tasa);

  return jsonb_build_object(
    'puntos', v_puntos_final,
    'credito', v_credito_final,
    'credito_acreditado', v_credito
  );
end;
$$;

revoke all on function public.convertir_puntos_a_credito(int) from public, anon;
grant execute on function public.convertir_puntos_a_credito(int) to authenticated;

notify pgrst, 'reload schema';
