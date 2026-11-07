-- Meta de páginas del año para Libros, además de la de libros leídos: `goals`
-- suma `kind` ('items' = la de siempre, 'pages' = páginas) y la clave pasa a
-- incluirlo, así un tracker puede tener una meta de cada tipo. Las metas que
-- ya existen quedan como 'items'. Sin esta migración todo sigue igual, solo
-- que Libros no ofrece la meta de páginas.

alter table goals
  add column if not exists kind text not null default 'items';

alter table goals drop constraint if exists goals_kind_check;
alter table goals
  add constraint goals_kind_check
  check (kind in ('items', 'pages') and (kind = 'items' or tracker = 'libros'));

-- Las páginas de un año pasan de las 10.000.
alter table goals drop constraint if exists goals_target_check;
alter table goals
  add constraint goals_target_check
  check (target between 1 and 1000000);

alter table goals drop constraint if exists goals_pkey;
alter table goals add primary key (user_id, tracker, year, kind);
