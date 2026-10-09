# Shelf Life — Plan de Desarrollo original (fase solo juegos)

## Resumen del Proyecto
PWA (Progressive Web App) mobile-first para trackear videojuegos: backlog, progreso, horas jugadas y estadísticas personales. Uso personal por ahora, pero el modelo de datos debe quedar preparado para soportar múltiples usuarios en el futuro sin necesidad de migraciones mayores.

## Stack Tecnológico
- **Frontend:** React + Vite + Tailwind CSS
- **PWA:** `vite-plugin-pwa` (Workbox para manifest y service worker)
- **Backend:** Supabase (Postgres + Auth + Edge Functions + RLS)
- **Metadata de juegos:** IGDB API (autenticación vía Twitch OAuth)

## Modelo de Datos (SQL para Supabase)

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  igdb_id integer,
  title text not null,
  platform text,
  status text check (status in ('pendiente','jugando','completado','abandonado','en_pausa')) default 'pendiente',
  hours_played numeric default 0,
  rating integer check (rating between 1 and 10),
  cover_url text,
  genre text,
  notes text,
  date_started date,
  date_finished date,
  created_at timestamptz default now()
);

alter table games enable row level security;

create policy "Users can manage their own games"
  on games for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table play_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  duration_minutes integer not null,
  played_at timestamptz default now(),
  notes text
);

alter table play_sessions enable row level security;

create policy "Users can manage sessions of their own games"
  on play_sessions for all
  using (exists (select 1 from games where games.id = play_sessions.game_id and games.user_id = auth.uid()));
```

## Integración con IGDB

1. Crear cuenta developer en Twitch: https://dev.twitch.tv/console (requiere verificación por teléfono)
2. Registrar una aplicación → obtener `Client ID` y `Client Secret`
3. Obtener token OAuth con flujo Client Credentials:
   `POST https://id.twitch.tv/oauth2/token` — el token dura ~60 días, hay que renovarlo
4. **Nunca exponer el Client Secret en el frontend.** Guardarlo como Secret de una Edge Function de Supabase que actúe de proxy hacia IGDB.
5. Endpoint de búsqueda (formato Apicalypse):
   ```
   POST https://api.igdb.com/v4/games
   Body:
   search "<query>";
   fields name, cover.url, genres.name, platforms.name, first_release_date, summary;
   limit 10;
   ```

## Estructura de Carpetas Sugerida

```
shelf-life/
├── src/
│   ├── components/
│   │   ├── GameCard.tsx
│   │   ├── GameForm.tsx
│   │   ├── BottomNav.tsx
│   │   └── StatsCard.tsx
│   ├── pages/
│   │   ├── Library.tsx
│   │   ├── AddGame.tsx
│   │   ├── Dashboard.tsx
│   │   └── Login.tsx
│   ├── lib/
│   │   └── supabaseClient.ts
│   ├── hooks/
│   │   └── useGames.ts
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── functions/
│       └── igdb-search/
│           └── index.ts
├── public/
│   ├── manifest.json
│   └── icons/
├── vite.config.ts
└── .env.local (no versionar)
```

## Variables de Entorno (frontend)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

El `Client ID` y `Client Secret` de IGDB van SOLO como Secrets de la Edge Function, nunca en variables `VITE_*` del frontend.

## Funcionalidades del MVP

1. Login/registro con Supabase Auth (email/password)
2. Buscador de juegos vía IGDB al agregar uno nuevo (autocompleta portada, género, plataforma)
3. Biblioteca personal con filtros por estado y plataforma
4. Registro de horas jugadas por juego (manual o por sesión)
5. Dashboard con estadísticas: juegos completados, horas totales, juegos en curso

## Diseño Mobile-First / PWA

- Navegación inferior fija: Biblioteca / Agregar / Dashboard
- Tarjetas con portada del juego (grid o lista, según pantalla)
- `manifest.json` + set de íconos (192x192, 512x512) para instalación en pantalla de inicio
- Service worker con Workbox (cache de assets estáticos, no cache de datos de Supabase)
- Viewport objetivo: ~375-430px de ancho

## Fases de Desarrollo (ejecutar en orden)

### Fase 0 — Setup
- Crear proyecto Vite + React + TypeScript
- Instalar y configurar Tailwind CSS
- Instalar `vite-plugin-pwa`
- Crear proyecto en Supabase
- Registrar app en Twitch Developer Portal y obtener credenciales IGDB

### Fase 1 — Datos y autenticación
- Ejecutar el SQL del modelo de datos en Supabase (tablas `games` y `play_sessions`, RLS incluida)
- Configurar Supabase Auth (email/password)
- Crear cliente de Supabase en el frontend (`supabaseClient.ts`)
- Pantalla de login/registro

### Fase 2 — Integración IGDB
- Crear Edge Function `igdb-search` en Supabase
- Implementar obtención y renovación automática del token OAuth
- Probar la búsqueda de juegos desde el frontend

### Fase 3 — CRUD y UI mobile
- Pantalla de biblioteca (listado + filtros por estado/plataforma)
- Formulario de agregar juego, con búsqueda IGDB integrada para autocompletar
- Edición y eliminación de juegos
- Navegación inferior fija

### Fase 4 — PWA
- Configurar `manifest.json` e íconos
- Verificar instalabilidad en Android e iOS
- Cache de assets estáticos con Workbox

### Fase 5 — Dashboard
- Cálculo de estadísticas (horas totales, juegos completados, en curso)
- Visualización simple (tarjetas de resumen)

### Fase 6 — Deploy
- Deploy en Vercel o Netlify
- Configurar variables de entorno en producción
- Probar instalación como PWA en un celular real

## Notas para la implementación

- Priorizar mobile-first en todos los componentes.
- No usar `localStorage`/`sessionStorage` para datos persistentes — todo vía Supabase.
- El secreto de IGDB nunca debe llegar al bundle del frontend.
- Enfoque incremental: cada fase debe quedar funcional antes de avanzar a la siguiente.
