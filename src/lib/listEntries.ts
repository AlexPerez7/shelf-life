// Ítems de una lista, de cualquier tracker, con lo necesario para mostrarlos:
// las listas son comunes a juegos, películas, series, anime y libros.

import { statusColors, statusLabels } from './status'
import { itemStatusColor, mediaTypeLabels, sectionForType } from './media'
import { gamesPaths } from '../trackers/juegos/paths'
import type { Game } from '../types/game'
import type { Item, MediaType, NonGameType } from '../types/item'

export interface ListEntry {
  id: string
  type: MediaType
  title: string
  cover: string | null
  /** "Juego", "Película", "Libro"... */
  typeLabel: string
  statusLabel: string
  statusClass: string
  /** Detalle en su tracker. */
  to: string
}

export function gameEntry(g: Game): ListEntry {
  return {
    id: g.id,
    type: 'game',
    title: g.title,
    cover: g.cover_url,
    typeLabel: 'Juego',
    statusLabel: statusLabels[g.status],
    statusClass: statusColors[g.status],
    to: gamesPaths.game(g.id),
  }
}

export function mediaEntry(i: Item): ListEntry {
  const type = i.media_type as NonGameType
  const section = sectionForType(type)
  return {
    id: i.id,
    type,
    title: i.title,
    cover: i.cover_url,
    typeLabel: mediaTypeLabels[type],
    statusLabel: section.statusLabels[i.status],
    statusClass: itemStatusColor(i.status, section),
    to: section.detailPath(i.id),
  }
}

/** Ítems de una lista en su orden, con los datos de memoria (siempre al día). */
export function listEntries(ids: string[], games: Game[], items: Item[]): ListEntry[] {
  const byId = new Map<string, ListEntry>()
  for (const g of games) byId.set(g.id, gameEntry(g))
  for (const i of items) byId.set(i.id, mediaEntry(i))
  return ids.map((id) => byId.get(id)).filter((e): e is ListEntry => e != null)
}

/** "3 juegos · 2 películas · 1 libro" */
export function listSummary(entries: Pick<ListEntry, 'type'>[]) {
  const names: Record<MediaType, [string, string]> = {
    game: ['juego', 'juegos'],
    movie: ['película', 'películas'],
    series: ['serie', 'series'],
    anime: ['anime', 'anime'],
    book: ['libro', 'libros'],
  }
  const counts = new Map<MediaType, number>()
  for (const e of entries) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
  if (counts.size === 0) return 'Vacía'
  return [...counts.entries()]
    .map(([type, n]) => `${n} ${names[type][n === 1 ? 0 : 1]}`)
    .join(' · ')
}
