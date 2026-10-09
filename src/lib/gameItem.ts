// Traducción entre la tabla genérica `items` y el tipo `Game` que usa toda la
// sección de juegos. La DB ya es multimedia (migración 0011), pero las
// pantallas de juegos siguen hablando en `Game` (estados en español, horas,
// plataformas como texto): así no hubo que reescribirlas, y cada sección
// nueva (películas, libros) trabaja directo con `Item`.

import { parseTags } from './tags'
import type { Game, GameStatus, NewGame } from '../types/game'
import type { Item, ItemMetadata, ItemStatus, ItemWrite } from '../types/item'

const toGameStatus: Record<ItemStatus, GameStatus> = {
  wishlist: 'deseado',
  planned: 'pendiente',
  in_progress: 'jugando',
  paused: 'en_pausa',
  completed: 'completado',
  dropped: 'abandonado',
}

const toItemStatus: Record<GameStatus, ItemStatus> = {
  deseado: 'wishlist',
  pendiente: 'planned',
  jugando: 'in_progress',
  en_pausa: 'paused',
  completado: 'completed',
  abandonado: 'dropped',
}

export function gameStatusFromItem(status: ItemStatus): GameStatus {
  return toGameStatus[status]
}

/** 'YYYY-MM-DD' -> segundos unix (UTC), como venía de IGDB. */
function dateToUnix(date: string | null): number | null {
  return date ? Date.parse(`${date}T00:00:00Z`) / 1000 : null
}

function unixToDate(seconds: number | null | undefined): string | null {
  return seconds != null ? new Date(seconds * 1000).toISOString().slice(0, 10) : null
}

export function itemToGame(item: Item): Game {
  const m = item.metadata ?? {}
  return {
    id: item.id,
    user_id: item.user_id,
    igdb_id: item.source === 'igdb' && item.external_id ? Number(item.external_id) : null,
    title: item.title,
    platform: (m.platforms ?? []).join(', ') || null,
    status: toGameStatus[item.status],
    hours_played: Math.round((item.time_spent_minutes / 60) * 10) / 10,
    rating: item.rating,
    cover_url: item.cover_url,
    genre: item.genres.join(', ') || null,
    notes: item.notes,
    review: item.review,
    date_started: item.date_started,
    date_finished: item.date_finished,
    summary: item.summary,
    first_release_date: dateToUnix(item.release_date),
    steam_appid: m.steam_appid ?? null,
    story_percent: m.story_percent ?? 0,
    general_percent: m.general_percent ?? 0,
    completionist_percent: m.completionist_percent ?? 0,
    is_favorite: item.is_favorite,
    format: item.format,
    replays: item.replays,
    franchise: item.franchise,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }
}

const sameNameFields = [
  'title',
  'rating',
  'cover_url',
  'notes',
  'review',
  'date_started',
  'date_finished',
  'summary',
  'is_favorite',
  'format',
  'replays',
  'franchise',
] as const satisfies readonly (keyof Game & keyof Item)[]

/**
 * Cambios de un `Game` -> columnas de `items`. Solo se escriben las columnas
 * de los campos que cambiaron: así, por ejemplo, editar las notas no pisa el
 * tiempo que el trigger de sesiones haya sumado mientras tanto.
 * `currentMetadata` se necesita para no perder el resto del jsonb al cambiar
 * una plataforma o un porcentaje.
 */
export function gameChangesToItem(
  changes: Partial<Game>,
  currentMetadata: ItemMetadata = {}
): ItemWrite {
  const out: ItemWrite = {}
  const meta: ItemMetadata = {}
  let metaChanged = false

  for (const key of sameNameFields) {
    if (key in changes) (out as Record<string, unknown>)[key] = changes[key]
  }
  if (changes.status !== undefined) out.status = toItemStatus[changes.status]
  if (changes.hours_played !== undefined) {
    out.time_spent_minutes = Math.max(0, Math.round(Number(changes.hours_played) * 60))
  }
  if ('genre' in changes) out.genres = parseTags(changes.genre)
  if ('first_release_date' in changes) out.release_date = unixToDate(changes.first_release_date)
  if ('igdb_id' in changes) {
    out.source = changes.igdb_id != null ? 'igdb' : null
    out.external_id = changes.igdb_id != null ? String(changes.igdb_id) : null
  }

  if ('platform' in changes) {
    meta.platforms = parseTags(changes.platform)
    metaChanged = true
  }
  for (const key of ['steam_appid', 'story_percent', 'general_percent', 'completionist_percent'] as const) {
    if (key in changes) {
      meta[key] = changes[key] ?? undefined
      metaChanged = true
    }
  }
  if (metaChanged) out.metadata = { ...currentMetadata, ...meta }

  return out
}

export function newGameToItem(game: NewGame): ItemWrite & Pick<Item, 'media_type' | 'title'> {
  return { ...gameChangesToItem(game), media_type: 'game', title: game.title }
}
