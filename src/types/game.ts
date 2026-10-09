export type GameStatus =
  | 'deseado'
  | 'pendiente'
  | 'jugando'
  | 'completado'
  | 'abandonado'
  | 'en_pausa'

export interface Game {
  id: string
  user_id: string
  igdb_id: number | null
  title: string
  platform: string | null
  status: GameStatus
  hours_played: number
  rating: number | null
  cover_url: string | null
  genre: string | null
  notes: string | null
  review: string | null
  date_started: string | null
  date_finished: string | null
  summary: string | null
  first_release_date: number | null
  steam_appid: number | null
  story_percent: number
  general_percent: number
  completionist_percent: number
  is_favorite: boolean
  format: string | null
  replays: number
  franchise: string | null
  created_at: string
  /** Última modificación (para ordenar por actividad reciente). */
  updated_at: string
}

export type NewGame = Pick<Game, 'title'> &
  Partial<
    Omit<Game, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'title'>
  >

export interface PlaySession {
  id: string
  game_id: string
  duration_minutes: number
  played_at: string
  notes: string | null
}

export interface GameList {
  id: string
  user_id: string
  name: string
  /** Visible por link público (migración 0010). */
  is_public?: boolean
  created_at: string
  /** Última modificación (para ordenar por actividad reciente). */
  updated_at: string
}

export interface IgdbSearchResult {
  id: number
  name: string
  cover_url: string | null
  genres: string[]
  platforms: string[]
  first_release_date: number | null
  summary: string | null
}

/** Duración estimada en horas (endpoint game_time_to_beats de IGDB). */
export interface TimeToBeat {
  hastilyHours: number | null
  normallyHours: number | null
  completelyHours: number | null
  count: number
}
