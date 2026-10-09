// Datos de prueba para los tests de src/lib.

import type { Item } from '../types/item'
import type { Game } from '../types/game'

let seq = 0

/** Un ítem con valores por defecto razonables; se pisan los que importan al test. */
export function makeItem(overrides: Partial<Item> = {}): Item {
  seq++
  return {
    id: `item-${seq}`,
    user_id: 'user-1',
    media_type: 'book',
    title: `Título ${seq}`,
    status: 'planned',
    rating: null,
    cover_url: null,
    genres: [],
    summary: null,
    release_date: null,
    notes: null,
    review: null,
    date_started: null,
    date_finished: null,
    time_spent_minutes: 0,
    progress: 0,
    progress_total: null,
    source: null,
    external_id: null,
    metadata: {},
    is_favorite: false,
    format: null,
    replays: 0,
    franchise: null,
    created_at: '2026-01-01T12:00:00Z',
    updated_at: '2026-01-01T12:00:00Z',
    ...overrides,
  }
}

export function makeGame(overrides: Partial<Game> = {}): Game {
  seq++
  return {
    id: `game-${seq}`,
    user_id: 'user-1',
    igdb_id: null,
    title: `Juego ${seq}`,
    platform: null,
    status: 'pendiente',
    hours_played: 0,
    rating: null,
    cover_url: null,
    genre: null,
    notes: null,
    review: null,
    date_started: null,
    date_finished: null,
    summary: null,
    first_release_date: null,
    steam_appid: null,
    story_percent: 0,
    general_percent: 0,
    completionist_percent: 0,
    is_favorite: false,
    format: null,
    replays: 0,
    franchise: null,
    created_at: '2026-01-01T12:00:00Z',
    updated_at: '2026-01-01T12:00:00Z',
    ...overrides,
  }
}
