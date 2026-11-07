import { useMemo, useState } from 'react'
import { Skeleton } from '../../components/Skeleton'
import { useActivity } from '../../hooks/useActivity'
import { parseDate } from '../../lib/dates'
import { formatMinutes } from '../../lib/media'
import { barHeights, weekDays } from '../../lib/week'
import { trackers, type TrackerId } from '../../trackers/trackers'
import type { MediaType } from '../../types/item'

const ALL_TYPES: MediaType[] = ['game', 'movie', 'series', 'anime', 'book']
const BAR_AREA = 88

interface Total {
  tracker: TrackerId
  value: string
  label: string
}

/** "Esta semana": la actividad de cada uno de los últimos 7 días y los totales de los tres trackers. */
export function WeekPanel({ typeOf }: { typeOf: Map<string, MediaType> }) {
  const activity = useActivity(ALL_TYPES, 1)
  // Desde hace 7 días, fijado al abrir el inicio.
  const [since] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000)

  const week = useMemo(() => {
    if (!activity) return null
    let gameMinutes = 0
    let episodes = 0
    let movies = 0
    let pages = 0
    const recent = activity.filter((r) => parseDate(r.occurred_at).getTime() >= since)
    for (const r of recent) {
      const type = typeOf.get(r.item_id)
      if (type === 'game') gameMinutes += r.duration_minutes ?? 0
      else if (type === 'movie') movies++
      else if (type === 'book') pages += Math.max(0, r.progress_delta ?? 0)
      else if (type) episodes += Math.max(0, r.progress_delta ?? 0)
    }
    const totals = [
      gameMinutes > 0 && { tracker: 'juegos' as const, value: formatMinutes(gameMinutes), label: 'jugando' },
      episodes > 0 && { tracker: 'pantalla' as const, value: String(episodes), label: episodes === 1 ? 'episodio' : 'episodios' },
      movies > 0 && { tracker: 'pantalla' as const, value: String(movies), label: movies === 1 ? 'película' : 'películas' },
      pages > 0 && { tracker: 'libros' as const, value: pages.toLocaleString('es'), label: pages === 1 ? 'página' : 'páginas' },
    ].filter(Boolean) as Total[]
    const days = weekDays(recent)
    return { totals, days, heights: barHeights(days) }
  }, [activity, typeOf, since])

  if (week == null) return <Skeleton className="h-56 w-full rounded-3xl" />
  if (week.totals.length === 0) return null

  return (
    <section aria-label="Esta semana" className="flex flex-col gap-4 rounded-3xl bg-background-surface p-4.5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight text-ink">Esta semana</h2>
        <span className="text-sm text-lavender">últimos 7 días</span>
      </div>
      <div className="flex items-end gap-2.5" style={{ height: BAR_AREA + 22 }} role="img" aria-label="Actividad de cada día">
        {week.days.map((d, i) => (
          <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className={`w-full rounded-lg ${d.isToday ? 'bg-accent' : 'bg-ink/20'}`}
              style={{ height: Math.max(4, Math.round(week.heights[i] * BAR_AREA)) }}
            />
            <span className={`text-xs font-medium ${d.isToday ? 'text-accent' : 'text-lavender'}`}>
              {d.isToday ? 'Hoy' : d.label}
            </span>
          </div>
        ))}
      </div>
      <ul className="flex gap-2">
        {week.totals.map((t) => {
          const Icon = trackers[t.tracker].Icon
          return (
            <li key={t.label} data-tracker={t.tracker} className="min-w-0 flex-1 rounded-2xl bg-ink/[0.06] px-3 py-2.5">
              <p className="font-display flex items-center gap-1.5 text-xl font-bold text-accent tabular-nums">
                <Icon size={15} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{t.value}</span>
              </p>
              <p className="mt-0.5 text-xs text-lavender">{t.label}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
