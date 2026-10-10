# Plan: pendientes

Lo que quedó anotado para hacer más adelante, en el orden recomendado. El plan original (fase solo juegos) está en `shelf-life-plan.md` y ya está completo.

## 1. Ordenar el detalle de juegos

`src/trackers/juegos/GameDetail.tsx` tiene más de 1000 líneas: lo más difícil de mantener del proyecto.

- Partirlo en componentes (cabecera, cronómetro y sesiones, registro, duración estimada, precios, datos plegables) como en `ScreenDetail`/`BookDetail`, sin cambiar nada visible.
- De paso: el aviso de lint `react(refs)` de `GamesContext` (ref leída durante el render).

## Ideas sueltas (sin prioridad)

- Más cosas sin conexión: agregar y borrar títulos (necesita ids temporales), las sesiones de juego y el cronómetro (`usePlaySessions`, `useSaveStoppedTimer`) y las listas. Hoy fallan con un error si no hay señal.

- Temporadas para el anime de AniList (hoy se cuentan de corrido): AniList separa cada temporada en otra entrada, así que habría que agrupar por relaciones (`SEQUEL`/`PREQUEL`).
- Subir una foto propia como portada (requiere un bucket de Supabase Storage con RLS).
- Avisos de próximos episodios (web push): necesita suscripciones guardadas y un envío programado desde una Edge Function.
- Rendimiento con bibliotecas muy grandes (miles de títulos): pedir solo las columnas de la lista (sin sinopsis ni reseñas) y virtualizar las cuadrículas.
- `GOOGLE_BOOKS_API_KEY`: configurarla mejora la búsqueda de libros y suma portadas en "Cambiar portada".
