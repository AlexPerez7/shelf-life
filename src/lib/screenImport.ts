// Importar Pantalla desde Letterboxd (películas) y MyAnimeList (anime).
// Todo se procesa en el dispositivo: el archivo no sale del navegador. Solo
// se mandan a la Edge Function los títulos (Letterboxd, para buscarlos en
// TMDB) o los ids de MAL (para traerlos de AniList).
//   - Letterboxd: "Settings → Data → Export your data" baja un .zip con
//     watched.csv, diary.csv, ratings.csv, reviews.csv y watchlist.csv.
//   - MyAnimeList: "Export" en la lista baja un .xml.gz con el id de MAL de
//     cada anime, estado, episodios vistos, puntaje y fechas.

import type { Item, ItemStatus, ItemWrite, MediaSearchResult } from '../types/item'
import { parseCsv } from './csv'
import { callFn } from './functions'
import { resultToItem } from './media'

export type ScreenImportSource = 'letterboxd' | 'myanimelist'

export interface ImportedScreen {
  /** Identifica la entrada dentro del archivo (título + año, o id de MAL). */
  key: string
  media_type: 'movie' | 'anime'
  title: string
  year: number | null
  /** Solo MyAnimeList. */
  malId: string | null
  status: ItemStatus
  /** 1-10, como en la app. */
  rating: number | null
  /** Episodios vistos (anime). */
  progress: number
  /** Episodios totales según el archivo (anime), si se conocen. */
  total: number | null
  dateStarted: string | null
  dateFinished: string | null
  dateAdded: string | null
  review: string | null
  notes: string | null
  rewatches: number
}

/** Lo que encontró la búsqueda para cada entrada (o `null`). */
export type ScreenMatch = MediaSearchResult | null

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const clean = (v: string | undefined | null) => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/** "2023-05-14", "2023/05/14" o "2023-05-00" (MAL, día desconocido) -> "2023-05-14"; "0000-00-00" -> null. */
function cleanDate(v: string | undefined | null) {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec((v ?? '').trim())
  if (!m || m[1] === '0000' || Number(m[2]) === 0) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${(Number(m[3]) || 1).toString().padStart(2, '0')}`
}

function nonNegativeInt(v: string | undefined | null) {
  const n = Number.parseInt((v ?? '').trim(), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const maxDate = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : (a ?? b))
const minDate = (a: string | null, b: string | null) => (a && b ? (a < b ? a : b) : (a ?? b))

/** Título comparable: sin tildes, mayúsculas ni signos. */
export function normalizeTitle(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Texto con algo de HTML (reseñas de Letterboxd) -> texto plano. */
function stripHtml(text: string | null) {
  if (!text) return null
  return (
    text
      .replace(/<br\s*\/?>|<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || null
  )
}

// ---------------------------------------------------------------------------
// MyAnimeList (XML)
// ---------------------------------------------------------------------------

function xmlText(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`).exec(block)
  if (!m) return null
  if (m[1] != null) return m[1]
  return m[2]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
}

function malStatus(v: string | null): ItemStatus {
  switch ((v ?? '').trim().toLowerCase()) {
    case 'watching':
    case '1':
      return 'in_progress'
    case 'completed':
    case '2':
      return 'completed'
    case 'on-hold':
    case '3':
      return 'paused'
    case 'dropped':
    case '4':
      return 'dropped'
    default:
      // "Plan to Watch" (6).
      return 'wishlist'
  }
}

/** Lee el XML que exporta MyAnimeList (ya descomprimido). */
export function parseMalExport(xml: string): ImportedScreen[] {
  if (!/<myanimelist>/.test(xml)) {
    throw new Error('No reconocemos el archivo: tiene que ser la lista que exporta MyAnimeList.')
  }
  if (xmlText(xml, 'user_export_type')?.trim() === '2') {
    throw new Error('Es la lista de manga: exporta la de anime.')
  }
  const out: ImportedScreen[] = []
  for (const [, block] of xml.matchAll(/<anime>([\s\S]*?)<\/anime>/g)) {
    const malId = clean(xmlText(block, 'series_animedb_id'))
    const title = clean(xmlText(block, 'series_title'))
    if (!malId || !/^\d+$/.test(malId) || !title) continue
    const status = malStatus(xmlText(block, 'my_status'))
    const total = nonNegativeInt(xmlText(block, 'series_episodes')) || null
    const watched = nonNegativeInt(xmlText(block, 'my_watched_episodes'))
    const score = nonNegativeInt(xmlText(block, 'my_score'))
    out.push({
      key: `mal:${malId}`,
      media_type: 'anime',
      title,
      year: null,
      malId,
      status,
      rating: score > 0 ? Math.min(10, score) : null,
      progress: status === 'completed' && total ? total : watched,
      total,
      dateStarted: cleanDate(xmlText(block, 'my_start_date')),
      dateFinished: status === 'completed' ? cleanDate(xmlText(block, 'my_finish_date')) : null,
      dateAdded: null,
      review: null,
      notes: clean(xmlText(block, 'my_comments')),
      rewatches: nonNegativeInt(xmlText(block, 'my_times_watched')),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Letterboxd (CSV)
// ---------------------------------------------------------------------------

const LETTERBOXD_FILES = ['watched.csv', 'diary.csv', 'ratings.csv', 'reviews.csv', 'watchlist.csv']

/** Archivos del export que importan (no los de "deleted/" ni "likes/"). */
export function isLetterboxdFile(path: string) {
  const parts = path.toLowerCase().split('/')
  if (parts.length > 2 || ['deleted', 'orphaned', 'likes', 'lists'].includes(parts[0])) return false
  return LETTERBOXD_FILES.includes(parts[parts.length - 1])
}

/**
 * Junta los CSV de Letterboxd (por nombre de archivo) en una entrada por
 * película: vista si está en watched/diary/ratings/reviews; si no, en
 * "Quiero ver". El diario da la fecha en que se vio y las veces que se
 * volvió a ver; ratings, el puntaje actual; reviews, la reseña.
 */
export function parseLetterboxdExport(files: Map<string, string>): ImportedScreen[] {
  const byName = new Map<string, string>()
  for (const [path, text] of files) {
    if (isLetterboxdFile(path)) byName.set(path.toLowerCase().split('/').pop()!, text)
  }
  if (byName.size === 0) {
    throw new Error('No reconocemos el archivo: tiene que ser el .zip (o los .csv) que exporta Letterboxd.')
  }

  const films = new Map<string, ImportedScreen>()
  // Lo que se va contando de cada película mientras se leen los archivos.
  const tally = new Map<string, { diaryEntries: number; diaryRewatches: number; reviewDate: string | null }>()
  const film = (name: string, year: string | undefined) => {
    const y = Number.parseInt(year ?? '', 10)
    const key = `lb:${normalizeTitle(name)}|${Number.isFinite(y) ? y : ''}`
    let f = films.get(key)
    if (!f) {
      f = {
        key,
        media_type: 'movie',
        title: name,
        year: Number.isFinite(y) ? y : null,
        malId: null,
        status: 'wishlist',
        rating: null,
        progress: 0,
        total: null,
        dateStarted: null,
        dateFinished: null,
        dateAdded: null,
        review: null,
        notes: null,
        rewatches: 0,
      }
      films.set(key, f)
      tally.set(key, { diaryEntries: 0, diaryRewatches: 0, reviewDate: null })
    }
    return f
  }
  const stars = (v: string | undefined) => {
    const n = Number.parseFloat((v ?? '').trim())
    return Number.isFinite(n) && n > 0 ? Math.min(10, Math.max(1, Math.round(n * 2))) : null
  }

  const each = (file: string, fn: (get: (col: string) => string | undefined) => void) => {
    const text = byName.get(file)
    if (!text) return
    const [header, ...rows] = parseCsv(text)
    if (!header) return
    const idx = new Map(header.map((h, i) => [h.trim(), i]))
    for (const row of rows) {
      const get = (col: string) => {
        const i = idx.get(col)
        return i == null ? undefined : row[i]
      }
      if (clean(get('Name'))) fn(get)
    }
  }

  // Orden: lo visto pisa a la watchlist; ratings pisa el puntaje del diario.
  each('watchlist.csv', (get) => {
    const f = film(get('Name')!.trim(), get('Year'))
    f.dateAdded = minDate(f.dateAdded, cleanDate(get('Date')))
  })
  each('watched.csv', (get) => {
    const f = film(get('Name')!.trim(), get('Year'))
    const date = cleanDate(get('Date'))
    f.status = 'completed'
    f.dateAdded = minDate(f.dateAdded, date)
    f.dateFinished = maxDate(f.dateFinished, date)
  })
  each('diary.csv', (get) => {
    const f = film(get('Name')!.trim(), get('Year'))
    const watched = cleanDate(get('Watched Date')) ?? cleanDate(get('Date'))
    f.status = 'completed'
    f.dateAdded = minDate(f.dateAdded, cleanDate(get('Date')))
    const t = tally.get(f.key)!
    t.diaryEntries++
    if ((get('Rewatch') ?? '').trim().toLowerCase() === 'yes') t.diaryRewatches++
    // El diario puede tener la fecha en que se vio después del alta en watched.
    if (watched && (!f.dateFinished || watched >= f.dateFinished)) {
      f.dateFinished = watched
      f.rating = stars(get('Rating')) ?? f.rating
    }
  })
  each('ratings.csv', (get) => {
    const f = film(get('Name')!.trim(), get('Year'))
    f.status = 'completed'
    f.rating = stars(get('Rating')) ?? f.rating
    f.dateAdded = minDate(f.dateAdded, cleanDate(get('Date')))
  })
  each('reviews.csv', (get) => {
    const f = film(get('Name')!.trim(), get('Year'))
    const date = cleanDate(get('Watched Date')) ?? cleanDate(get('Date'))
    f.status = 'completed'
    const review = stripHtml(clean(get('Review')))
    // Con varias reseñas, queda la más reciente.
    const t = tally.get(f.key)!
    if (review && (!t.reviewDate || (date ?? '') >= t.reviewDate)) {
      f.review = review
      t.reviewDate = date
    }
  })

  return [...films.values()].map((f) => {
    const { diaryEntries, diaryRewatches } = tally.get(f.key)!
    return { ...f, rewatches: f.status === 'completed' ? Math.max(diaryEntries - 1, diaryRewatches) : 0 }
  })
}

// ---------------------------------------------------------------------------
// Búsqueda (Edge Function `media-search`)
// ---------------------------------------------------------------------------

/** Películas por título y año en TMDB, de a `MATCH_BATCH`; mismo orden, `null` si no hay. */
export const MATCH_BATCH = 20

export async function matchMovies(entries: ImportedScreen[]): Promise<ScreenMatch[]> {
  const result = await callFn<ScreenMatch[]>('media-search', {
    type: 'movie',
    mode: 'match',
    titles: entries.map((e) => ({ title: e.title, year: e.year })),
  })
  if (!Array.isArray(result) || result.length !== entries.length) {
    throw new Error('La función de búsqueda está desactualizada: falta publicar media-search.')
  }
  return result
}

/** Anime por id de MAL en AniList, de a `MAL_BATCH`; mismo orden, `null` si no está. */
export const MAL_BATCH = 50

export async function matchAnime(entries: ImportedScreen[]): Promise<ScreenMatch[]> {
  const result = await callFn<(MediaSearchResult & { mal_id: string })[]>('media-search', {
    type: 'anime',
    mode: 'mal',
    ids: entries.map((e) => e.malId),
  })
  if (!Array.isArray(result)) {
    throw new Error('La función de búsqueda está desactualizada: falta publicar media-search.')
  }
  const byMal = new Map(result.map(({ mal_id, ...r }) => [String(mal_id), r]))
  return entries.map((e) => byMal.get(e.malId ?? '') ?? null)
}

// ---------------------------------------------------------------------------
// Duplicados y alta
// ---------------------------------------------------------------------------

const yearOf = (date: string | null | undefined) => (date ? Number(date.slice(0, 4)) : null)

/** Claves de lo que ya está en Pantalla: por id externo y por título + año (también el original). */
export function existingScreenKeys(items: Item[]) {
  const keys = new Set<string>()
  for (const i of items) {
    if (i.source && i.external_id) keys.add(`id:${i.source}:${i.external_id}`)
    for (const title of [i.title, i.metadata.original_title]) {
      if (title) keys.add(`t:${i.media_type}|${normalizeTitle(title)}|${yearOf(i.release_date) ?? ''}`)
    }
  }
  return keys
}

/** ¿Ya está? Por el resultado encontrado (id, título) o por el título del archivo. */
export function isScreenDuplicate(entry: ImportedScreen, match: ScreenMatch, keys: Set<string>) {
  const titleKey = (title: string, year: number | null) =>
    `t:${entry.media_type}|${normalizeTitle(title)}|${year ?? ''}`
  if (match) {
    if (keys.has(`id:${match.source}:${match.external_id}`)) return true
    const year = yearOf(match.release_date)
    if (keys.has(titleKey(match.title, year))) return true
    if (match.original_title && keys.has(titleKey(match.original_title, year))) return true
  }
  return keys.has(titleKey(entry.title, entry.year))
}

/** Entrada importada (con lo que encontró la búsqueda, si algo) -> fila de `items`. */
export function importedScreenToItem(
  e: ImportedScreen,
  match: ScreenMatch
): ItemWrite & Pick<Item, 'media_type' | 'title'> & { created_at?: string } {
  const base: ItemWrite & Pick<Item, 'media_type' | 'title'> = match
    ? resultToItem(match)
    : {
        media_type: e.media_type,
        title: e.title,
        release_date: e.year ? `${e.year}-01-01` : null,
        progress_total: e.total,
        metadata: {},
      }
  const total = e.media_type === 'movie' ? null : (base.progress_total ?? e.total)
  const completed = e.status === 'completed'
  const progress = completed ? (total ?? e.progress) : total ? Math.min(e.progress, total) : e.progress
  return {
    ...base,
    status: e.status,
    rating: e.rating,
    progress_total: total,
    progress: e.media_type === 'movie' ? 0 : progress,
    date_started: e.dateStarted,
    date_finished: completed ? e.dateFinished : null,
    review: e.review,
    notes: e.notes,
    replays: e.rewatches,
    // Conserva cuándo se agregó en la otra app (el historial lo muestra así).
    ...(e.dateAdded ? { created_at: `${e.dateAdded}T12:00:00` } : {}),
  }
}
