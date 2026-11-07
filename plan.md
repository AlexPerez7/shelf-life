# Plan: pendientes

Lo que quedó anotado para hacer más adelante, en el orden recomendado. El plan original (fase solo juegos) está en `shelf-life-plan.md` y ya está completo.

## Libros: ideas sacadas de Openreads

Comparado con [Openreads](https://github.com/mateusz-bak/openreads) (la app en la que se inspira Libros), en el orden recomendado:

1. **Más de este autor**: en la ficha, los otros libros del mismo autor que tienes, y sugerencias de Open Library.
2. **Elegir la edición**: buscar las ediciones de Open Library de un libro y quedarse con la exacta (páginas, ISBN, editorial, portada).
3. **Papelera**: borrar un libro lo manda a una papelera por 30 días con "Restaurar". Necesita una columna nueva (migración).
4. **Edición en lote**: seleccionar varios libros y cambiarles el formato o el estado, o borrarlos.
5. **Importar de BookWyrm** (CSV), como Goodreads y StoryGraph.

## Ideas sueltas (sin prioridad)

- Más cosas sin conexión: agregar y borrar títulos (necesita ids temporales), borrar sesiones ya guardadas y las listas. Hoy fallan con un error si no hay señal.
- Avisos de próximos episodios (web push): necesita suscripciones guardadas y un envío programado desde una Edge Function.
- Rendimiento con bibliotecas muy grandes (miles de títulos): pedir solo las columnas de la lista (sin sinopsis ni reseñas) y virtualizar las cuadrículas.
- `GOOGLE_BOOKS_API_KEY`: configurarla mejora la búsqueda de libros y suma portadas en "Cambiar portada".
