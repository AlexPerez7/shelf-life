# Setup

[← Volver al README](../README.md)

## 1. Dependencias

```
npm install
```

## 2. Variables de entorno

Copiar `.env.example` a `.env.local` y completar con las credenciales del proyecto de Supabase:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## 3. Migraciones

Ejecutar las migraciones SQL en Supabase, en orden (carpeta `supabase/migrations/`, hoy de la `0001` a la `0013`), o `supabase db push`.

- La `0008` crea un trigger que suma y resta las horas jugadas al registrar o borrar una sesión. El frontend ya no actualiza `hours_played` en ese caso, así que tiene que aplicarse **antes** de desplegar el frontend.
- La `0011` crea la tabla `items` (todo lo que se registra, de los tres trackers), `activity_log` y `list_items`.
- La `0012` crea `goals` (metas del año). Sin ella la app funciona igual, solo no muestra las metas.
- La `0013` crea el bucket público de Storage `covers` y sus políticas, para subir una foto propia como portada (cada usuario solo escribe en su carpeta). Sin ella, "Subir una foto" avisa que falta aplicarla. Se puede aplicar pegando el archivo en el *SQL Editor* del dashboard de Supabase.

Una migración nueva va con el número siguiente y se anota acá.

## 4. Edge Functions y sus secrets

Los secrets van solo en Supabase, nunca en el frontend:

```
supabase secrets set TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=xxx
supabase secrets set STEAM_API_KEY=xxx
supabase secrets set TMDB_API_KEY=xxx
supabase functions deploy igdb-search steam-library steam-auth game-deals media-search
```

- `STEAM_API_KEY` es una sola key de la app (se obtiene en https://steamcommunity.com/dev/apikey). Cada usuario vincula su cuenta desde la app.
- `TMDB_API_KEY` acepta la API Key o el Read Access Token de TMDB.
- Opcional: `GOOGLE_BOOKS_API_KEY` mejora la búsqueda de libros y suma portadas en "Cambiar portada".
- `game-deals` no necesita secrets; usa la `SUPABASE_SERVICE_ROLE_KEY` que Supabase inyecta sola.
- Todas las funciones exigen un **usuario logueado**: no alcanza con la anon key, que es pública.
- `steam-auth` solo acepta volver a URLs base permitidas; por defecto `https://alexperez7.github.io/shelf-life`. Para otras (dominio propio): `supabase secrets set APP_ORIGINS=https://alexperez7.github.io/shelf-life,https://otro.dominio`

En producción las funciones se publican solas con GitHub Actions: ver [deploy](deploy.md). Qué hace cada una: [integraciones](integraciones.md).

## 5. Desarrollo

```
npm run dev
```

Scripts: `npm run build` (type-check y build), `npm run preview`, `npm run lint` (oxlint) y `npm test` (Vitest, también corre en el deploy).
