import { supabase } from './supabaseClient'
import { readCache, writeCache } from './localCache'
import type { CoverOption } from './media'
import type { Game, IgdbSearchResult, NewGame, TimeToBeat } from '../types/game'

const POPULAR_CACHE_KEY = 'shelflife_popular_v1'
/** Los populares cambian poco: se reutilizan por 6 h sin volver a pedirlos. */
const POPULAR_TTL_MS = 6 * 60 * 60 * 1000

export async function searchGames(query: string): Promise<IgdbSearchResult[]> {
  const { data, error } = await supabase.functions.invoke<IgdbSearchResult[]>(
    'igdb-search',
    { body: { query } }
  )

  if (error) throw error
  return data ?? []
}

/** Últimos populares guardados (aunque estén vencidos), para pintar al instante. */
export function getCachedPopularGames(): { data: IgdbSearchResult[]; fresh: boolean } | null {
  const entry = readCache<IgdbSearchResult[]>(POPULAR_CACHE_KEY)
  if (!entry) return null
  return { data: entry.data, fresh: Date.now() - entry.savedAt < POPULAR_TTL_MS }
}

export async function getPopularGames(): Promise<IgdbSearchResult[]> {
  const { data, error } = await supabase.functions.invoke<IgdbSearchResult[]>(
    'igdb-search',
    { body: { mode: 'popular' } }
  )

  if (error) throw error
  const result = data ?? []
  if (result.length > 0) writeCache(POPULAR_CACHE_KEY, result)
  return result
}

/**
 * Duración estimada de un juego (endpoint oficial game_time_to_beats de IGDB).
 * Pasa `igdbId` cuando lo tengas; si no, `title` y la función lo resuelve
 * buscando por texto. Devuelve null si IGDB no tiene tiempos cargados.
 */
export async function getTimeToBeat(params: {
  igdbId?: number | null
  title?: string
}): Promise<TimeToBeat | null> {
  const { data, error } = await supabase.functions.invoke<TimeToBeat | null>(
    'igdb-search',
    {
      body: {
        mode: 'timeToBeat',
        igdbId: params.igdbId ?? undefined,
        title: params.title,
      },
    }
  )

  if (error) throw error
  return data ?? null
}

/**
 * Duración de varios juegos en una sola llamada (por igdb_id). Los juegos sin
 * datos no aparecen en el resultado.
 */
export async function getTimeToBeatBatch(igdbIds: number[]): Promise<Record<number, TimeToBeat>> {
  if (igdbIds.length === 0) return {}
  const { data, error } = await supabase.functions.invoke<Record<number, TimeToBeat | null>>(
    'igdb-search',
    { body: { mode: 'timeToBeatBatch', igdbIds } }
  )
  if (error) throw error
  const result: Record<number, TimeToBeat> = {}
  for (const [id, ttb] of Object.entries(data ?? {})) if (ttb) result[Number(id)] = ttb
  return result
}

/** Metadata de IGDB para appids de Steam (los que IGDB no conoce no aparecen). */
export async function getIgdbBySteamAppIds(
  steamAppIds: number[]
): Promise<Record<number, IgdbSearchResult>> {
  if (steamAppIds.length === 0) return {}
  const { data, error } = await supabase.functions.invoke<Record<number, IgdbSearchResult>>(
    'igdb-search',
    { body: { mode: 'bySteam', steamAppIds } }
  )
  if (error) throw error
  // Una versión vieja de la función (sin este modo) responde con un error o
  // con otra forma: se trata como "sin datos".
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
}

export function igdbResultToNewGame(result: IgdbSearchResult): NewGame {
  return {
    title: result.name,
    cover_url: result.cover_url,
    genre: result.genres.join(', '),
    platform: result.platforms.join(', '),
    summary: result.summary ?? '',
    first_release_date: result.first_release_date ?? undefined,
    igdb_id: result.id,
    status: 'pendiente',
  }
}

/**
 * Portadas alternativas de un juego para "Cambiar portada": la de IGDB, las
 * de cada región y edición, y la vertical de Steam si tiene `steam_appid`.
 * Sin `igdb_id`, la función busca el juego por título.
 */
export async function gameCoverOptions(game: Pick<Game, 'igdb_id' | 'title' | 'steam_appid'>): Promise<CoverOption[]> {
  const { data, error } = await supabase.functions.invoke<CoverOption[]>('igdb-search', {
    body: {
      mode: 'covers',
      igdbId: game.igdb_id ?? undefined,
      title: game.title,
      steamAppId: game.steam_appid ?? undefined,
    },
  })
  if (error) throw error
  // Una versión vieja de la función responde otra cosa: sin opciones.
  return Array.isArray(data) ? data : []
}
