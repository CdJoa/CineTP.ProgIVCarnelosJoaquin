-- Preventa configurable por película.
-- Mientras preventa_activa = true y la fecha actual sea anterior a fecha_estreno,
-- el precio de cada función de la película se ajusta por preventa_porcentaje (-50 a +50).
-- Desde el día del estreno (cuando empiezan las funciones) se cobra el precio normal,
-- sin necesidad de ningún cron. Se puede correr más de una vez.

alter table public.peliculas
  add column if not exists preventa_activa boolean not null default false,
  add column if not exists preventa_porcentaje integer not null default 0;

alter table public.peliculas
  drop constraint if exists peliculas_preventa_porcentaje_rango;
alter table public.peliculas
  add constraint peliculas_preventa_porcentaje_rango
  check (preventa_porcentaje between -50 and 50);

-- Versión anterior: la preventa tenía su propia fecha de fin. Ahora termina en el estreno.
alter table public.peliculas
  drop constraint if exists peliculas_preventa_hasta_requerida;
alter table public.peliculas
  drop column if exists preventa_hasta;

-- Recargar el esquema de PostgREST para que la API vea los cambios.
notify pgrst, 'reload schema';
