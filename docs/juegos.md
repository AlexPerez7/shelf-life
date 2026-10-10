# Juegos

[← Volver al README](../README.md)

Ruta `/juegos`, código en `src/trackers/juegos/`. Tema violeta y magenta.

## Biblioteca y alta

- Vista de lista o de portadas, filtros por estado y plataforma, favoritos, búsqueda por título y orden (recientes, título, horas, puntaje). Los filtros viven en la URL y se conservan al volver de un juego.
- Cambio rápido de estado desde la tarjeta.
- Estado "Deseado" (wishlist) separado de "Pendiente".
- Alta con búsqueda en IGDB mientras se escribe (portada, plataformas, géneros, sinopsis, año).
- Inicio del tracker con juegos populares recientes (IGDB) y alta rápida.

## Steam

- Vincular la cuenta con "Sign in through Steam".
- Importar la biblioteca con horas jugadas reales: de a uno o todos juntos, actualizar las horas de los ya importados y completar sus datos (portada, géneros, sinopsis) con IGDB.

## Detalle

- Guardado automático, sin botón "Guardar".
- Estado, plataformas (multi-selección), fechas de inicio y fin, horas jugadas, progreso (historia, general, 100%), puntaje, notas y reseña.
- **Cronómetro** ("Jugar" / "Terminar"), que sigue contando aunque se cierre la app.
- **Sesiones de juego** (fecha y minutos), que suman solas a las horas totales (trigger en la DB).
- **Precios** actuales en tiendas de PC (CheapShark) para juegos "Deseado" o "Pendiente".
- **Duración estimada** (IGDB: rápido, normal, completista).
- **Cambiar portada**: tocar la portada o ⋮ → Cambiar portada. Ofrece la portada de IGDB, las de cada región y edición, y la vertical de Steam; también se puede pegar la URL de una imagen.

El código del detalle está repartido en `src/trackers/juegos/detail/`: `useGameDraft` (autoguardado), `useGameSessions` (sesiones y cronómetro) y una sección por archivo.

## Estadísticas y diario

- **Estadísticas**: totales, tiempo estimado para terminar el backlog (IGDB) y a tu ritmo, horas por mes, distribución por estado, destacados, la meta del año y el resumen del año para compartir.
- **Diario**: línea de tiempo con altas, inicios, finalizaciones y sesiones registradas.
