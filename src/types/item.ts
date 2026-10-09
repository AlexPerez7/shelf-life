// Modelo genérico de la biblioteca (tabla `items`, migración 0011): juegos,
// películas, series, anime y libros. La sección de juegos lo ve a través del
// tipo `Game` (ver lib/gameItem.ts).

export type MediaType = 'game' | 'movie' | 'series' | 'anime' | 'book'

/** Tipos de la sección Pantalla. */
export type ScreenType = 'movie' | 'series' | 'anime'

/** Todo lo que no es juego (lo maneja MediaProvider). */
export type NonGameType = Exclude<MediaType, 'game'>

/** Estado genérico; cada tipo lo muestra con su propio texto. */
export type ItemStatus =
  | 'wishlist'
  | 'planned'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'dropped'

export type ItemSource = 'igdb' | 'tmdb' | 'anilist' | 'google_books' | 'openlibrary'

/** Datos propios de cada tipo (jsonb `metadata`); cada tipo usa los suyos. */
export interface ItemMetadata {
  // Juegos
  platforms?: string[]
  steam_appid?: number
  story_percent?: number
  general_percent?: number
  completionist_percent?: number
  // Películas, series y anime
  original_title?: string
  /** Duración de la película, o de cada episodio, en minutos. */
  runtime_minutes?: number
  // Libros
  authors?: string[]
  isbn?: string
  publisher?: string
}

export interface Item {
  id: string
  user_id: string
  media_type: MediaType
  title: string
  status: ItemStatus
  rating: number | null
  cover_url: string | null
  genres: string[]
  summary: string | null
  /** 'YYYY-MM-DD' */
  release_date: string | null
  notes: string | null
  review: string | null
  date_started: string | null
  date_finished: string | null
  /** Tiempo invertido; lo mantiene un trigger sobre activity_log. */
  time_spent_minutes: number
  /** Avance contable: episodios vistos, páginas leídas... */
  progress: number
  progress_total: number | null
  source: ItemSource | null
  external_id: string | null
  metadata: ItemMetadata
  is_favorite: boolean
  format: string | null
  replays: number
  franchise: string | null
  created_at: string
  updated_at: string
}

/** Columnas escribibles de `items`. */
export type ItemWrite = Partial<Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

/** Resultado de búsqueda de la Edge Function `media-search`. */
export interface MediaSearchResult {
  source: 'tmdb' | 'anilist' | 'google_books' | 'openlibrary'
  external_id: string
  media_type: NonGameType
  title: string
  original_title: string | null
  cover_url: string | null
  release_date: string | null
  genres: string[]
  summary: string | null
  episodes: number | null
  runtime_minutes: number | null
  pages?: number | null
  authors?: string[]
  isbn?: string | null
  publisher?: string | null
}
