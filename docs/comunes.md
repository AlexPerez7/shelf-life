# Lo común a los tres trackers

[← Volver al README](../README.md)

## Inicio

El inicio (`/`, `src/pages/Hub.tsx`) junta los tres trackers:

- Lo que está en curso (jugando, viendo, leyendo) con una acción rápida cada uno: "Jugar"/"Terminar" con el cronómetro, +1 episodio, "La vi", anotar la página.
- Los números de los últimos 7 días, los próximos episodios de la semana y las metas del año.
- La entrada a cada tracker.
- "Tu cuenta": exportar los datos y cerrar sesión.

Cada tracker vive bajo su propia ruta, con su barra de navegación, su tema (`useTrackerTheme`, tokens en `src/index.css`) y su carpeta en `src/trackers/`. Comparten lógica (búsqueda en `hooks/useMediaSearch`, reglas de avance en `lib/media.ts`) y componentes chicos de `src/components/`, no pantallas. Los datos de los tres están en la misma tabla `items`.

## Listas

- Comunes a los tres trackers (`/listas`): una lista puede mezclar juegos, películas, series, anime y libros.
- Se agregan desde "Mis listas" en el detalle de cada título; ahí también se puede crear una nueva.
- Compartibles por link público de solo lectura (`/compartir/:id`). La lectura pública pasa por la función `get_public_list` (SECURITY DEFINER), que solo devuelve campos no sensibles de listas marcadas como públicas; las tablas no tienen políticas para `anon`.

## Metas del año

- Una por tracker: juegos terminados, títulos vistos, libros leídos.
- Arriba de las estadísticas de cada tracker, con el avance y si vas al día según el calendario, y también en el inicio.
- Tabla `goals` (migración `0012`); sin ella la app funciona igual y no muestra las metas.

## Cambios sin conexión

- Editar un título, cambiar su estado o puntaje, el avance rápido (+1 episodio, la página), anotar episodios o páginas, registrar sesiones de juego y terminar el cronómetro (de juegos o de lectura) funcionan sin señal.
- El cambio se ve al instante, queda en una cola guardada en el dispositivo (`lib/pendingChanges.ts`, `hooks/usePendingSync.ts`) y se manda solo al volver la conexión, al abrir la app o volver a ella, y cada 30 s.
- Un aviso arriba a la derecha ("3 cambios sin guardar") lo muestra; tocarlo reintenta en el momento.
- Los cambios de un mismo título se guardan en el orden en que se hicieron. Cada actividad lleva un id generado en el dispositivo, así un reintento no la duplica ni suma dos veces el tiempo.
- Si la base rechaza un cambio al reintentar (por ejemplo, el título se borró en otro dispositivo), se descarta con un aviso.
- Al cerrar sesión se intenta guardar lo pendiente y, si no se puede, se pregunta antes de perderlo.
- Las sesiones de juego hechas sin señal aparecen en la lista con la marca "sin guardar"; borrar una de esas solo la saca de la cola.
- Todavía necesitan conexión: agregar o borrar títulos, borrar una sesión ya guardada y las listas.

## Cuenta y datos

- Login y registro con Supabase Auth, con recuperación de contraseña por email. El origen de la app tiene que estar en *Authentication → URL Configuration → Redirect URLs* de Supabase.
- **Exportar** desde el inicio ("Tu cuenta"): respaldo completo en JSON (biblioteca, actividad, listas y metas) o la biblioteca en CSV. En el teléfono se entrega con el menú de compartir.

## PWA y rendimiento

- Instalable (manifest, ícono, service worker) y responsive: mobile-first, con ajustes para tablet.
- Rutas con carga diferida y portadas cacheadas por el service worker.
- La biblioteca y los populares se pintan al instante desde una cache local y se revalidan contra Supabase en segundo plano.
