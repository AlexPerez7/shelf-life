// Secciones que no son juegos (Pantalla y Libros): búsqueda, textos y
// configuración de cada una. Trabajan directo con `Item`; los estados se
// pintan con los mismos colores que los juegos (ver lib/status.ts) pero con
// sus propias etiquetas.

import {
  Ban,
  BookOpen,
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
import type { Item, ItemStatus, ItemWrite, MediaSearchResult, NonGameType } from '../types/item'

export const mediaTypeLabels: Record<NonGameType, string> = {
  movie: 'Película',
  series: 'Serie',
  anime: 'Anime',
  book: 'Libro',
}

export const mediaTypePlurals: Record<NonGameType, string> = {
  movie: 'Películas',
  series: 'Series',
  anime: 'Anime',
  book: 'Libros',
}

export const mediaTypeIcons: Record<NonGameType, LucideIcon> = {
  movie: Clapperboard,
  series: Tv,
  anime: Sparkles,
  book: BookOpen,
}

/** Cómo se mide el avance de cada tipo. */
export type ProgressKind = 'none' | 'episodes' | 'pages'

export function progressKind(type: NonGameType): ProgressKind {
  if (type === 'book') return 'pages'
  // Las películas no tienen episodios: se ven de una vez.
  return type === 'movie' ? 'none' : 'episodes'
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

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------

export type MediaSectionId = 'pantalla' | 'libros'

export interface MediaSection {
  id: MediaSectionId
  title: string
  Icon: LucideIcon
  types: NonGameType[]
  statusLabels: Record<ItemStatus, string>
  libraryPath: string
  addPath: string
  detailPath: (id: string) => string
  /** Texto del estado vacío de la biblioteca. */
  emptyText: string
  /** Placeholder de las notas en el detalle. */
  notesPlaceholder: string
}

export const mediaSections: Record<MediaSectionId, MediaSection> = {
  pantalla: {
    id: 'pantalla',
    title: 'Pantalla',
    Icon: Tv,
    types: ['movie', 'series', 'anime'],
    statusLabels: {
      wishlist: 'Quiero ver',
      planned: 'Pendiente',
      in_progress: 'Viendo',
      paused: 'En pausa',
      completed: 'Visto',
      dropped: 'Abandonado',
    },
    libraryPath: '/pantalla',
    addPath: '/pantalla/agregar',
    detailPath: (id) => `/pantalla/${id}`,
    emptyText:
      'Agrega películas, series y anime para llevar lo que viste, lo que estás viendo y lo que tienes pendiente.',
    notesPlaceholder: 'Dónde quedaste, con quién la ves...',
  },
  libros: {
    id: 'libros',
    title: 'Libros',
    Icon: BookOpen,
    types: ['book'],
    statusLabels: {
      wishlist: 'Quiero leer',
      planned: 'Pendiente',
      in_progress: 'Leyendo',
      paused: 'En pausa',
      completed: 'Leído',
      dropped: 'Abandonado',
    },
    libraryPath: '/libros',
    addPath: '/libros/agregar',
    detailPath: (id) => `/libros/${id}`,
    emptyText:
      'Agrega libros para llevar lo que leíste, lo que estás leyendo y tu pila de pendientes.',
    notesPlaceholder: 'Citas, ideas, en qué capítulo vas...',
  },
}

export function sectionForType(type: NonGameType): MediaSection {
  return type === 'book' ? mediaSections.libros : mediaSections.pantalla
}

export function isNonGameType(value: string): value is NonGameType {
  return value in mediaTypeLabels
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

export async function searchMedia(type: NonGameType, query: string): Promise<MediaSearchResult[]> {
  return (await callFn<MediaSearchResult[]>('media-search', { type, query })) ?? []
}

/** Detalle (duración, episodios, sinopsis): algunas búsquedas no los traen. */
export async function getMediaDetails(result: MediaSearchResult): Promise<MediaSearchResult> {
  return callFn<MediaSearchResult>('media-search', {
    type: result.media_type,
    id: result.external_id,
    source: result.source,
  })
}

/** Resultados cuya búsqueda no trae todo lo que se guarda. */
export function needsDetails(result: MediaSearchResult) {
  return result.source === 'tmdb' || result.source === 'openlibrary'
}

export function resultToItem(r: MediaSearchResult): ItemWrite & Pick<Item, 'media_type' | 'title'> {
  const total = r.media_type === 'book' ? r.pages : r.episodes
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
    progress_total: total && total > 0 ? total : null,
    metadata: {
      ...(r.original_title && r.original_title !== r.title ? { original_title: r.original_title } : {}),
      ...(r.runtime_minutes ? { runtime_minutes: r.runtime_minutes } : {}),
      ...(r.authors?.length ? { authors: r.authors } : {}),
      ...(r.isbn ? { isbn: r.isbn } : {}),
      ...(r.publisher ? { publisher: r.publisher } : {}),
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

/** Cambios que acompañan a un cambio de estado (fechas, avance). */
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

/**
 * Cambios al registrar avance (episodios o página actual): el primer avance
 * pasa a "en curso" y llegar al total marca como terminado.
 */
export function progressChanges(item: Item, progress: number, today: string): ItemWrite {
  if (item.progress_total && progress >= item.progress_total) {
    return { ...statusChanges(item, 'completed', today), progress }
  }
  if (item.status !== 'in_progress' && progress > 0) {
    return { ...statusChanges(item, 'in_progress', today), progress }
  }
  return { progress }
}
