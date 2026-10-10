# Libros

[← Volver al README](../README.md)

Ruta `/libros`, código en `src/trackers/libros/`. Lecturas por páginas, con tema claro propio (papel, verde azulado y serif Lora), inspirado en Openreads.

## Librero

- La biblioteca es un librero: muebles con repisas por estado, colecciones, géneros y autores.
- Libros en portada o en lomo, y estantes que se abren completos.

## Alta

- Busca por título, autor o ISBN, en una lista con ficha (autores, páginas, editorial, sinopsis).
- Agrega directo a "Quiero leer", "Leyendo" o "Leído".
- En Chrome de Android hay un botón para **escanear el código de barras** (ISBN) con la cámara: busca el libro por ese número y deja el formato en "Físico".

## Formato

- Físico, eBook, Kindle, Kobo o Audiolibro; se pueden marcar varios.
- Se elige al agregar (recuerda el último usado) y se cambia en la ficha.
- Arma estantes en Colecciones y aparece en las estadísticas ("Cómo lees").

## Ficha del libro

- La lectura en curso: página, porcentaje y lo que falta a tu ritmo, con atajos de +10, +25 y +50 páginas.
- "Empezar a leer" o "Releer" según el estado.
- Ritmo en páginas por hora, notas, reseña y datos de la edición.
- **Cronómetro de lectura** ("Leer" en la ficha y en el inicio): sigue contando aunque se cierre la app y, al terminar, pide la página con los minutos ya puestos (o guarda solo el tiempo). Es el mismo cronómetro de los juegos: uno a la vez.
- **Cambiar portada**: tocar la portada (o ⋮ → Cambiar portada) ofrece las ediciones de Open Library (primero en español), Apple Books y Google Books (con key), o se sube una foto propia (por ejemplo, de tu edición) o se pega la URL de una imagen.

## Importar de Goodreads o StoryGraph

- En `/libros/importar`, con el CSV que exportan: estados, puntajes, fechas, reseñas, relecturas y formato.
- Los que ya están se saltan y las portadas salen de Open Library por ISBN.
- El archivo se procesa en el dispositivo.

## Estadísticas y diario

- **Estadísticas** (`/libros/estadisticas`): leídos (y los de este año en portadas), páginas, tiempo y ritmo de lectura, páginas por mes, racha, géneros y autores, destacados (mejor puntuado, el más largo y el más corto), la meta del año y el resumen del año.
- **Diario de lectura** (`/libros/historial`): día por día, las páginas leídas de cada libro, lo empezado y lo terminado.
