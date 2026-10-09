# Shelf Life

PWA mobile-first para registrar juegos, películas, series, anime y libros. Detalle de funcionalidades, integraciones y setup en `README.md`.

## Idioma

- Responder siempre en español.
- Todo el proyecto está en español: textos de la UI, comentarios, nombres de rutas (`/juegos`, `/pantalla`, `/libros`, `agregar`, `?estado=`) y mensajes de commit. Los identificadores de código (variables, funciones, tipos) van en inglés.
- La UI tutea ("Agrega", "tienes") con algún giro rioplatense ("acá").

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm run build`: type-check (`tsc -b`) + build de Vite. Correrlo antes de commitear.
- `npm run lint`: oxlint. Hay warnings viejos (`set-state-in-effect`, etc.); no sumar nuevos.
- No hay tests automatizados.

## Stack

React 19 + Vite + TypeScript + Tailwind CSS v4 (config en `src/index.css` con `@theme`, sin `tailwind.config`), React Router 7, Supabase (Postgres + Auth + RLS + Edge Functions en Deno), `lucide-react` para íconos, `vite-plugin-pwa`.

## Estructura

- `src/pages/Hub.tsx`: inicio común (`/`), lanzador de los tres trackers.
- `src/trackers/{juegos,pantalla,libros}/`: un tracker por carpeta, cada uno con su `*Tracker.tsx` (rutas propias + barra inferior) cargado con `lazy` desde `App.tsx`. Metadatos de cada tracker en `src/trackers/trackers.ts`.
- Cada tracker tiene todas sus pantallas propias: Juegos; Pantalla, estilo streaming (`ScreenLibrary`, `ScreenAdd`, `ScreenDetail`); Libros, estilo Openreads (`BooksLibrary`/`Bookshelf`, `BookAdd`, `BookDetail`). Pantalla y Libros comparten lógica, no pantallas: la búsqueda (`hooks/useMediaSearch.ts`), las reglas de `lib/media.ts` y componentes chicos (`BlurTextarea`, `Synopsis`, `MediaForm`, `ItemStatusSheet`...).
- Datos: todo vive en la tabla `items` (migración `0011`). Juegos la ve como `Game` mediante la capa de adaptación de `src/lib/gameItem.ts` y `GamesContext`; el resto usa `Item` directo vía `MediaContext` (`src/types/item.ts`).
- Configuración de Pantalla y Libros (etiquetas de estado, rutas, colores) en `mediaSections` de `src/lib/media.ts`. Ahí también están las reglas de avance y de alta: `statusChanges`, `progressChanges`, `withDetails` y `resultToItemWithStatus`. Reusarlas en vez de duplicar la lógica.
- Actividad (episodios, sesiones, lecturas) en `activity_log`; un trigger de la DB suma `time_spent_minutes`. El frontend no suma tiempo a mano.

## Temas y estilos

- Cada tracker activa su tema con `useTrackerTheme(id)`, que pone `body[data-theme]`. Los colores son tokens (`primary`, `accent`, `lavender`, `background`, `background-surface`, `ink`...) redefinidos por tema en `src/index.css`. Usar siempre los tokens, nunca colores fijos, para que la UI se adapte sola.
- Juegos: violeta/magenta. Pantalla: oscuro azulado con celeste. Libros: tema claro "papel" con serif Lora. Marca (inicio/login): azul tinta y ámbar.
- Mobile-first: áreas táctiles de al menos 44 px (`min-h-11`), `PageContainer` para márgenes seguros y espacio de la barra inferior, `haptic()` en acciones, `scrollbar-hide` en filas horizontales.
- Feedback con `useToast` (`showToast` / `showError`) y confirmaciones con `useConfirm`, nunca `alert`/`confirm`.
- Filtros y vistas en la URL (`useSearchParams`), así se conservan al volver de un detalle. `localStorage` solo para preferencias de vista (siempre en try/catch); los datos van a Supabase.

## Supabase

- Migraciones en `supabase/migrations/` numeradas (`0001`...); una nueva va con el número siguiente y se documenta en el README.
- Las APIs externas (IGDB, Steam, TMDB, AniList, Open Library, CheapShark) se llaman solo desde Edge Functions (`supabase/functions/`), nunca desde el frontend. Todas exigen usuario logueado. Secrets con `supabase secrets set`.

## Git y deploy

- Push a `main` = deploy a producción (GitHub Actions → GitHub Pages, https://alexperez7.github.io/shelf-life/, base `/shelf-life/`).
- Commits en español: título corto en infinitivo o sustantivo ("Logo y colores propios de Shelf Life", "Separar la app en tres trackers...") y cuerpo con viñetas de qué cambia para el usuario.
- Al cambiar funcionalidades, actualizar el `README.md`.
