// Sección Pantalla (películas, series, anime): búsqueda y textos propios.
// Trabaja directo con `Item`; los estados se pintan con los mismos colores
// que los juegos (ver lib/status.ts) pero con sus propias etiquetas.

import {
  Ban,
  Bookmark,
  Clapperboard,
  Layers,
  Pause,
  Play,
  Sparkles,
  Trophy,
  Tv,
  type LucideIcon,
} from 'lucide-react'
import { callFn } from './functions'
import { statusColors } from './status'
import { gameStatusFromItem } from './gameItem'
import type { Item, ItemStatus, ItemWrite, MediaSearchResult, ScreenType } from '../types/item'

export const screenTypes: ScreenType[] = ['movie', 'series', 'anime']

export const screenTypeLabels: Record<ScreenType, string> = {
  movie: 'Película',
  series: 'Serie',
  anime: 'Anime',
}

export const screenTypePlurals: Record<ScreenType, string> = {
  movie: 'Películas',
  series: 'Series',
  anime: 'Anime',
}

export const screenTypeIcons: Record<ScreenType, LucideIcon> = {
  movie: Clapperboard,
  series: Tv,
  anime: Sparkles,
}

export function isScreenType(value: string): value is ScreenType {
  return (screenTypes as string[]).includes(value)
}

/** Las películas no tienen episodios: se ven de una vez. */
export function hasEpisodes(type: ScreenType) {
  return type !== 'movie'
}

/** Mismo orden "de vida" que los juegos. */
export const itemStatuses: ItemStatus[] = [
  'wishlist',
  'planned',
  'in_progress',
  'paused',
  'completed',
  'dropped',
]

export const screenStatusLabels: Record<ItemStatus, string> = {
  wishlist: 'Quiero ver',
  planned: 'Pendiente',
  in_progress: 'Viendo',
  paused: 'En pausa',
  completed: 'Visto',
  dropped: 'Abandonado',
}

export const itemStatusIcons: Record<ItemStatus, LucideIcon> = {
  wishlist: Bookmark,
  planned: Layers,
  in_progress: Play,
  paused: Pause,
  completed: Trophy,
  dropped: Ban,
}

export function itemStatusColor(status: ItemStatus) {
  return statusColors[gameStatusFromItem(status)]
}

export async function searchMedia(type: ScreenType, query: string): Promise<MediaSearchResult[]> {
  return (await callFn<MediaSearchResult[]>('media-search', { type, query })) ?? []
}

/** Detalle (duración, episodios): la búsqueda de TMDB no los trae. */
export async function getMediaDetails(
  type: ScreenType,
  externalId: string
): Promise<MediaSearchResult> {
  return callFn<MediaSearchResult>('media-search', { type, id: externalId })
}

export function resultToItem(r: MediaSearchResult): ItemWrite & Pick<Item, 'media_type' | 'title'> {
  return {
    media_type: r.media_type,
    title: r.title,
    status: 'planned',
    cover_url: r.cover_url,
    genres: r.genres,
    summary: r.summary,
    release_date: r.release_date,
    source: r.source,
    external_id: r.external_id,
    progress_total: r.episodes && r.episodes > 0 ? r.episodes : null,
    metadata: {
      ...(r.original_title && r.original_title !== r.title ? { original_title: r.original_title } : {}),
      ...(r.runtime_minutes ? { runtime_minutes: r.runtime_minutes } : {}),
    },
  }
}

/** "2h 15m" / "45m". */
export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** Cambios que acompañan a un cambio de estado (fechas, episodios). */
export function statusChanges(item: Item, status: ItemStatus, today: string): ItemWrite {
  const changes: ItemWrite = { status }
  if (status === 'in_progress' && !item.date_started) changes.date_started = today
  if (status === 'completed') {
    if (!item.date_finished) changes.date_finished = today
    if (item.progress_total && item.progress < item.progress_total) {
      changes.progress = item.progress_total
    }
  }
  return changes
}
