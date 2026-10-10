# Shelf Life

PWA mobile-first para llevar registro de juegos, películas, series, anime y libros: backlog, progreso, tiempo invertido y estadísticas personales.

**En producción:** https://alexperez7.github.io/shelf-life/

## Tres trackers en uno

El inicio junta lo que tienes en curso en los tres, con una acción rápida para cada uno (jugar, +1 episodio, anotar la página), tus números de la semana y las metas del año. Cada tracker tiene su ruta, su tema y sus propias pantallas.

### 🎮 Juegos · [detalle](docs/juegos.md)

- Biblioteca con filtros, búsqueda en IGDB e importación de Steam con horas reales.
- Cronómetro de sesión, sesiones que suman horas solas y progreso por historia, general y 100%.
- Precios en tiendas de PC (CheapShark), duración estimada (IGDB) y cambiar portada.
- Estadísticas con el tiempo para terminar el backlog, y un diario.

### 📺 Pantalla · [detalle](docs/pantalla.md)

- Películas, series y anime con estilo de app de streaming: "Seguir viendo", +1 episodio, temporadas.
- Próximos episodios de lo que sigues y dónde ves cada título.
- Alta con tendencias y vista previa; importar de Letterboxd y MyAnimeList.
- Estadísticas (horas frente a la pantalla, día más maratonero) e historial día por día.

### 📚 Libros · [detalle](docs/libros.md)

- Un librero con repisas por estado, colecciones, géneros y autores; tema claro "papel".
- Alta por título, autor o ISBN, con escáner de código de barras en Android.
- Lectura en curso con ritmo, cronómetro de lectura y formatos (físico, eBook, Kindle, audiolibro...).
- Importar de Goodreads o StoryGraph; estadísticas y diario de lectura.

### Lo común · [detalle](docs/comunes.md)

- Listas que mezclan los tres trackers, compartibles por link público.
- Metas del año por tracker.
- Cambios sin conexión: se ven al instante y se guardan solos al volver la señal.
- Exportar todos los datos (JSON o CSV), PWA instalable y carga instantánea desde cache.

## Stack

- React 19 + Vite + TypeScript + Tailwind CSS v4
- PWA con `vite-plugin-pwa`
- Supabase: Postgres, Auth, RLS y Edge Functions (Deno)
- APIs externas, siempre desde Edge Functions: IGDB, Steam, CheapShark, TMDB, AniList, Open Library ([integraciones](docs/integraciones.md))
- Deploy: GitHub Pages y Supabase con GitHub Actions ([deploy](docs/deploy.md))

## Empezar

```
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

Las migraciones, los secrets de las Edge Functions y el resto de la configuración de Supabase están en [docs/setup.md](docs/setup.md).

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Type-check y build de producción |
| `npm run preview` | Preview del build |
| `npm run lint` | Lint con oxlint |
| `npm test` | Tests de la lógica (Vitest); también corren en el deploy |

## Documentación

- [Juegos](docs/juegos.md), [Pantalla](docs/pantalla.md), [Libros](docs/libros.md) y [lo común a los tres](docs/comunes.md): qué hace cada pantalla.
- [Integraciones](docs/integraciones.md): las Edge Functions y sus modos.
- [Setup](docs/setup.md): instalación, migraciones y secrets.
- [Deploy](docs/deploy.md): GitHub Pages y publicación de las funciones.
- [`plan.md`](plan.md): lo pendiente. [`shelf-life-plan.md`](shelf-life-plan.md): el plan original, ya completo.
