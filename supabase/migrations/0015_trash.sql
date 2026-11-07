-- Papelera de Libros: borrar un libro no lo elimina, le pone `deleted_at`.
-- Queda 30 días con "Restaurar" y después se borra de verdad (la app limpia
-- los vencidos al abrir). Sus actividades y su lugar en las listas se
-- conservan, así que al restaurarlo vuelve todo como estaba.
-- Sin esta migración todo sigue igual: borrar elimina el libro para siempre.

alter table items add column if not exists deleted_at timestamptz;

create index if not exists items_deleted_idx
  on items (user_id, deleted_at)
  where deleted_at is not null;
