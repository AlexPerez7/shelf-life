// Edge Function: búsqueda de películas, series y anime.
//   - Películas y series: TMDB. Secret requerido (nunca en el frontend):
//       supabase secrets set TMDB_API_KEY=xxx
//     Acepta la "API Key" (v3) o el "API Read Access Token" (v4, empieza con eyJ).
//   - Anime: AniList (GraphQL público, sin key).
//
// Body: { type: 'movie' | 'series' | 'anime', query?: string, id?: string }
//   - con `query` -> búsqueda por texto (hasta 12 resultados)
//   - con `id`    -> detalle de un resultado (duración, episodios), que se pide
//                    al agregar: la búsqueda de TMDB no trae esos datos.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { handlePreflight, jsonResponse, errorResponse } from '../_shared/http.ts'
import { requireUser } from '../_shared/supabase.ts'

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
const TMDB_LANGUAGE = 'es-ES'
const MAX_TEXT = 200

type ScreenType = 'movie' | 'series' | 'anime'

/** Forma común de un resultado, sea de TMDB o de AniList. */
interface MediaResult {
  source: 'tmdb' | 'anilist'
  external_id: string
  media_type: ScreenType
  title: string
  original_title: string | null
  cover_url: string | null
  /** 'YYYY-MM-DD' (o 'YYYY-01-01' si solo se conoce el año). */
  release_date: string | null
  genres: string[]
  summary: string | null
  /** Episodios totales (series y anime), si se conocen. */
  episodes: number | null
  /** Duración de la película, o de cada episodio, en minutos. */
  runtime_minutes: number | null
}

// ---------------------------------------------------------------------------
// TMDB
// ---------------------------------------------------------------------------

class NotConfiguredError extends Error {}

async function tmdb(path: string, params: Record<string, string> = {}): Promise<any> {
  if (!TMDB_API_KEY) {
    throw new NotConfiguredError('La búsqueda de películas y series todavía no está configurada.')
  }
  const isBearer = TMDB_API_KEY.startsWith('eyJ')
  const search = new URLSearchParams({ language: TMDB_LANGUAGE, ...params })
  if (!isBearer) search.set('api_key', TMDB_API_KEY)
  const res = await fetch(`https://api.themoviedb.org/3${path}?${search}`, {
    headers: isBearer ? { Authorization: `Bearer ${TMDB_API_KEY}` } : {},
  })
  if (!res.ok) throw new Error(`Error de TMDB (${res.status})`)
  return res.json()
}

const tmdbImage = (path?: string | null) => (path ? `https://image.tmdb.org/t/p/w500${path}` : null)

// La búsqueda devuelve ids de género: la lista de nombres se pide una vez por
// instancia de la función.
const genreCache: Partial<Record<'movie' | 'tv', Map<number, string>>> = {}

async function tmdbGenres(kind: 'movie' | 'tv'): Promise<Map<number, string>> {
  if (!genreCache[kind]) {
    const data = await tmdb(`/genre/${kind}/list`)
    genreCache[kind] = new Map(
      (data.genres ?? []).map((g: { id: number; name: string }) => [g.id, g.name])
    )
  }
  return genreCache[kind]!
}

function tmdbToResult(r: any, type: 'movie' | 'series', genreNames: string[]): MediaResult {
  const isMovie = type === 'movie'
  return {
    source: 'tmdb',
    external_id: String(r.id),
    media_type: type,
    title: (isMovie ? r.title : r.name) ?? '',
    original_title: (isMovie ? r.original_title : r.original_name) ?? null,
    cover_url: tmdbImage(r.poster_path),
    release_date: (isMovie ? r.release_date : r.first_air_date) || null,
    genres: genreNames,
    summary: r.overview || null,
    episodes: isMovie ? null : (r.number_of_episodes ?? null),
    runtime_minutes: isMovie ? (r.runtime || null) : (r.episode_run_time?.[0] ?? null),
  }
}

async function tmdbSearch(type: 'movie' | 'series', query: string): Promise<MediaResult[]> {
  const kind = type === 'movie' ? 'movie' : 'tv'
  const [data, genres] = await Promise.all([
    tmdb(`/search/${kind}`, { query, include_adult: 'false' }),
    tmdbGenres(kind),
  ])
  return (data.results ?? [])
    .slice(0, 12)
    .map((r: any) =>
      tmdbToResult(
        r,
        type,
        (r.genre_ids ?? []).map((id: number) => genres.get(id)).filter(Boolean)
      )
    )
}

async function tmdbDetails(type: 'movie' | 'series', id: string): Promise<MediaResult> {
  const r = await tmdb(`/${type === 'movie' ? 'movie' : 'tv'}/${id}`)
  return tmdbToResult(r, type, (r.genres ?? []).map((g: { name: string }) => g.name))
}

// ---------------------------------------------------------------------------
// AniList
// ---------------------------------------------------------------------------

const ANILIST_FIELDS = `
  id
  title { romaji english native }
  coverImage { large extraLarge }
  startDate { year month day }
  genres
  description(asHtml: false)
  episodes
  duration
`

async function anilist(query: string, variables: Record<string, unknown>): Promise<any> {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Error de AniList (${res.status})`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(`Error de AniList: ${json.errors[0].message}`)
  return json.data
}

const pad = (n: number) => String(n).padStart(2, '0')

/** La descripción de AniList trae <br>, <i> y marcas de spoiler. */
function cleanDescription(text?: string | null): string | null {
  if (!text) return null
  return (
    text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/~!.*?!~/gs, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || null
  )
}

function anilistToResult(m: any): MediaResult {
  const d = m.startDate ?? {}
  return {
    source: 'anilist',
    external_id: String(m.id),
    media_type: 'anime',
    title: m.title?.english || m.title?.romaji || m.title?.native || '',
    original_title: m.title?.romaji ?? null,
    cover_url: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
    release_date: d.year ? `${d.year}-${pad(d.month ?? 1)}-${pad(d.day ?? 1)}` : null,
    genres: m.genres ?? [],
    summary: cleanDescription(m.description),
    episodes: m.episodes ?? null,
    runtime_minutes: m.duration ?? null,
  }
}

async function anilistSearch(query: string): Promise<MediaResult[]> {
  const data = await anilist(
    `query ($search: String) {
      Page(perPage: 12) {
        media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) { ${ANILIST_FIELDS} }
      }
    }`,
    { search: query }
  )
  return (data.Page?.media ?? []).map(anilistToResult)
}

async function anilistDetails(id: string): Promise<MediaResult> {
  const data = await anilist(`query ($id: Int) { Media(id: $id, type: ANIME) { ${ANILIST_FIELDS} } }`, {
    id: Number(id),
  })
  return anilistToResult(data.Media)
}

// ---------------------------------------------------------------------------

serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth

    const { type, query, id } = await req.json().catch(() => ({}))
    if (type !== 'movie' && type !== 'series' && type !== 'anime') {
      return jsonResponse({ error: 'Tipo inválido' }, 400)
    }

    if (id != null) {
      const safeId = String(id)
      if (!/^\d{1,12}$/.test(safeId)) return jsonResponse({ error: 'Id inválido' }, 400)
      return jsonResponse(
        type === 'anime' ? await anilistDetails(safeId) : await tmdbDetails(type, safeId)
      )
    }

    if (!query || typeof query !== 'string') {
      return jsonResponse({ error: 'Falta el parámetro query' }, 400)
    }
    const text = query.slice(0, MAX_TEXT)
    return jsonResponse(type === 'anime' ? await anilistSearch(text) : await tmdbSearch(type, text))
  } catch (err) {
    // 503 con un mensaje claro: el frontend lo muestra tal cual.
    if (err instanceof NotConfiguredError) return errorResponse(err, 503)
    return errorResponse(err)
  }
})
