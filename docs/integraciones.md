# Integraciones externas

[← Volver al README](../README.md)

Todas se llaman desde Edge Functions de Supabase (`supabase/functions/`), nunca desde el frontend, y todas exigen un usuario logueado. Cómo configurar sus secrets: [setup](setup.md#4-edge-functions-y-sus-secrets).

## `igdb-search`: IGDB (juegos)

Vía Twitch OAuth (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`). Modos (campo `mode`):

| Modo | Qué devuelve |
| --- | --- |
| (sin modo) + `query` | Búsqueda por texto. |
| `popular` | Juegos con más expectativa de los últimos 2 años. |
| `timeToBeat` | Duración estimada (`igdbId` y/o `title`), del endpoint oficial `game_time_to_beats`. |
| `timeToBeatBatch` | Duración "normal" de varios juegos (`igdbIds`) en una consulta, para la estadística de backlog. |
| `bySteam` | Metadata de IGDB a partir de appids de Steam (`steamAppIds`), vía `external_games`. |
| `covers` | Portadas alternativas: la del juego, las de cada región y edición en IGDB, y la vertical de Steam (`library_600x900`) si tiene `steamAppId`. Sin `igdbId`, busca el juego por `title`. |

> La duración estimada antes venía de HowLongToBeat (scraping de un endpoint interno no oficial). Se migró a IGDB `game_time_to_beats` por estabilidad; la función `hltb-search` fue eliminada.

## `steam-auth` y `steam-library`: Steam

- Cada usuario vincula su cuenta con "Sign in through Steam" (OpenID 2.0, función `steam-auth`); el SteamID64 se guarda en `profiles`.
- `steam-library` lee ese id y trae la biblioteca con las horas jugadas reales vía la Steam Web API (`STEAM_API_KEY`, una key de la app). Requiere perfil de Steam público.
- Las dos usan el JWT del usuario para leer y escribir su fila en `profiles` (RLS).

## `game-deals`: CheapShark (precios)

- Precios actuales en tiendas de PC, sin API key.
- Los resultados se cachean en la tabla `price_cache` (12 h) porque CheapShark limita por IP y las Edge Functions comparten IP. Escribe con la `SUPABASE_SERVICE_ROLE_KEY` que Supabase inyecta sola.
- Usa `steam_appid` cuando está disponible para un match exacto.

## `media-search`: películas, series, anime y libros

- Películas y series en **TMDB** (`TMDB_API_KEY`: API Key o Read Access Token).
- Anime en **AniList** y libros en **Open Library**, los dos sin key. Opcional: `GOOGLE_BOOKS_API_KEY` para buscar libros primero en Google Books.

Body: `{ type: 'movie' | 'series' | 'anime' | 'book', ... }`:

| Parámetros | Qué devuelve |
| --- | --- |
| `query` | Búsqueda por texto (hasta 12 resultados). |
| `id` (+ `source` en libros) | Detalle de un resultado: duración, episodios, temporadas, sinopsis. |
| `mode: 'trending'` | Tendencias de la semana (TMDB) o de la temporada (AniList); el alta de Pantalla las muestra antes de escribir. |
| `mode: 'upcoming'` + `ids` | El próximo episodio con fecha de cada serie (TMDB) o anime (AniList), hasta 40. |
| `mode: 'covers'` | Portadas alternativas: para libros, las ediciones de Open Library (primero en español), Apple Books y Google Books (con key); para películas y series, los pósters de TMDB. |
| `mode: 'match'` + `titles` | Para importar de Letterboxd: la película de TMDB de cada título y año (hasta 20), con el detalle, o `null`. |
| `mode: 'findCovers'` + `books` | Para completar portadas: la de cada libro (`title`, `author`, `isbn`; hasta 20) en Open Library, Google Books (con key) o Apple Books, o `null`. |
| `mode: 'byAuthor'` + `author` | Solo libros: las obras más conocidas de ese autor en Open Library (por ediciones, hasta 20, sin repetir títulos ni recopilaciones). Para "Más de este autor" en la ficha. |
| `mode: 'editions'` | Solo libros: las ediciones de la obra (`id` de Open Library, o `title` y `author` si no hay), hasta 40, primero las en español: editorial, año, páginas, ISBN, idiomas, formato y portada. Para "Elegir la edición" en la ficha. |
| `mode: 'sequels'` + `id` | Las secuelas de un anime de AniList (relación SEQUEL), con su `format` (TV, MOVIE, OVA...), primero lo que sigue la serie. Para "Sigue la historia". |
| `mode: 'mal'` + `ids` | Para importar de MyAnimeList: el anime de AniList de cada id de MAL (hasta 50), con `mal_id`. |

## `episode-alerts`: avisos de próximos episodios

Manda una notificación (web push) el día que sale un episodio de una serie (TMDB) o anime (AniList) que sigues (en curso, en pausa, pendiente o por ver). No la llama la app: la dispara un cron una vez por hora.

- Por cada usuario con dispositivos suscritos (`push_subscriptions`) mira sus próximos episodios; si uno sale hoy y no se avisó antes (`push_notified`), lo manda a todos sus dispositivos. Un episodio con solo el día (TMDB) se avisa desde las 12:00 UTC (9 de la mañana en Argentina); uno con hora (AniList), cuando falta una hora o menos. Reglas en `supabase/functions/_shared/alerts.ts`.
- Las suscripciones que el navegador ya dio de baja se borran solas. Si un aviso no llega a ningún dispositivo, se reintenta en la próxima hora.
- Se publica con la verificación de JWT apagada (`supabase/config.toml`): el cron no tiene un usuario. Se protege con `CRON_SECRET` (header `x-cron-secret`); sin los secrets responde 503 y no hace nada.
- La app los activa por dispositivo desde **Ajustes → Avisos de episodios** (`components/PushSettings.tsx`, `lib/push.ts`); el aviso lo muestra el service worker (`public/push-sw.js`, sumado con `importScripts`) y tocarlo abre el título. En iPhone solo funciona con la app instalada en la pantalla de inicio.

Para activarlos (una vez):

1. Aplicar la migración `0016` (ver [setup](setup.md#3-migraciones)).
2. Generar las claves VAPID: `npx web-push generate-vapid-keys`.
3. Secrets de la función: `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu-correo@ejemplo.com CRON_SECRET=<texto largo al azar>` (`TMDB_API_KEY` ya está si usas Pantalla) y publicar la función (`supabase functions deploy episode-alerts`, o el workflow de Actions).
4. La clave pública también va al frontend: variable `VITE_VAPID_PUBLIC_KEY` del repo (Settings → Secrets and variables → Actions → Variables) y en `.env.local` para desarrollar. Hace falta un deploy para que Ajustes la tenga.
5. Programar el cron, en el *SQL Editor* de Supabase (con las extensiones `pg_cron` y `pg_net` activadas, Database → Extensions):

```sql
select cron.schedule(
  'episode-alerts',
  '0 * * * *',
  $$ select net.http_post(
       url := 'https://<ref-del-proyecto>.supabase.co/functions/v1/episode-alerts',
       headers := '{"Content-Type": "application/json", "x-cron-secret": "<el mismo CRON_SECRET>"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
```

6. Probarlo a mano: activar los avisos en Ajustes y llamar a la función con ese mismo header (`curl -X POST <url> -H "x-cron-secret: ..."`); responde `{ users, sent }`.
