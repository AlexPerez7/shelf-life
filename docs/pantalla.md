# Pantalla: películas, series y anime

[← Volver al README](../README.md)

Ruta `/pantalla`, código en `src/trackers/pantalla/`. Tema oscuro azulado con celeste, estilo app de streaming.

## Biblioteca

- **"Seguir viendo"** con avance rápido: +1 episodio o "la vi".
- Una fila de pósters por estado y los números del tracker (episodios, horas frente a la pantalla).
- **Dónde ves** cada título: Netflix, Max, Disney+, Prime Video, Apple TV+, Crunchyroll, cine o TV. Se elige al agregar o en el detalle y suma "Dónde ves" en las estadísticas.
- **Próximos episodios** de las series y anime que sigues ("Mañana · T2 · E5"). Los de la semana también aparecen en el inicio.

## Temporadas y episodios

- Las series de TMDB guardan sus temporadas (`metadata.seasons`): el avance se lee "T2 · E5" y el detalle agrupa los episodios por temporada, en secciones plegables.
- Las series agregadas antes de esto se completan solas al abrirlas.
- **Anime de AniList**: cada temporada es otra entrada en AniList. Al terminar una, el detalle muestra "Sigue la historia" con sus secuelas (la temporada siguiente, películas, OVAs) para agregarlas con un toque ("Empezar a ver" o "Quiero ver"); las que ya están en Pantalla llevan a su ficha.
- El episodio también se anota a mano ("Voy en el episodio 1085"), sin sumar tiempo de hoy salvo que se marque "Los vi hoy".

## Detalle

- El póster sobre su fondo difuminado.
- Una acción principal según el estado: ver el siguiente episodio, marcar vista o volver a verla.
- Los episodios como casillas: tocar una marca todo hasta ahí y suma el tiempo visto.
- **Cambiar portada**: tocar el póster (o ⋮ → Cambiar portada) muestra los pósters de TMDB en otros idiomas, o se sube una foto propia o se pega la URL de una imagen.

## Alta

- Antes de escribir, muestra las tendencias del tipo elegido (película, serie o anime).
- Los resultados se ven como pósters. Tocar uno abre una vista previa (sinopsis, duración, episodios) desde la que se agrega directo como "Quiero ver", "Viendo" o "Ya la vi", sin salir de la búsqueda.
- Para lo que no aparece, "Agregar a mano".

## Importar de Letterboxd o MyAnimeList

En `/pantalla/importar`, con el archivo que exportan:

- **Letterboxd**: el .zip tal como baja (o los .csv de adentro). Junta lo visto, el diario, los puntajes, las reseñas y la watchlist; guarda la última vez que se vio cada película y cuántas veces se volvió a ver. Las películas se buscan en TMDB por título y año.
- **MyAnimeList**: el .xml.gz (o .xml). Trae estado, episodios vistos, puntaje, fechas, comentarios y revisionados. El anime se busca en AniList por su id de MAL, así entra con portada, episodios y avance exactos.
- Antes de importar se ve un resumen. Lo que ya está se salta, y lo que no se encuentra se muestra para agregarlo igual (sin portada ni datos) o saltarlo.
- El archivo se procesa en el dispositivo: solo se mandan los títulos o los ids de MAL a la Edge Function.

## Estadísticas e historial

- **Estadísticas** (`/pantalla/estadisticas`): horas frente a la pantalla, películas, episodios, horas por mes, día más maratonero, tipos, géneros, estados, destacados, la meta del año y el resumen del año para compartir.
- **Historial** (`/pantalla/historial`): día por día, lo que agregaste, empezaste, viste ("Viste 3 episodios de...", con el tiempo) y terminaste, con el total de cada día.
