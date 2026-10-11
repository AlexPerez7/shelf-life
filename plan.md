# Plan: pendientes

Lo que quedó anotado para hacer más adelante, en el orden recomendado. El plan original (fase solo juegos) está en `shelf-life-plan.md` y ya está completo.

## Libros: ideas sacadas de Openreads

Comparado con [Openreads](https://github.com/mateusz-bak/openreads) (la app en la que se inspira Libros), en el orden recomendado:

1. **Completar portadas que faltan**: después de importar de Goodreads o StoryGraph, varios libros quedan sin portada. Un botón que busque en lote por ISBN o título (Open Library) y complete las que encuentre.
2. **Orden y filtros en el librero**: ordenar por autor, puntaje, páginas, fecha en que lo terminaste o año de publicación; filtrar por año leído, etiqueta o favoritos. Y una vista de lista compacta además del librero.
3. **Más estadísticas**: meta de páginas del año (además de la de libros), promedios (puntaje, páginas, tiempo por libro), el libro que leíste más rápido y el más lento, libros terminados por mes y elegir el año a mirar.
4. **Más de este autor**: en la ficha, los otros libros del mismo autor que tienes, y sugerencias de Open Library.
5. **Elegir la edición**: buscar las ediciones de Open Library de un libro y quedarse con la exacta (páginas, ISBN, editorial, portada).
6. **Papelera**: borrar un libro lo manda a una papelera por 30 días con "Restaurar". Necesita una columna nueva (migración).
7. **Edición en lote**: seleccionar varios libros y cambiarles el formato o el estado, o borrarlos.
8. **Importar de BookWyrm** (CSV), como Goodreads y StoryGraph.

## Ideas sueltas (sin prioridad)

- Más cosas sin conexión: agregar y borrar títulos (necesita ids temporales), borrar sesiones ya guardadas y las listas. Hoy fallan con un error si no hay señal.
- Avisos de próximos episodios (web push): necesita suscripciones guardadas y un envío programado desde una Edge Function.
- Rendimiento con bibliotecas muy grandes (miles de títulos): pedir solo las columnas de la lista (sin sinopsis ni reseñas) y virtualizar las cuadrículas.
- `GOOGLE_BOOKS_API_KEY`: configurarla mejora la búsqueda de libros y suma portadas en "Cambiar portada".
