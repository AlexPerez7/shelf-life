# Plan: pendientes

Lo que quedó anotado para hacer más adelante, en el orden recomendado. El plan original (fase solo juegos) está en `shelf-life-plan.md` y ya está completo.

## 1. Revisión en el navegador

Todo lo publicado el 2026-10-09 pasó build, lint y tests, pero no se probó en pantalla: Pantalla y Libros propios (biblioteca, alta, detalle), estadísticas, historial, inicio con "En curso", listas comunes, metas, formatos y plataformas, importar de Goodreads/StoryGraph, escanear ISBN, próximos episodios, temporadas, cambiar portada, guardado optimista, episodio a mano, cronómetro de lectura y exportar.

- Requiere la extensión de Chrome conectada y la sesión iniciada en `localhost:5199` (la base es la de producción: no se crean cuentas de prueba).
- Recorrer cada pantalla en tamaño de teléfono, revisar la consola y corregir lo que aparezca.
- Prioridad: tocar "+1" varias veces seguidas, anotar un episodio a mano, el cronómetro de lectura (cerrar la app y volver), cambiar portada, exportar el JSON y el link público de una lista con varios tipos.

## 2. Importar Pantalla desde Letterboxd y MyAnimeList

Como `/libros/importar`, pero para películas, series y anime.

- **MyAnimeList**: el export es un XML con el id de MAL de cada anime, estado, episodios vistos, puntaje y fechas. AniList busca por `idMal`, así que el anime entra con portada, episodios y avance exactos (un modo nuevo en `media-search` que reciba varios ids de MAL).
- **Letterboxd**: el export (zip) trae CSV de lo visto (`watched.csv`, `diary.csv`, `ratings.csv`, `watchlist.csv`) con título, año y puntaje. Cada película se busca en TMDB por título + año (en tandas, desde la Edge Function); las que no coincidan se muestran para revisarlas o saltarlas.
- Reusar lo de Libros: resumen antes de importar, duplicados que se saltan, `addItems` en tandas, archivo procesado en el dispositivo, tests del parser en `src/lib`.

## 3. Guardar sin conexión

Hoy un cambio sin señal se ve un momento (guardado optimista) y vuelve atrás con un error.

- Cola de cambios pendientes por ítem (ya existe la fila por ítem en `MediaContext`/`GamesContext`), persistida en el dispositivo, que se reintenta al volver la conexión (`online`) y al abrir la app.
- Indicador discreto de "cambios sin guardar" y qué pasa si el usuario cierra sesión con cambios pendientes.
- Cuidar el orden: los cambios de un mismo ítem se aplican en el orden en que se hicieron; la actividad (`activity_log`) no se debe duplicar al reintentar.

## 4. "Cambiar portada" en Juegos

Igual que en Libros y Pantalla (`components/CoverPicker.tsx`).

- Un modo en `igdb-search` (o en `media-search`) que traiga las portadas y artes alternativos de un juego en IGDB, y quizás la portada de Steam (`library_600x900`) si tiene `steam_appid`.
- En el detalle de juegos: tocar la portada o ⋮ → Cambiar portada.

## 5. Ordenar el detalle de juegos

`src/trackers/juegos/GameDetail.tsx` tiene más de 1000 líneas: lo más difícil de mantener del proyecto.

- Partirlo en componentes (cabecera, cronómetro y sesiones, registro, duración estimada, precios, datos plegables) como en `ScreenDetail`/`BookDetail`, sin cambiar nada visible.
- De paso: el aviso de lint `react(refs)` de `GamesContext` (ref leída durante el render).

## Ideas sueltas (sin prioridad)

- Temporadas para el anime de AniList (hoy se cuentan de corrido): AniList separa cada temporada en otra entrada, así que habría que agrupar por relaciones (`SEQUEL`/`PREQUEL`).
- Subir una foto propia como portada (requiere un bucket de Supabase Storage con RLS).
- Avisos de próximos episodios (web push): necesita suscripciones guardadas y un envío programado desde una Edge Function.
- Rendimiento con bibliotecas muy grandes (miles de títulos): pedir solo las columnas de la lista (sin sinopsis ni reseñas) y virtualizar las cuadrículas.
- `GOOGLE_BOOKS_API_KEY`: configurarla mejora la búsqueda de libros y suma portadas en "Cambiar portada".
