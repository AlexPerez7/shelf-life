# Shelf Life

PWA mobile-first para llevar registro de juegos, películas, series, anime y libros: backlog, progreso, tiempo invertido y estadísticas personales.

Ver [`shelf-life-plan.md`](./shelf-life-plan.md) para el plan original de desarrollo.

En producción: https://alexperez7.github.io/shelf-life/

## Estructura: tres trackers en uno

El inicio (`/`) es un lanzador desde el que se entra a cada tracker. Cada uno vive bajo su propia ruta, con su barra de navegación, su color de acento (`[data-tracker]` en `src/index.css`) y su carpeta en `src/trackers/`:

- **Juegos** (`/juegos`, `src/trackers/juegos/`): biblioteca, descubrir, listas, estadísticas, diario e importación de Steam.
- **Pantalla** (`/pantalla`, `src/trackers/pantalla/`): películas, series y anime, con una biblioteca estilo app de streaming: "Seguir viendo" con avance rápido (+1 episodio, "la vi"), una fila de pósters por estado y números del tracker (episodios, horas frente a la pantalla). El detalle tiene el póster sobre su fondo difuminado, una acción principal (ver el siguiente episodio, marcar vista, volver a verla) y los episodios como casillas: tocar una marca todo hasta ahí y suma el tiempo visto. El alta muestra los resultados como pósters; tocar uno abre una vista previa (sinopsis, duración, episodios) desde la que se agrega directo como "Quiero ver", "Viendo" o "Ya la vi", sin salir de la búsqueda.
- **Libros** (`/libros`, `src/trackers/libros/`): lecturas por páginas, con tema claro propio (papel, verde azulado y serif Lora, inspirado en Openreads), y una biblioteca que es un librero: muebles con repisas por estado, colecciones, géneros y autores, libros en portada o lomo, y estantes que se abren completos.

Libros usa por ahora el alta y el detalle genéricos de `src/pages/` (`AddMedia`, `MediaDetail`); cada tracker puede reemplazarlas por un diseño propio sin tocar a los demás. Los datos de los tres están en la misma tabla `items`.

## Stack

- React + Vite + TypeScript + Tailwind CSS
- PWA vía `vite-plugin-pwa`
- Supabase (Postgres + Auth + Edge Functions + RLS)
- Deploy: GitHub Pages (GitHub Actions)

## Integraciones externas (todas vía Edge Functions de Supabase, nunca desde el frontend)

- **IGDB** (metadata de juegos, populares y duración estimada) — vía Twitch OAuth. Función `igdb-search`, con modos `query` (default), `popular`, `timeToBeat` (endpoint oficial `game_time_to_beats`), `timeToBeatBatch` (varias duraciones en una consulta, para la estadística de backlog) y `bySteam` (metadata de IGDB a partir de appids de Steam, vía `external_games`).
- **Steam** — cada usuario vincula su cuenta con "Sign in through Steam" (OpenID 2.0, función `steam-auth`); el SteamID64 se guarda en `profiles`. La función `steam-library` lee ese id y trae la biblioteca con horas jugadas reales vía la Steam Web API (key de la app). Requiere perfil de Steam público.
- **CheapShark** (precios actuales en tiendas de PC, sin API key). Función `game-deals`. Los resultados se cachean en la tabla `price_cache` (TTL 12 h) porque CheapShark limita por IP y los Edge Functions comparten IP; usa `steam_appid` cuando está disponible para un match exacto.

> La duración estimada antes venía de HowLongToBeat (scraping de un endpoint interno no oficial). Se migró a IGDB `game_time_to_beats` por estabilidad; la función `hltb-search` fue eliminada.

## Funcionalidades

- Login/registro con Supabase Auth, con recuperación de contraseña por email (el origen de la app debe estar en *Authentication → URL Configuration → Redirect URLs* de Supabase)
- Biblioteca con filtros por estado/plataforma, búsqueda por título y orden (recientes, título, horas, puntaje); los filtros viven en la URL y se conservan al volver de un juego
- Alta de juegos con búsqueda en IGDB mientras se escribe (portada, plataformas, géneros, sinopsis, año)
- Vincular la cuenta de Steam ("Sign in through Steam") e importar la biblioteca con horas jugadas reales: de a uno o todos juntos, actualizar horas de los ya importados y completar sus datos (portada, géneros, sinopsis) con IGDB
- Detalle/edición: estado, plataformas (multi-selección), fechas de inicio/fin, horas jugadas, puntaje (estrellas), notas, reseña
- Precios actuales en tiendas de PC (CheapShark) para juegos en estado "Pendiente"
- Duración estimada (IGDB: rápido / normal / completista) en el detalle de cada juego
- Cronómetro de sesión ("Jugar" / "Terminar"), que sigue contando aunque se cierre la app
- Registro de sesiones de juego (fecha + minutos), que suman automáticamente a las horas totales (trigger en la DB)
- Guardado automático en el detalle del juego (sin botón "Guardar")
- Listas personalizadas (crear, agregar/quitar juegos) y compartibles por link público de solo lectura (`/compartir/:id`). La lectura pública pasa por la función `get_public_list` (SECURITY DEFINER), que solo devuelve campos no sensibles de listas marcadas como públicas; las tablas no tienen políticas para `anon`
- Pantalla de Inicio con juegos populares recientes (vía IGDB) y alta rápida a la biblioteca
- Diario: línea de tiempo con altas, inicios, finalizaciones y sesiones registradas
- Estado "Deseado" (wishlist) separado de "Pendiente", con precios de tiendas
- Biblioteca en vista de lista o de portadas, filtro de favoritos y cambio rápido de estado desde la tarjeta
- Estadísticas: totales, tiempo estimado para terminar el backlog (IGDB) y a tu ritmo, horas por mes, distribución por estado, destacados y resumen del año para compartir
- PWA instalable (manifest, ícono, service worker) y responsive (mobile-first, con ajustes para tablet)
- Rendimiento: rutas con carga diferida, portadas cacheadas por el service worker y biblioteca/populares pintados al instante desde una cache local (se revalidan contra Supabase en segundo plano)

## Setup

1. Instalar dependencias:
   ```
   npm install
   ```
2. Copiar `.env.example` a `.env.local` y completar con las credenciales de tu proyecto de Supabase:
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
3. Ejecutar las migraciones SQL en Supabase, en orden (carpeta `supabase/migrations/`, actualmente 0001 a 0010), o `supabase db push`.
   - La `0008` crea un trigger que suma/resta las horas jugadas al registrar/borrar una sesión. El frontend ya no actualiza `hours_played` en ese caso, así que debe aplicarse **antes** de desplegar el frontend.
4. Configurar los secrets de las Edge Functions (nunca en el frontend) y desplegarlas:
   ```
   supabase secrets set TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=xxx
   supabase secrets set STEAM_API_KEY=xxx
   supabase functions deploy igdb-search steam-library steam-auth game-deals media-search
   ```
   - `STEAM_API_KEY` es una sola key de la app (se obtiene en https://steamcommunity.com/dev/apikey). Ya no hace falta `STEAM_ID`: cada usuario vincula su cuenta desde la app.
   - `game-deals` no necesita secrets (API pública); usa la `SUPABASE_SERVICE_ROLE_KEY` que Supabase inyecta automáticamente para escribir en `price_cache`.
   - `steam-auth` y `steam-library` usan el JWT del usuario para leer/escribir su fila en `profiles` (RLS).
   - Todas las funciones exigen un **usuario logueado** (no alcanza con la anon key, que es pública).
   - `steam-auth` solo acepta volver a URLs base permitidas: por defecto `https://alexperez7.github.io/shelf-life`. Para otras (dominio propio): `supabase secrets set APP_ORIGINS=https://alexperez7.github.io/shelf-life,https://otro.dominio`
   - `media-search` (películas, series y anime) necesita `supabase secrets set TMDB_API_KEY=...` (API Key o Read Access Token de TMDB). El anime sale de AniList y los libros de Open Library, ambos sin key. Opcional: `GOOGLE_BOOKS_API_KEY` para buscar libros primero en Google Books.
5. Correr en desarrollo:
   ```
   npm run dev
   ```

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción (type-check + Vite build)
- `npm run preview` — preview del build
- `npm run lint` — lint con oxlint

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`) compila y publica en GitHub Pages en cada push a `main`. La app vive en la subcarpeta `/shelf-life/` (el workflow pasa `BASE_PATH`); las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` son *variables* del repo (Settings → Secrets and variables → Actions → Variables). Para probar localmente un build igual: `BASE_PATH=/shelf-life/ npm run build`.

## Estado

Todas las fases del plan original (`shelf-life-plan.md`) están completas y en producción. El desarrollo actual es iterativo, agregando mejoras e integraciones sobre la base ya funcionando.
