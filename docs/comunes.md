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

- Una por tracker: juegos terminados, títulos vistos, libros leídos. Libros tiene además una de páginas (ver `libros.md`).
- Arriba de las estadísticas de cada tracker, con el avance y si vas al día según el calendario, y también en el inicio.
- Tabla `goals` (migración `0012`); sin ella la app funciona igual y no muestra las metas. La `0014` suma `kind` (libros leídos o páginas); sin ella no hay meta de páginas. El inicio solo muestra las de libros leídos.

## Ajustes y actualización

- `/ajustes` (desde el inicio, en "Tu cuenta" → "Ajustes y actualización"): muestra la versión instalada (los 7 primeros caracteres del commit y la fecha del build, que fija `vite.config.ts` con `GITHUB_SHA`; `dev` en desarrollo).
- **Actualizar**: la PWA baja la versión nueva en segundo plano pero la pantalla abierta sigue con el código viejo hasta recargar, y el navegador revisa pocas veces. El botón pide la revisión al service worker, espera a que la versión nueva tome el control (`autoUpdate` activa `skipWaiting` y `clientsClaim`) y recarga; avisa si ya tenía la última, si la nueva todavía se está bajando o si no hay service worker (desarrollo). Lógica en `lib/appUpdate.ts`.
- **Reinstalar los archivos de la app** (último recurso, con confirmación): desregistra el service worker y borra la caché de archivos; no toca los datos ni los cambios pendientes sin conexión. Hace falta señal para que la app vuelva a abrir.
- La primera vez que se publica esta pantalla hay que recargar la app a mano (o cerrarla y abrirla): el botón viaja en la versión nueva.

## Cambios sin conexión

- Agregar un título (con lo que ya tengas a mano: la búsqueda en las APIs sí necesita señal), editarlo, borrarlo o mandarlo a la papelera, cambiar su estado o puntaje, el avance rápido (+1 episodio, la página), anotar episodios o páginas, registrar sesiones de juego y terminar el cronómetro (de juegos o de lectura) funcionan sin señal.
- El cambio se ve al instante, queda en una cola guardada en el dispositivo (`lib/pendingChanges.ts`, `hooks/usePendingSync.ts`) y se manda solo al volver la conexión, al abrir la app o volver a ella, y cada 30 s.
- Un aviso arriba a la derecha ("3 cambios sin guardar") lo muestra; tocarlo reintenta en el momento.
- Los cambios de un mismo título se guardan en el orden en que se hicieron. Cada actividad lleva un id generado en el dispositivo, así un reintento no la duplica ni suma dos veces el tiempo.
- Si la base rechaza un cambio al reintentar (por ejemplo, el título se borró en otro dispositivo), se descarta con un aviso.
- Al cerrar sesión se intenta guardar lo pendiente y, si no se puede, se pregunta antes de perderlo.
- Las sesiones de juego hechas sin señal aparecen en la lista con la marca "sin guardar"; borrar una de esas solo la saca de la cola. Borrar una sesión ya guardada también funciona sin señal: las horas bajan al instante y el borrado espera en la cola.
- **Listas**: crear, renombrar o borrar una lista y agregar o quitar títulos también funcionan sin señal, con su propia cola (`lib/pendingLists.ts`, `hooks/useListsQueue.ts`) que se manda en orden (no se puede agregar un título a una lista que todavía no existe en la base). Lo que se deshace antes de mandarse se cancela. Las listas y sus títulos se guardan en el dispositivo para verse sin señal.
- Un título agregado sin señal lleva un id generado en el dispositivo (la base lo guarda con ese mismo id, sin duplicarlo): se puede editar y registrar avance antes de que exista allá, y todo se manda en orden. Si se borra antes de guardarse, desaparece de la cola sin tocar la base; mandar un libro a la papelera sin señal y deshacerlo enseguida también cancela el cambio.
- Todavía necesitan conexión: las importaciones, restaurar o vaciar la papelera y compartir una lista por link (el link público lo genera la base).

## Fotos propias como portada

- En "Cambiar portada" de los tres trackers, "Subir una foto" usa la cámara o la galería.
- La foto se achica en el teléfono (600 px de ancho, JPEG) y se sube al bucket `covers` de Supabase Storage, en la carpeta del usuario (`lib/coverUpload.ts`, migración `0013`).
- El service worker la cachea como cualquier otra portada. Necesita conexión para subirla.
- Las fotos reemplazadas no se borran del bucket (ocupan poco: ~50-100 KB cada una).

## Cuenta y datos

- Login y registro con Supabase Auth, con recuperación de contraseña por email. El origen de la app tiene que estar en *Authentication → URL Configuration → Redirect URLs* de Supabase.
- **Exportar** desde el inicio ("Tu cuenta"): respaldo completo en JSON (biblioteca, actividad, listas y metas) o la biblioteca en CSV. En el teléfono se entrega con el menú de compartir.

## PWA y rendimiento

- Instalable (manifest, ícono, service worker) y responsive: mobile-first, con ajustes para tablet.
- Rutas con carga diferida y portadas cacheadas por el service worker.
- La biblioteca y los populares se pintan al instante desde una cache local y se revalidan contra Supabase en segundo plano.
