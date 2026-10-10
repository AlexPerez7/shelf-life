# Shelf Life

PWA mobile-first para registrar juegos, películas, series, anime y libros. Detalle de funcionalidades, integraciones y setup en `README.md`. Lo pendiente, en orden, en `plan.md`: al terminar algo de ahí, sacarlo del plan.

## Idioma

- Responder siempre en español.
- Todo el proyecto está en español: textos de la UI, comentarios, nombres de rutas (`/juegos`, `/pantalla`, `/libros`, `agregar`, `?estado=`) y mensajes de commit. Los identificadores de código (variables, funciones, tipos) van en inglés.
- La UI tutea ("Agrega", "tienes") con algún giro rioplatense ("acá").

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm run build`: type-check (`tsc -b`) + build de Vite. Correrlo antes de commitear.
- `npm run lint`: oxlint. Hay warnings viejos (`set-state-in-effect`, etc.); no sumar nuevos.
- `npm test`: Vitest con los tests de la lógica pura (`src/lib/*.test.ts`; datos de prueba en `src/test/factories.ts`). Corre también en el deploy y lo frena si falla. Al tocar algo de `src/lib`, sumar o ajustar su test.

## Stack

React 19 + Vite + TypeScript + Tailwind CSS v4 (config en `src/index.css` con `@theme`, sin `tailwind.config`), React Router 7, Supabase (Postgres + Auth + RLS + Edge Functions en Deno), `lucide-react` para íconos, `vite-plugin-pwa`.

## Estructura

- `src/pages/Hub.tsx`: inicio común (`/`): lo en curso de los tres trackers con avance rápido, la semana y la entrada a cada tracker. El avance rápido de Pantalla y Libros está en `hooks/useQuickProgress.ts` (también lo usa la biblioteca de Pantalla).
- `src/trackers/{juegos,pantalla,libros}/`: un tracker por carpeta, cada uno con su `*Tracker.tsx` (rutas propias + barra inferior) cargado con `lazy` desde `App.tsx`. Metadatos de cada tracker en `src/trackers/trackers.ts`.
- Cada tracker tiene todas sus pantallas propias: Juegos; Pantalla, estilo streaming (`ScreenLibrary`, `ScreenAdd`, `ScreenDetail`); Libros, estilo Openreads (`BooksLibrary`/`Bookshelf`, `BookAdd`, `BookDetail`). Pantalla y Libros comparten lógica, no pantallas: la búsqueda (`hooks/useMediaSearch.ts`), las reglas de `lib/media.ts` y componentes chicos (`BlurTextarea`, `Synopsis`, `MediaForm`, `ItemStatusSheet`...). Sus estadísticas (`ScreenStats`, `BookStats`) usan `hooks/useActivity.ts`, los cálculos de `lib/stats.ts` y las piezas de `components/stats/`; su historial (`ScreenHistory`, `BookHistory`), `lib/history.ts` y `components/HistoryFeed.tsx`; el `Dashboard` de Juegos usa las mismas piezas.
- Metas del año: tabla `goals` (migración `0012`), `hooks/useGoals.ts`, `lib/goals.ts` (el avance se calcula con lo terminado en el año) y `components/stats/GoalCard.tsx`; si la tabla no existe, la UI de metas se oculta.
- Listas: comunes a los tres trackers, en `src/pages/Lists.tsx` y `ListDetail.tsx` (`/listas`); el detalle de cada tracker usa `components/ListPicker.tsx`. `list_items` apunta a `items`.
- Datos: todo vive en la tabla `items` (migración `0011`). Juegos la ve como `Game` mediante la capa de adaptación de `src/lib/gameItem.ts` y `GamesContext`; el resto usa `Item` directo vía `MediaContext` (`src/types/item.ts`).
- Configuración de Pantalla y Libros (etiquetas de estado, rutas, colores) en `mediaSections` de `src/lib/media.ts`. Ahí también están las reglas de avance y de alta: `statusChanges`, `progressChanges`, `withDetails` y `resultToItemWithStatus`. Reusarlas en vez de duplicar la lógica.
- Actividad (episodios, sesiones, lecturas) en `activity_log`; un trigger de la DB suma `time_spent_minutes`. El frontend no suma tiempo a mano.
- Guardado: `updateItem`/`logActivity` (Media) y `updateGame` (Juegos) son optimistas y pasan por `hooks/usePendingSync.ts`: sin conexión el cambio queda en una cola por usuario en el dispositivo (`lib/pendingChanges.ts`) y se reintenta solo. Un cambio nuevo de esos ítems va por ahí, no directo a Supabase; las actividades llevan id generado en el cliente (upsert sin duplicar).

## Temas y estilos

- Cada tracker activa su tema con `useTrackerTheme(id)`, que pone `body[data-theme]`. Los colores son tokens (`primary`, `accent`, `lavender`, `background`, `background-surface`, `ink`...) redefinidos por tema en `src/index.css`. Usar siempre los tokens, nunca colores fijos, para que la UI se adapte sola.
- Juegos: violeta/magenta. Pantalla: oscuro azulado con celeste. Libros: tema claro "papel" con serif Lora. Marca (inicio/login): azul tinta y ámbar.
- Mobile-first: áreas táctiles de al menos 44 px (`min-h-11`), `PageContainer` para márgenes seguros y espacio de la barra inferior, `haptic()` en acciones, `scrollbar-hide` en filas horizontales.
- Rendimiento (se nota en teléfonos de gama media):
  - Portadas con `GameThumb size="thumb"` (miniaturas, fondos difuminados) o `size="poster"` (cuadrículas, repisas): `lib/images.ts` pide al CDN el tamaño justo.
  - Nada de `backdrop-blur` en lo que queda fijo al hacer scroll (barras, encabezados sticky): fondo casi opaco en su lugar.
  - Listas que pueden ser largas (librero, estantes) se muestran por tandas o con `cv-auto` (`content-visibility`).
  - Datos que no viven en un contexto (`useActivity`, `useGoals`, `useUpcoming`, `useTrending`) se cachean a nivel de módulo y se revalidan al montar.
  - Lo que cambia cada segundo (cronómetro) va en un componente chico propio, no en la pantalla entera.
- Feedback con `useToast` (`showToast` / `showError`) y confirmaciones con `useConfirm`, nunca `alert`/`confirm`.
- Filtros y vistas en la URL (`useSearchParams`), así se conservan al volver de un detalle. `localStorage` solo para preferencias de vista (siempre en try/catch); los datos van a Supabase.

## Supabase

- Migraciones en `supabase/migrations/` numeradas (`0001`...); una nueva va con el número siguiente y se documenta en el README.
- Las APIs externas (IGDB, Steam, TMDB, AniList, Open Library, CheapShark) se llaman solo desde Edge Functions (`supabase/functions/`), nunca desde el frontend. Todas exigen usuario logueado. Secrets con `supabase secrets set`.

## Git y deploy

- Push a `main` = deploy a producción (GitHub Actions → GitHub Pages, https://alexperez7.github.io/shelf-life/, base `/shelf-life/`).
- Commits en español: título corto en infinitivo o sustantivo ("Logo y colores propios de Shelf Life", "Separar la app en tres trackers...") y cuerpo con viñetas de qué cambia para el usuario.
- Al cambiar funcionalidades, actualizar el `README.md`.
