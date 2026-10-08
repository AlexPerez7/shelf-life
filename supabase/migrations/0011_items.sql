-- Modelo multimedia: juegos, películas, series, anime y libros en una sola
-- tabla `items`. Reemplaza a `games`, `play_sessions` y `list_games`.
--
-- - Estados genéricos (wishlist / planned / in_progress / paused / completed /
--   dropped); el frontend los muestra según el tipo ("Jugando", "Viendo"...).
-- - `time_spent_minutes`: tiempo invertido (horas jugadas, minutos vistos).
--   Lo mantiene un trigger sobre `activity_log` (igual que 0008 con games).
-- - `progress` / `progress_total`: avance contable (episodios, páginas).
-- - `is_favorite`, `format` (físico/digital, ebook...), `replays` (veces que
--   se rejugó/releyó/revió) y `franchise` (saga) sirven para todos los tipos.
-- - Lo propio de cada tipo va en `metadata`. Juegos: platforms, steam_appid,
--   story_percent, general_percent, completionist_percent.
-- - `source` + `external_id`: id en la API de origen (igdb, tmdb, anilist...).
--
-- Se conservan los ids de `games`, así que las URLs y los vínculos con listas
-- no cambian. Las tablas viejas NO se borran acá (queda rollback posible).
--
-- Nota: en producción ya existe una versión anterior e incompleta de `items`,
-- `activity_log` y `list_items` (un primer intento de esta migración). Por eso
-- todo es `if not exists` / `add column if not exists`, y la copia desde
-- `games` es un upsert: `games` es la fuente de verdad y pisa esas filas.

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('game','movie','series','anime','book')),
  title text not null,
  status text not null default 'planned',
  rating integer check (rating between 1 and 10),
  cover_url text,
  genres text[] not null default '{}',
  summary text,
  release_date date,
  notes text,
  review text,
  date_started date,
  date_finished date,
  time_spent_minutes integer not null default 0 check (time_spent_minutes >= 0),
  progress integer not null default 0 check (progress >= 0),
  progress_total integer check (progress_total > 0),
  source text,
  external_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table items add column if not exists is_favorite boolean not null default false;
alter table items add column if not exists format text;
alter table items add column if not exists replays integer not null default 0 check (replays >= 0);
alter table items add column if not exists franchise text;

alter table items drop constraint if exists items_status_check;
alter table items add constraint items_status_check
  check (status in ('wishlist','planned','in_progress','paused','completed','dropped'));

create index if not exists items_user_type_idx on items (user_id, media_type);
create index if not exists items_external_idx on items (user_id, source, external_id);

alter table items enable row level security;

drop policy if exists items_owner on items;
create policy items_owner
  on items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on items;
create trigger items_set_updated_at
  before update on items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- activity_log: sesiones de juego, episodios vistos, páginas leídas...
-- ---------------------------------------------------------------------------

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  duration_minutes integer check (duration_minutes > 0),
  progress_delta integer,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_user_date_idx on activity_log (user_id, occurred_at desc);
create index if not exists activity_log_item_idx on activity_log (item_id);

alter table activity_log enable row level security;

drop policy if exists activity_log_owner on activity_log;
create policy activity_log_owner
  on activity_log for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from items where items.id = item_id and items.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- list_items
-- ---------------------------------------------------------------------------

create table if not exists list_items (
  list_id uuid not null references lists(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, item_id)
);

create index if not exists list_items_item_idx on list_items (item_id);

alter table list_items enable row level security;

drop policy if exists list_items_owner on list_items;
create policy list_items_owner
  on list_items for all
  using (exists (select 1 from lists where lists.id = list_id and lists.user_id = auth.uid()))
  with check (
    exists (select 1 from lists where lists.id = list_id and lists.user_id = auth.uid())
    and exists (select 1 from items where items.id = item_id and items.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Copia de datos desde el modelo viejo
-- ---------------------------------------------------------------------------

insert into items (
  id, user_id, media_type, title, status, rating, cover_url, genres, summary,
  release_date, notes, review, date_started, date_finished, time_spent_minutes,
  source, external_id, metadata, is_favorite, format, replays, franchise, created_at
)
select
  g.id,
  g.user_id,
  'game',
  g.title,
  case g.status
    when 'deseado' then 'wishlist'
    when 'jugando' then 'in_progress'
    when 'en_pausa' then 'paused'
    when 'completado' then 'completed'
    when 'abandonado' then 'dropped'
    else 'planned'
  end,
  g.rating,
  g.cover_url,
  coalesce(array(select trim(t) from unnest(string_to_array(g.genre, ',')) as t where trim(t) <> ''), '{}'),
  g.summary,
  case when g.first_release_date is not null
    then (to_timestamp(g.first_release_date) at time zone 'UTC')::date
  end,
  g.notes,
  g.review,
  g.date_started,
  g.date_finished,
  greatest(0, round(coalesce(g.hours_played, 0) * 60))::integer,
  case when g.igdb_id is not null then 'igdb' end,
  g.igdb_id::text,
  jsonb_strip_nulls(jsonb_build_object(
    'platforms', to_jsonb(coalesce(array(select trim(t) from unnest(string_to_array(g.platform, ',')) as t where trim(t) <> ''), '{}')),
    'steam_appid', g.steam_appid,
    'story_percent', g.story_percent,
    'general_percent', g.general_percent,
    'completionist_percent', g.completionist_percent
  )),
  coalesce(g.is_favorite, false),
  g.format,
  coalesce(g.replays, 0),
  g.franchise,
  coalesce(g.created_at, now())
from games g
on conflict (id) do update set
  user_id = excluded.user_id,
  media_type = excluded.media_type,
  title = excluded.title,
  status = excluded.status,
  rating = excluded.rating,
  cover_url = excluded.cover_url,
  genres = excluded.genres,
  summary = excluded.summary,
  release_date = excluded.release_date,
  notes = excluded.notes,
  review = excluded.review,
  date_started = excluded.date_started,
  date_finished = excluded.date_finished,
  time_spent_minutes = excluded.time_spent_minutes,
  source = excluded.source,
  external_id = excluded.external_id,
  metadata = excluded.metadata,
  is_favorite = excluded.is_favorite,
  format = excluded.format,
  replays = excluded.replays,
  franchise = excluded.franchise,
  created_at = excluded.created_at;

-- Ítems que existían solo por el intento anterior y ya no están en games.
delete from items i
where i.media_type = 'game' and not exists (select 1 from games g where g.id = i.id);

-- Las sesiones se copian ANTES de crear el trigger de tiempo: las horas ya
-- vienen sumadas en hours_played y no se deben volver a sumar.
insert into activity_log (id, item_id, user_id, occurred_at, duration_minutes, notes, created_at)
select s.id, s.game_id, g.user_id, coalesce(s.played_at, now()), s.duration_minutes, s.notes,
  coalesce(s.played_at, now())
from play_sessions s
join games g on g.id = s.game_id
where s.duration_minutes > 0
on conflict (id) do nothing;

insert into list_items (list_id, item_id, added_at)
select lg.list_id, lg.game_id, coalesce(lg.added_at, now())
from list_games lg
join items i on i.id = lg.game_id
on conflict (list_id, item_id) do nothing;

-- ---------------------------------------------------------------------------
-- Tiempo invertido mantenido en la DB (reemplaza a 0008 para el modelo nuevo)
-- ---------------------------------------------------------------------------

create or replace function apply_activity_time()
returns trigger
language plpgsql
as $$
begin
  -- Borrado en cascada desde el ítem: el ítem ya no existe.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_op = 'INSERT' and new.duration_minutes is not null then
    update items
       set time_spent_minutes = time_spent_minutes + new.duration_minutes
     where id = new.item_id;
  elsif tg_op = 'DELETE' and old.duration_minutes is not null then
    update items
       set time_spent_minutes = greatest(0, time_spent_minutes - old.duration_minutes)
     where id = old.item_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists activity_log_time on activity_log;
create trigger activity_log_time
  after insert or delete on activity_log
  for each row execute function apply_activity_time();

-- ---------------------------------------------------------------------------
-- Listas públicas (reemplaza a la versión de 0010 sobre games/list_games)
-- ---------------------------------------------------------------------------

-- Cambia la forma del JSON devuelto: `items` en lugar de `games`.
create or replace function get_public_list(p_list_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'name', l.name,
    'items', coalesce(
      (
        select json_agg(
          json_build_object(
            'media_type', i.media_type,
            'title', i.title,
            'cover_url', i.cover_url,
            'platforms', coalesce(i.metadata -> 'platforms', '[]'::jsonb),
            'genres', i.genres,
            'status', i.status,
            'rating', i.rating,
            'release_date', i.release_date
          )
          order by li.added_at desc
        )
        from list_items li
        join items i on i.id = li.item_id
        where li.list_id = l.id
      ),
      '[]'::json
    )
  )
  from lists l
  where l.id = p_list_id
    and l.is_public;
$$;

revoke all on function get_public_list(uuid) from public;
grant execute on function get_public_list(uuid) to anon, authenticated;
