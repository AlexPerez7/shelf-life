-- Portadas propias: fotos que sube cada usuario desde "Cambiar portada".
--
-- Bucket público de Storage `covers`: las imágenes se leen por URL pública
-- (como cualquier portada de un CDN), así que no hace falta política de
-- lectura. Cada usuario solo puede subir, reemplazar o borrar dentro de su
-- carpeta (`<user_id>/...`). El frontend achica la foto antes de subirla
-- (600 px de ancho, JPEG); el límite de 2 MB es un tope de seguridad.
--
-- Idempotente: se puede volver a correr sin romper nada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists covers_insert_own on storage.objects;
create policy covers_insert_own
  on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists covers_update_own on storage.objects;
create policy covers_update_own
  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists covers_delete_own on storage.objects;
create policy covers_delete_own
  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
