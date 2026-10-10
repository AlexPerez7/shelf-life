# Deploy

[← Volver al README](../README.md)

## App (GitHub Pages)

- `.github/workflows/deploy.yml` corre los tests, compila y publica en GitHub Pages en cada push a `main`.
- La app vive en la subcarpeta `/shelf-life/` (el workflow pasa `BASE_PATH`).
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` son *variables* del repo: Settings → Secrets and variables → Actions → Variables.
- Para probar localmente un build igual: `BASE_PATH=/shelf-life/ npm run build`.

## Edge Functions

- `.github/workflows/functions.yml` publica las funciones en cada push a `main` que toque `supabase/functions/`, o a mano desde Actions → "Deploy de Edge Functions" → Run workflow.
- Necesita dos *secrets* del repo (Settings → Secrets and variables → Actions → Secrets):
  - `SUPABASE_ACCESS_TOKEN`: token personal, de https://supabase.com/dashboard/account/tokens. Alcanza con permiso de Edge Functions en "Read-write" para el proyecto.
  - `SUPABASE_PROJECT_REF`: el id del proyecto, el de la URL del dashboard.
- Sin ellos, el job avisa y termina sin fallar.
- Cuando el token vence, se genera uno nuevo con los mismos permisos y se reemplaza el secret.
- Los secrets de las funciones (`TMDB_API_KEY`, etc.) siguen yendo con `supabase secrets set` (ver [setup](setup.md#4-edge-functions-y-sus-secrets)).
