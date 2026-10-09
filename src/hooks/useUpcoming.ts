import { useEffect, useMemo, useState } from 'react'
import { parseDate } from '../lib/dates'
import { upcomingEpisodes, type UpcomingEpisode } from '../lib/media'
import type { Item } from '../types/item'

export interface UpcomingEntry {
  item: Item
  episode: UpcomingEpisode
  /** Fecha local de estreno. */
  date: Date
}

/** Estados en los que interesa saber cuándo sale lo próximo. */
const FOLLOWED = new Set(['in_progress', 'paused', 'planned', 'wishlist'])

// Una vez por conjunto de ids y por sesión de la app: cambia poco en el día.
type TypedEpisode = UpcomingEpisode & { type: 'series' | 'anime' }
const cache = new Map<string, TypedEpisode[]>()

/**
 * Próximos episodios de las series (TMDB) y anime (AniList) que sigues,
 * de hoy en adelante y ordenados por fecha. `null` mientras carga; si la
 * Edge Function no tiene el modo `upcoming` desplegado, lista vacía.
 */
export function useUpcoming(items: Item[]) {
  const followed = useMemo(
    () =>
      items.filter(
        (i) =>
          FOLLOWED.has(i.status) &&
          i.external_id &&
          ((i.media_type === 'series' && i.source === 'tmdb') || (i.media_type === 'anime' && i.source === 'anilist'))
      ),
    [items]
  )
  const seriesIds = followed.filter((i) => i.media_type === 'series').map((i) => i.external_id!).sort()
  const animeIds = followed.filter((i) => i.media_type === 'anime').map((i) => i.external_id!).sort()
  const key = `${seriesIds.join(',')}|${animeIds.join(',')}`

  const [state, setState] = useState<{ key: string; episodes: TypedEpisode[] } | null>(null)

  useEffect(() => {
    if (cache.has(key)) return
    let cancelled = false
    const [series, anime] = key.split('|').map((part) => (part ? part.split(',') : []))
    Promise.all([
      upcomingEpisodes('series', series).catch(() => [] as UpcomingEpisode[]),
      upcomingEpisodes('anime', anime).catch(() => [] as UpcomingEpisode[]),
    ]).then(([s, a]) => {
      const episodes: TypedEpisode[] = [
        ...s.map((ep) => ({ ...ep, type: 'series' as const })),
        ...a.map((ep) => ({ ...ep, type: 'anime' as const })),
      ]
      cache.set(key, episodes)
      if (!cancelled) setState({ key, episodes })
    })
    return () => {
      cancelled = true
    }
  }, [key])

  const episodes = cache.get(key) ?? (state?.key === key ? state.episodes : null)

  return useMemo(() => {
    if (episodes == null) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const byExternal = new Map(followed.map((i) => [`${i.media_type}:${i.external_id}`, i]))
    const entries: UpcomingEntry[] = []
    for (const ep of episodes) {
      // Los ids de TMDB y AniList pueden coincidir: la clave lleva el tipo.
      const item = byExternal.get(`${ep.type}:${ep.external_id}`)
      const date = parseDate(ep.air_date)
      if (item && date >= today) entries.push({ item, episode: ep, date })
    }
    return entries.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [episodes, followed])
}

/** "Hoy", "Mañana", "el viernes", "el 12 de octubre". */
export function airLabel(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  const days = Math.round((day.getTime() - today.getTime()) / 86400000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  if (days < 7) return `El ${day.toLocaleDateString('es', { weekday: 'long' })}`
  return `El ${day.toLocaleDateString('es', { day: 'numeric', month: 'long' })}`
}

/** "T2 · E5" (series) o "Ep. 12" (anime). */
export function episodeCode(ep: UpcomingEpisode) {
  if (ep.season != null && ep.episode != null) return `T${ep.season} · E${ep.episode}`
  return ep.episode != null ? `Ep. ${ep.episode}` : 'Nuevo episodio'
}
