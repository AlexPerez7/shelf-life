-- Avisos de próximos episodios (web push).
--   - push_subscriptions: una fila por dispositivo que activó los avisos
--     (la suscripción que da el navegador). Cada usuario ve y maneja solo las suyas.
--   - push_notified: qué episodio ya se avisó a quién, para no repetirlo. Solo
--     la escribe la Edge Function `episode-alerts` (con la service role).
-- Sin esta migración la app funciona igual, solo que Ajustes no ofrece los avisos.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists push_subscriptions_owner on push_subscriptions;
create policy push_subscriptions_owner
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists push_notified (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  -- Qué episodio: temporada y número ("2x5"), o solo el número para anime ("0x7").
  air_key text not null,
  notified_at timestamptz not null default now(),
  primary key (user_id, item_id, air_key)
);

-- Sin políticas: ningún usuario la lee ni la escribe; la service role se las salta.
alter table push_notified enable row level security;
