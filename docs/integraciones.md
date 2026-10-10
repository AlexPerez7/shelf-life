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
| `mode: 'sequels'` + `id` | Las secuelas de un anime de AniList (relación SEQUEL), con su `format` (TV, MOVIE, OVA...), primero lo que sigue la serie. Para "Sigue la historia". |
| `mode: 'mal'` + `ids` | Para importar de MyAnimeList: el anime de AniList de cada id de MAL (hasta 50), con `mal_id`. |
