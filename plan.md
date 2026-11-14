# Plan: pendientes

Lo que quedó anotado para hacer más adelante, en el orden recomendado. El plan original (fase solo juegos) está en `shelf-life-plan.md` y ya está completo.

## Ideas sueltas (sin prioridad)

- Rendimiento con bibliotecas muy grandes (miles de títulos): pedir solo las columnas de la lista (sin sinopsis ni reseñas) y virtualizar las cuadrículas. Las listas largas ya se muestran por tandas o con `cv-auto`. Lo de las columnas no es solo cambiar el `select`: los tres detalles y `MediaForm` leen `summary`, `review` y `notes` del contexto, así que hay que cargarlos al abrir un título (y no dejar editar las notas hasta que lleguen, o se pisarían en blanco). Además, sin conexión los títulos que no se abrieron antes perderían esos datos. Conviene hacerlo solo si una biblioteca real llega a ir lenta, y probándolo contra Supabase.
- `GOOGLE_BOOKS_API_KEY`: configurarla mejora la búsqueda de libros y suma portadas en "Cambiar portada".
