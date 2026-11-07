# Libros

[← Volver al README](../README.md)

Ruta `/libros`, código en `src/trackers/libros/`. Lecturas por páginas, con tema claro propio (papel, verde azulado y serif Lora), inspirado en Openreads.

## Librero

- La biblioteca es un librero: muebles con repisas por estado, colecciones, géneros y autores.
- Libros en portada o en lomo, y estantes que se abren completos.
- **Orden y filtros** (botón de controles arriba a la derecha): ordenar por agregado, título, autor, puntaje, páginas, fecha en que lo terminaste o año de publicación (en cualquier dirección; los libros sin ese dato quedan al final), y filtrar por favoritos, año de lectura (cuentan también las relecturas) o género. Con algo elegido, el librero pasa a una lista plana; todo vive en la URL (`?orden=`, `?dir=`, `?anio=`, `?genero=`, `?fav=1`). Lógica en `lib/bookView.ts`.
- **Vista de lista**: además de portadas y lomos, una lista compacta con una fila por libro (autor, estado y el dato por el que se ordena).
- **Completar portadas**: si hay libros sin portada (o con la que puso la importación, que puede no existir), una tarjeta al final del librero las revisa y busca las que faltan en Open Library (por ISBN o título), Google Books (con key) y Apple Books (`lib/bookCovers.ts`).

## Edición en lote

- El botón de casilla (arriba a la derecha, junto a ordenar) activa el **modo selección**: tocar un libro lo marca en vez de abrirlo, en el librero, en un estante abierto, en los resultados de búsqueda o filtros y en cualquier vista (portadas, lomos o lista).
- Una barra sobre la navegación muestra cuántos hay marcados, "Todos"/"Ninguno" (lo que se ve en pantalla) y tres acciones:
  - **Estado**: con las mismas reglas que en la ficha (`statusChanges`: fecha de inicio o fin y páginas al terminar). Los que ya tienen ese estado se saltean.
  - **Formato**: reemplaza el formato de todos (sin marcar ninguno, se quita). Arranca con el formato que comparten, si lo comparten.
  - **Eliminar**: pide confirmación y manda todo a la papelera, con "Deshacer" en el aviso.
- Al terminar una acción se sale del modo selección. Lógica en `lib/bookBatch.ts`, barra en `BookSelectionBar.tsx`.

## Papelera

- Borrar un libro desde su ficha lo manda a la **papelera** (`/libros/papelera`, con un acceso al final del librero): sale del librero, de las listas, de las estadísticas y del diario, y el aviso que aparece ofrece "Deshacer".
- Queda **30 días**. Ahí se puede **Restaurar** (vuelve con su historial y sus listas, tal como estaba), eliminar para siempre o vaciar la papelera. Cada libro dice cuántos días le quedan.
- Lo vencido se elimina solo al abrir la app (`MediaProvider` borra lo que lleva más de 30 días). Los plazos están en `lib/trash.ts`.
- Es un borrado "blando": `items.deleted_at` (migración `0015`). `MediaContext` no trae lo que tiene `deleted_at`, y `useActivity` deja afuera su actividad. Sin la migración, la app sigue igual y borrar elimina el libro para siempre (el aviso de confirmación lo dice).
- Solo Libros: Pantalla y Juegos siguen borrando directo. Importar o buscar un libro que está en la papelera lo agrega como nuevo.

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
- "Empezar a leer" o "Releer" según el estado. Releer guarda la lectura terminada en el historial y empieza otra desde la página 0.
- **Lecturas** ("Leído 3 veces"): cada lectura anterior con su inicio, fin y cuántos días tomó, editable y borrable, y "Agregar una lectura anterior" para libros leídos antes de usar la app. Se guardan en `metadata.readings` (`lib/readings.ts`); las relecturas importadas sin fechas se cuentan aparte.
- Un libro releído cuenta en las estadísticas, la meta y el diario de cada año en que se terminó.
- Ritmo en páginas por hora, notas, reseña y datos de la edición.
- **Elegir la edición** (sección "Edición" de la ficha → "Elegir edición"): las ediciones de Open Library del libro, primero las en español, con editorial, año, idioma, formato, páginas e ISBN (modo `editions`, ver `integraciones.md`). Al tocar una se copian sus páginas, ISBN y editorial (y la portada, si se deja marcado "Cambiar también la portada"); lo que la edición no trae queda como estaba. Un libro leído sigue con todas las páginas y uno en curso no pasa del nuevo total. Lógica en `lib/bookEditions.ts`.
- **Más de este autor** (al final de la ficha, con el primer autor del libro): los otros libros suyos que ya tienes, con su estado y un toque a su ficha, y sugerencias de Open Library (modo `byAuthor`, ver `integraciones.md`) con "Quiero leer" y "Empezar a leer". Las sugerencias dejan afuera lo que ya está en el librero (mismo id de Open Library o mismo título sin subtítulo). Se cachean por sesión; si Open Library no responde, queda solo lo que tienes. Lógica en `lib/authorBooks.ts`.
- **Cronómetro de lectura** ("Leer" en la ficha y en el inicio): sigue contando aunque se cierre la app y, al terminar, pide la página con los minutos ya puestos (o guarda solo el tiempo). Es el mismo cronómetro de los juegos: uno a la vez.
- **Cambiar portada**: tocar la portada (o ⋮ → Cambiar portada) ofrece las ediciones de Open Library (primero en español), Apple Books y Google Books (con key), o se sube una foto propia (por ejemplo, de tu edición) o se pega la URL de una imagen.

## Importar de Goodreads o StoryGraph

- En `/libros/importar`, con el CSV que exportan: estados, puntajes, fechas, reseñas, relecturas y formato.
- Los que ya están se saltan y las portadas salen de Open Library por ISBN.
- El archivo se procesa en el dispositivo.

## Estadísticas y diario

- **Estadísticas** (`/libros/estadisticas`): totales (leídos, páginas, tiempo y ritmo de lectura), racha, géneros, formatos y autores, y destacados (mejor puntuado, el más largo y el más corto).
- **Año a mirar** (`?anio=`, por defecto el actual): una fila de años arriba de la parte anual, con los años en que terminaste algún libro. Muestra las metas (de libros y de páginas), lo leído en el año en portadas, libros terminados por mes (con sus títulos), páginas y tiempo por mes, promedios (puntaje, páginas, tiempo y días por libro), el que leíste más rápido y el más lento, y el resumen del año para compartir.
- **Meta de páginas**: además de la de libros leídos, y cuenta las páginas de los libros terminados en el año (como la otra, sin depender del registro de actividad, así sirve con libros importados). Necesita la migración `0014`; sin ella solo está la meta de libros. Los años pasados muestran la meta solo si ya existía.
- Las cuentas por año están en `lib/bookStats.ts`: cada lectura terminada (las de `metadata.readings` y la última) cuenta en el año en que se terminó, y los días que tomó salen de sus fechas de inicio y fin; las lecturas sin las dos fechas no entran en "días por libro" ni en el más rápido y el más lento.
- **Diario de lectura** (`/libros/historial`): día por día, las páginas leídas de cada libro, lo empezado y lo terminado.
