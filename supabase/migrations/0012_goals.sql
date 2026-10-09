-- Metas del año, una por tracker: juegos terminados, títulos vistos
-- (películas, series y anime) y libros leídos. El avance no se guarda: se
-- calcula en el frontend a partir de `items` (terminados con fecha de fin en
-- ese año).

create table if not exists goals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tracker text not null check (tracker in ('juegos', 'pantalla', 'libros')),
  year integer not null check (year between 2000 and 2100),
  target integer not null check (target between 1 and 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, tracker, year)
);

alter table goals enable row level security;

drop policy if exists goals_owner on goals;
create policy goals_owner
  on goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
