// Edge Function: búsqueda de películas, series, anime y libros.
//   - Películas y series: TMDB. Secret requerido (nunca en el frontend):
//       supabase secrets set TMDB_API_KEY=xxx
//     Acepta la "API Key" (v3) o el "API Read Access Token" (v4, empieza con eyJ).
//   - Anime: AniList (GraphQL público, sin key).
//   - Libros: Open Library (sin key). Si se configura
//       supabase secrets set GOOGLE_BOOKS_API_KEY=xxx
//     se usa primero Google Books (mejores portadas y sinopsis) y Open Library
//     queda de respaldo. Sin key, Google Books ya no responde (cuota 0).
//
// Body: { type: 'movie' | 'series' | 'anime' | 'book', query?: string, id?: string, source?: string, mode?: 'trending' | 'upcoming' | 'covers' | 'match' | 'mal', ids?: string[], title?: string, author?: string, titles?: { title: string, year?: number }[] }
//   - con `query` -> búsqueda por texto (hasta 12 resultados)
//   - con `mode: 'trending'` -> lo que es tendencia esta semana (TMDB) o esta
//                    temporada (AniList), para "Descubrir" en Pantalla. No
//                    aplica a libros.
//   - con `mode: 'upcoming'` + `ids` (hasta 40, de series o anime) -> el
//                    próximo episodio de cada uno, si tiene fecha.
//   - con `mode: 'covers'` -> portadas alternativas para elegir: libros por
//                    `title`/`author` (y `id` si es de Open Library) en Open
//                    Library (todas sus ediciones), Apple Books y Google
//                    Books; películas y series por `id` en TMDB.
//   - con `mode: 'match'` + `titles` (hasta 20 películas, con su año) -> la
//                    película de TMDB que corresponde a cada título, con el
//                    detalle, o `null`; en el mismo orden. Para importar de
//                    Letterboxd.
//   - con `mode: 'mal'` + `ids` (hasta 50 ids de MyAnimeList) -> el anime de
//                    AniList de cada uno, con `mal_id`. Para importar de MAL.
//   - con `id`    -> detalle de un resultado (duración, episodios, sinopsis),
//                    que se pide al agregar: algunas búsquedas no lo traen.
//                    Para libros, `source` dice de qué API es el id.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { handlePreflight, jsonResponse, errorResponse } from '../_shared/http.ts'
import { requireUser } from '../_shared/supabase.ts'

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
const GOOGLE_BOOKS_API_KEY = Deno.env.get('GOOGLE_BOOKS_API_KEY')
const TMDB_LANGUAGE = 'es-ES'
const MAX_TEXT = 200

type MediaType = 'movie' | 'series' | 'anime' | 'book'

/** Forma común de un resultado, sea de TMDB o de AniList. */
interface MediaResult {
  source: 'tmdb' | 'anilist' | 'google_books' | 'openlibrary'
  external_id: string
  media_type: MediaType
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
  /** Series de TMDB (solo en el detalle): episodios de cada temporada, sin especiales. */
  seasons?: number[]
  /** Libros. */
  pages?: number | null
  authors?: string[]
  isbn?: string | null
  publisher?: string | null
}

/** Próximo episodio de una serie o anime que se sigue. */
interface Upcoming {
  external_id: string
  /** 'YYYY-MM-DD' (TMDB) o fecha y hora ISO (AniList). */
  air_date: string
  season: number | null
  episode: number | null
  name: string | null
}

const MAX_UPCOMING = 40
const MAX_MATCH = 20
const MAX_MAL = 50

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
  const url = `https://api.themoviedb.org/3${path}?${search}`
  const headers = isBearer ? { Authorization: `Bearer ${TMDB_API_KEY}` } : {}
  let res = await fetch(url, { headers })
  // Límite de pedidos (importaciones grandes): se espera y se reintenta.
  for (let retry = 1; res.status === 429 && retry <= 2; retry++) {
    await new Promise((r) => setTimeout(r, 1000 * retry))
    res = await fetch(url, { headers })
  }
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

/** Tendencias de la semana en TMDB (hasta 20). */
async function tmdbTrending(type: 'movie' | 'series'): Promise<MediaResult[]> {
  const kind = type === 'movie' ? 'movie' : 'tv'
  const [data, genres] = await Promise.all([tmdb(`/trending/${kind}/week`), tmdbGenres(kind)])
  return (data.results ?? [])
    .slice(0, 20)
    .map((r: any) =>
      tmdbToResult(
        r,
        type,
        (r.genre_ids ?? []).map((id: number) => genres.get(id)).filter(Boolean)
      )
    )
}

/** Próximo episodio con fecha de una serie de TMDB (o nada). */
async function tmdbUpcoming(id: string): Promise<Upcoming | null> {
  const r = await tmdb(`/tv/${id}`)
  const next = r.next_episode_to_air
  if (!next?.air_date) return null
  return {
    external_id: id,
    air_date: next.air_date,
    season: next.season_number ?? null,
    episode: next.episode_number ?? null,
    name: next.name || null,
  }
}

async function tmdbDetails(type: 'movie' | 'series', id: string): Promise<MediaResult> {
  const r = await tmdb(`/${type === 'movie' ? 'movie' : 'tv'}/${id}`)
  const result = tmdbToResult(r, type, (r.genres ?? []).map((g: { name: string }) => g.name))
  if (type === 'series') {
    // La temporada 0 son los especiales: no cuentan para el avance.
    const seasons = (r.seasons ?? [])
      .filter((s: any) => s.season_number > 0 && s.episode_count > 0)
      .sort((a: any, b: any) => a.season_number - b.season_number)
      .map((s: any) => s.episode_count as number)
    if (seasons.length > 0) result.seasons = seasons
  }
  return result
}

/** Año de una fecha 'YYYY-MM-DD' de TMDB. */
const yearOf = (date?: string | null) => (date ? Number(date.slice(0, 4)) : null)

/**
 * La película de TMDB para un título y año (de Letterboxd): primero con ese
 * año de estreno; si no aparece, sin año, aceptando un año de diferencia
 * (los estrenos por país varían). `null` si no hay ninguna.
 */
async function tmdbMatchMovie(title: string, year: number | null): Promise<MediaResult | null> {
  let results: any[] = []
  if (year) {
    const params = { query: title, include_adult: 'false', primary_release_year: String(year) }
    results = (await tmdb('/search/movie', params)).results ?? []
  }
  if (results.length === 0) {
    const all = (await tmdb('/search/movie', { query: title, include_adult: 'false' })).results ?? []
    results = year
      ? all.filter((r: any) => {
          const y = yearOf(r.release_date)
          return y != null && Math.abs(y - year) <= 1
        })
      : all
  }
  if (results.length === 0) return null
  return tmdbDetails('movie', String(results[0].id))
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

/** Anime en tendencia en AniList (hasta 20). */
async function anilistTrending(): Promise<MediaResult[]> {
  const data = await anilist(
    `query {
      Page(perPage: 20) {
        media(type: ANIME, isAdult: false, sort: TRENDING_DESC) { ${ANILIST_FIELDS} }
      }
    }`,
    {}
  )
  return (data.Page?.media ?? []).map(anilistToResult)
}

/** Próximos episodios de varios anime de AniList, en una consulta. */
async function anilistUpcoming(ids: string[]): Promise<Upcoming[]> {
  const data = await anilist(
    `query ($ids: [Int]) {
      Page(perPage: 50) {
        media(id_in: $ids, type: ANIME) { id nextAiringEpisode { airingAt episode } }
      }
    }`,
    { ids: ids.map(Number) }
  )
  return (data.Page?.media ?? [])
    .filter((m: any) => m.nextAiringEpisode?.airingAt)
    .map((m: any) => ({
      external_id: String(m.id),
      air_date: new Date(m.nextAiringEpisode.airingAt * 1000).toISOString(),
      season: null,
      episode: m.nextAiringEpisode.episode ?? null,
      name: null,
    }))
}

/** Anime de AniList por id de MyAnimeList (hasta 50 en una consulta). */
async function anilistByMal(ids: string[]): Promise<(MediaResult & { mal_id: string })[]> {
  const data = await anilist(
    `query ($ids: [Int]) {
      Page(perPage: 50) {
        media(idMal_in: $ids, type: ANIME) { idMal ${ANILIST_FIELDS} }
      }
    }`,
    { ids: ids.map(Number) }
  )
  return (data.Page?.media ?? []).map((m: any) => ({ ...anilistToResult(m), mal_id: String(m.idMal) }))
}

async function anilistDetails(id: string): Promise<MediaResult> {
  const data = await anilist(`query ($id: Int) { Media(id: $id, type: ANIME) { ${ANILIST_FIELDS} } }`, {
    id: Number(id),
  })
  return anilistToResult(data.Media)
}

// ---------------------------------------------------------------------------
// Libros: Google Books (con key) y Open Library
// ---------------------------------------------------------------------------

/** 'YYYY', 'YYYY-MM' o 'YYYY-MM-DD' -> 'YYYY-MM-DD'. */
function normalizeDate(value?: string | null): string | null {
  const m = value?.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/)
  return m ? `${m[1]}-${m[2] ?? '01'}-${m[3] ?? '01'}` : null
}

function stripHtml(text?: string | null): string | null {
  if (!text) return null
  return (
    text
      .replace(/<br\s*\/?>|<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || null
  )
}

async function googleBooks(path: string, params: Record<string, string> = {}): Promise<any> {
  const search = new URLSearchParams({ ...params, key: GOOGLE_BOOKS_API_KEY! })
  const res = await fetch(`https://www.googleapis.com/books/v1${path}?${search}`)
  if (!res.ok) throw new Error(`Error de Google Books (${res.status})`)
  return res.json()
}

function googleToResult(v: any): MediaResult {
  const info = v.volumeInfo ?? {}
  const ids: { type: string; identifier: string }[] = info.industryIdentifiers ?? []
  const cover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null
  return {
    source: 'google_books',
    external_id: v.id,
    media_type: 'book',
    title: info.subtitle ? `${info.title}: ${info.subtitle}` : (info.title ?? ''),
    original_title: null,
    // http -> https y sin el borde "doblado" que agrega Google.
    cover_url: cover ? cover.replace(/^http:/, 'https:').replace('&edge=curl', '') : null,
    release_date: normalizeDate(info.publishedDate),
    genres: info.categories ?? [],
    summary: stripHtml(info.description),
    episodes: null,
    runtime_minutes: null,
    pages: info.pageCount || null,
    authors: info.authors ?? [],
    isbn:
      ids.find((i) => i.type === 'ISBN_13')?.identifier ??
      ids.find((i) => i.type === 'ISBN_10')?.identifier ??
      null,
    publisher: info.publisher ?? null,
  }
}

async function googleSearch(query: string): Promise<MediaResult[]> {
  const data = await googleBooks('/volumes', { q: query, maxResults: '12', printType: 'books' })
  return (data.items ?? []).map(googleToResult)
}

async function openLibrary(path: string): Promise<any> {
  const res = await fetch(`https://openlibrary.org${path}`, {
    headers: { 'User-Agent': 'ShelfLife/1.0 (+https://alexperez7.github.io/shelf-life/)' },
  })
  if (!res.ok) throw new Error(`Error de Open Library (${res.status})`)
  return res.json()
}

const OL_FIELDS =
  'key,title,subtitle,author_name,first_publish_year,number_of_pages_median,cover_i,subject,isbn'

function olToResult(d: any): MediaResult {
  return {
    source: 'openlibrary',
    external_id: String(d.key ?? '').replace('/works/', ''),
    media_type: 'book',
    title: d.subtitle ? `${d.title}: ${d.subtitle}` : (d.title ?? ''),
    original_title: null,
    cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    release_date: d.first_publish_year ? `${d.first_publish_year}-01-01` : null,
    // Los "subjects" de Open Library son muy ruidosos: solo los primeros.
    genres: (d.subject ?? []).slice(0, 4),
    summary: null,
    episodes: null,
    runtime_minutes: null,
    pages: d.number_of_pages_median ?? null,
    authors: d.author_name ?? [],
    isbn: (d.isbn ?? []).find((i: string) => i.length === 13) ?? d.isbn?.[0] ?? null,
    publisher: null,
  }
}

async function olSearch(query: string): Promise<MediaResult[]> {
  const params = new URLSearchParams({ q: query, limit: '12', fields: OL_FIELDS })
  const data = await openLibrary(`/search.json?${params}`)
  return (data.docs ?? []).map(olToResult)
}

/** Detalle de una obra: la búsqueda no trae la sinopsis. */
async function olDetails(id: string): Promise<MediaResult> {
  let work = await openLibrary(`/works/${id}.json`)
  // Obras fusionadas: Open Library responde con una redirección.
  if (work.type?.key === '/type/redirect' && work.location) {
    work = await openLibrary(`${work.location}.json`)
  }
  const workKey = String(work.key ?? `/works/${id}`)
  const params = new URLSearchParams({ q: `key:${workKey}`, limit: '1', fields: OL_FIELDS })
  const doc = (await openLibrary(`/search.json?${params}`)).docs?.[0] ?? {
    key: workKey,
    title: work.title,
  }
  const description =
    typeof work.description === 'string' ? work.description : work.description?.value
  return { ...olToResult(doc), summary: stripHtml(description) }
}

async function bookSearch(query: string): Promise<MediaResult[]> {
  if (GOOGLE_BOOKS_API_KEY) {
    try {
      const results = await googleSearch(query)
      if (results.length > 0) return results
    } catch {
      /* cuota agotada o caída: se sigue con Open Library */
    }
  }
  return olSearch(query)
}

async function bookDetails(source: unknown, id: string): Promise<MediaResult> {
  if (source === 'google_books' && GOOGLE_BOOKS_API_KEY) {
    return googleToResult(await googleBooks(`/volumes/${id}`))
  }
  return olDetails(id)
}

// ---------------------------------------------------------------------------
// Portadas alternativas
// ---------------------------------------------------------------------------

interface CoverOption {
  url: string
  source: 'openlibrary' | 'apple' | 'google_books' | 'tmdb'
  /** Edición o idioma, para distinguirlas ("Salamandra · 2000", "ES"). */
  label: string | null
}

const MAX_COVERS = 60

/** Portadas de las ediciones de una obra en Open Library, primero las en español. */
async function olCovers(workId: string | null, title: string, author: string): Promise<CoverOption[]> {
  let works = workId ? [workId] : []
  if (works.length === 0 && title) {
    // `q` busca también en los títulos de cada edición (ej. el título en
    // español); solo la primera obra: las siguientes suelen ser otros libros.
    const params = new URLSearchParams({ q: [title, author].filter(Boolean).join(' '), limit: '1', fields: 'key' })
    const data = await openLibrary(`/search.json?${params}`)
    works = (data.docs ?? []).map((d: any) => String(d.key ?? '').replace('/works/', '')).filter(Boolean)
  }
  const out: (CoverOption & { spanish: boolean })[] = []
  for (const work of works.slice(0, 1)) {
    const data = await openLibrary(`/works/${work}/editions.json?limit=100`)
    for (const e of data.entries ?? []) {
      const cover = (e.covers ?? []).find((c: number) => c > 0)
      if (!cover) continue
      out.push({
        url: `https://covers.openlibrary.org/b/id/${cover}-L.jpg`,
        source: 'openlibrary',
        label: [e.publishers?.[0], e.publish_date].filter(Boolean).join(' · ') || null,
        spanish: (e.languages ?? []).some((l: any) => l.key === '/languages/spa'),
      })
    }
  }
  return out.sort((a, b) => Number(b.spanish) - Number(a.spanish)).map(({ spanish: _, ...c }) => c)
}

/** Portadas de Apple Books (ebooks), de las tiendas de España, México y EE. UU. */
async function appleCovers(title: string, author: string): Promise<CoverOption[]> {
  const term = [title, author].filter(Boolean).join(' ')
  if (!term) return []
  const results = await Promise.allSettled(
    ['es', 'mx', 'us'].map(async (country) => {
      const params = new URLSearchParams({ term, entity: 'ebook', limit: '15', country })
      const res = await fetch(`https://itunes.apple.com/search?${params}`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.results ?? [])
        // Fuera guías de lectura y resúmenes de terceros.
        .filter((r: any) => r.artworkUrl100 && !/resumen|gu[ií]a de lectura|summary|study guide/i.test(r.trackName ?? ''))
        .map((r: any) => ({
          // La URL acepta el tamaño: 600 px alcanza para el detalle.
          url: String(r.artworkUrl100).replace(/\/\d+x\d+bb\./, '/600x900bb.'),
          source: 'apple' as const,
          label: `Apple Books · ${country.toUpperCase()}`,
        }))
    })
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

/** Portadas de Google Books (solo con key). */
async function googleCovers(title: string, author: string): Promise<CoverOption[]> {
  if (!GOOGLE_BOOKS_API_KEY || !title) return []
  const q = [`intitle:${title}`, author ? `inauthor:${author}` : ''].filter(Boolean).join('+')
  const data = await googleBooks('/volumes', { q, maxResults: '20', printType: 'books' })
  return (data.items ?? [])
    .map((v: any) => {
      const info = v.volumeInfo ?? {}
      const cover = info.imageLinks?.thumbnail
      if (!cover) return null
      return {
        url: String(cover).replace(/^http:/, 'https:').replace('&edge=curl', ''),
        source: 'google_books' as const,
        label: [info.publisher, info.publishedDate?.slice(0, 4)].filter(Boolean).join(' · ') || null,
      }
    })
    .filter(Boolean)
}

/** Pósters de TMDB de una película o serie: español, inglés y sin texto. */
async function tmdbCovers(type: 'movie' | 'series', id: string): Promise<CoverOption[]> {
  const data = await tmdb(`/${type === 'movie' ? 'movie' : 'tv'}/${id}/images`, {
    include_image_language: 'es,en,null',
  })
  return (data.posters ?? []).map((p: any) => ({
    url: `https://image.tmdb.org/t/p/w500${p.file_path}`,
    source: 'tmdb' as const,
    label: p.iso_639_1 ? String(p.iso_639_1).toUpperCase() : 'Sin texto',
  }))
}

/** Sin repetidas y con un tope; si una fuente falla, quedan las demás. */
async function collectCovers(sources: Promise<CoverOption[]>[]): Promise<CoverOption[]> {
  const results = await Promise.allSettled(sources)
  const seen = new Set<string>()
  const out: CoverOption[] = []
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const c of r.value) {
      if (seen.has(c.url)) continue
      seen.add(c.url)
      out.push(c)
    }
  }
  return out.slice(0, MAX_COVERS)
}

// ---------------------------------------------------------------------------

/** Ids aceptados: numéricos (TMDB, AniList) o alfanuméricos (libros). */
const ID_PATTERN: Record<MediaType, RegExp> = {
  movie: /^\d{1,12}$/,
  series: /^\d{1,12}$/,
  anime: /^\d{1,12}$/,
  book: /^[A-Za-z0-9_-]{1,40}$/,
}

serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth

    const body = await req.json().catch(() => ({}))
    const { type, query, id, source, mode } = body
    if (typeof type !== 'string' || !(type in ID_PATTERN)) {
      return jsonResponse({ error: 'Tipo inválido' }, 400)
    }
    const mediaType = type as MediaType

    if (mode === 'covers') {
      const title = typeof body.title === 'string' ? body.title.slice(0, MAX_TEXT) : ''
      const author = typeof body.author === 'string' ? body.author.slice(0, MAX_TEXT) : ''
      const safeId = id != null && ID_PATTERN[mediaType].test(String(id)) ? String(id) : null
      if (mediaType === 'book') {
        const workId = source === 'openlibrary' && safeId && /^OL\d+W$/.test(safeId) ? safeId : null
        return jsonResponse(
          await collectCovers([
            olCovers(workId, title, author),
            appleCovers(title, author),
            googleCovers(title, author),
          ])
        )
      }
      if ((mediaType === 'movie' || mediaType === 'series') && safeId) {
        return jsonResponse(await collectCovers([tmdbCovers(mediaType, safeId)]))
      }
      return jsonResponse([])
    }

    if (mode === 'match') {
      if (mediaType !== 'movie') return jsonResponse({ error: 'Solo películas' }, 400)
      const titles = (Array.isArray(body.titles) ? body.titles : []).slice(0, MAX_MATCH)
      // Una película que falla no corta las demás: queda sin coincidencia.
      const results = await Promise.allSettled(
        titles.map((t: any) => {
          const title = typeof t?.title === 'string' ? t.title.trim().slice(0, MAX_TEXT) : ''
          const year = Number.isInteger(t?.year) && t.year > 1800 && t.year < 3000 ? t.year : null
          return title ? tmdbMatchMovie(title, year) : Promise.resolve(null)
        })
      )
      return jsonResponse(results.map((r) => (r.status === 'fulfilled' ? r.value : null)))
    }

    if (mode === 'mal') {
      if (mediaType !== 'anime') return jsonResponse({ error: 'Solo anime' }, 400)
      const ids = (Array.isArray(body.ids) ? body.ids : [])
        .map(String)
        .filter((x: string) => ID_PATTERN.anime.test(x))
        .slice(0, MAX_MAL)
      return jsonResponse(ids.length ? await anilistByMal(ids) : [])
    }

    if (mode === 'upcoming') {
      if (mediaType !== 'series' && mediaType !== 'anime') {
        return jsonResponse({ error: 'Solo series y anime tienen próximos episodios' }, 400)
      }
      const ids = (Array.isArray(body.ids) ? body.ids : [])
        .map(String)
        .filter((x: string) => ID_PATTERN[mediaType].test(x))
        .slice(0, MAX_UPCOMING)
      if (ids.length === 0) return jsonResponse([])
      if (mediaType === 'anime') return jsonResponse(await anilistUpcoming(ids))
      // Una serie que falla (borrada en TMDB, etc.) no corta las demás.
      const results = await Promise.allSettled(ids.map(tmdbUpcoming))
      return jsonResponse(
        results.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
      )
    }

    if (mode === 'trending') {
      if (mediaType === 'book') return jsonResponse({ error: 'Sin tendencias para libros' }, 400)
      return jsonResponse(mediaType === 'anime' ? await anilistTrending() : await tmdbTrending(mediaType))
    }

    // Detalle por id: después de los modos, que también pueden traer `id`
    // (ej. portadas de una película).
    if (id != null) {
      const safeId = String(id)
      if (!ID_PATTERN[mediaType].test(safeId)) return jsonResponse({ error: 'Id inválido' }, 400)
      if (mediaType === 'book') return jsonResponse(await bookDetails(source, safeId))
      return jsonResponse(
        mediaType === 'anime' ? await anilistDetails(safeId) : await tmdbDetails(mediaType, safeId)
      )
    }

    if (!query || typeof query !== 'string') {
      return jsonResponse({ error: 'Falta el parámetro query' }, 400)
    }
    const text = query.slice(0, MAX_TEXT)
    if (mediaType === 'book') return jsonResponse(await bookSearch(text))
    return jsonResponse(
      mediaType === 'anime' ? await anilistSearch(text) : await tmdbSearch(mediaType, text)
    )
  } catch (err) {
    // 503 con un mensaje claro: el frontend lo muestra tal cual.
    if (err instanceof NotConfiguredError) return errorResponse(err, 503)
    return errorResponse(err)
  }
})
