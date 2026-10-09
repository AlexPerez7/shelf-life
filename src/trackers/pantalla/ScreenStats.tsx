import { useMemo } from 'react'
import { Clapperboard, Clock, Flame, Layers, ListChecks, Star, Tag, Trophy, Tv } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { PageContainer } from '../../components/PageContainer'
import { TrackerBar } from '../../components/TrackerBar'
import { SectionCard } from '../../components/SectionCard'
import { Skeleton } from '../../components/Skeleton'
import { MonthlyBars } from '../../components/stats/MonthlyBars'
import { RankBars } from '../../components/stats/RankBars'
import { StatTile } from '../../components/stats/StatTile'
import { Highlight } from '../../components/stats/Highlight'
import { YearRecap } from '../../components/stats/YearRecap'
import { useActivity } from '../../hooks/useActivity'
import { formatMinutes, itemStatuses, mediaSections, mediaTypePlurals } from '../../lib/media'
import { finishedIn, maxBy, monthBuckets, started, topCounts } from '../../lib/stats'
import { parseDate } from '../../lib/dates'
import { plural } from '../../lib/text'
import type { ScreenType } from '../../types/item'

const section = mediaSections.pantalla
const MONTHS_SHOWN = 6

/** Horas con un decimal como máximo ("12,5 h"). */
const hours = (minutes: number) => `${(Math.round((minutes / 60) * 10) / 10).toLocaleString('es')} h`

/**
 * Estadísticas de Pantalla: lo visto en números, horas por mes, qué tipo y
 * qué géneros, destacados y el resumen del año para compartir.
 */
export function ScreenStats() {
  const { items, loading } = useMedia()
  const activity = useActivity(section.types)
  const year = new Date().getFullYear()

  const screen = useMemo(
    () => items.filter((i) => (section.types as string[]).includes(i.media_type)),
    [items]
  )
  const byId = useMemo(() => new Map(screen.map((i) => [i.id, i])), [screen])

  const stats = useMemo(() => {
    const minutes = screen.reduce((s, i) => s + i.time_spent_minutes, 0)
    const movies = screen.filter((i) => i.media_type === 'movie' && i.status === 'completed').length
    const episodes = screen.filter((i) => i.media_type !== 'movie').reduce((s, i) => s + i.progress, 0)
    const finishedShows = screen.filter((i) => i.media_type !== 'movie' && i.status === 'completed').length

    const byType = section.types.map((t) => {
      const ofType = screen.filter((i) => i.media_type === t)
      return {
        type: t as ScreenType,
        count: ofType.length,
        minutes: ofType.reduce((s, i) => s + i.time_spent_minutes, 0),
      }
    })

    const genres = topCounts(
      started(screen).flatMap((i) => i.genres),
      6
    )
    const byStatus = itemStatuses
      .map((s) => ({ status: s, count: screen.filter((i) => i.status === s).length }))
      .filter((r) => r.count > 0)

    return {
      minutes,
      movies,
      episodes,
      finishedShows,
      byType,
      genres,
      byStatus,
      topRated: maxBy(screen, (i) => i.rating),
      mostWatched: maxBy(screen, (i) => i.time_spent_minutes),
    }
  }, [screen])

  // Horas por mes, con episodios y películas de cada mes como detalle.
  const months = useMemo(() => {
    if (!activity) return null
    return {
      minutes: monthBuckets(activity, MONTHS_SHOWN, (r) => r.duration_minutes ?? 0),
      episodes: monthBuckets(activity, MONTHS_SHOWN, (r) =>
        byId.get(r.item_id)?.media_type !== 'movie' ? (r.progress_delta ?? 0) : 0
      ),
      movies: monthBuckets(activity, MONTHS_SHOWN, (r) => (byId.get(r.item_id)?.media_type === 'movie' ? 1 : 0)),
    }
  }, [activity, byId])

  // Día con más episodios (de lo registrado en el último año).
  const binge = useMemo(() => {
    if (!activity) return null
    const perDay = new Map<string, number>()
    for (const r of activity) {
      if (!r.progress_delta || byId.get(r.item_id)?.media_type === 'movie') continue
      const d = parseDate(r.occurred_at)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      perDay.set(key, (perDay.get(key) ?? 0) + r.progress_delta)
    }
    const best = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0]
    if (!best || best[1] < 3) return null
    const [y, m, d] = best[0].split('-').map(Number)
    return {
      episodes: best[1],
      date: new Date(y, m, d).toLocaleDateString('es', { day: 'numeric', month: 'long' }),
    }
  }, [activity, byId])

  const recapLines = useMemo(() => {
    const finished = finishedIn(screen, year)
    const yearActivity = (activity ?? []).filter((r) => parseDate(r.occurred_at).getFullYear() === year)
    const minutes = yearActivity.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
    const episodes = yearActivity.reduce(
      (s, r) => s + (byId.get(r.item_id)?.media_type !== 'movie' ? (r.progress_delta ?? 0) : 0),
      0
    )
    const movies = finished.filter((i) => i.media_type === 'movie').length
    const shows = finished.length - movies
    const best = maxBy(finished, (i) => i.rating)
    return [
      movies > 0 && `🎬 ${plural(movies, 'película vista', 'películas vistas')}`,
      shows > 0 && `📺 ${plural(shows, 'serie o anime terminado', 'series y anime terminados')}`,
      episodes > 0 && `▶️ ${plural(episodes, 'episodio')}`,
      minutes > 0 && `⏱️ ${hours(minutes)} frente a la pantalla`,
      best && `⭐ Lo mejor: ${best.title}`,
    ].filter(Boolean) as string[]
  }, [screen, activity, byId, year])

  const highlights = [
    stats.topRated && {
      icon: Star,
      label: 'Mejor puntuado',
      item: stats.topRated,
      detail: `${'★'.repeat(Math.round((stats.topRated.rating ?? 0) / 2))}`,
    },
    stats.mostWatched && {
      icon: Clock,
      label: 'Más tiempo',
      item: stats.mostWatched,
      detail: formatMinutes(stats.mostWatched.time_spent_minutes),
    },
  ].filter(Boolean) as { icon: typeof Star; label: string; item: (typeof screen)[number]; detail: string }[]

  return (
    <PageContainer>
      <TrackerBar tracker="pantalla" />
      <h1 className="mb-4 text-3xl font-bold text-ink">Estadísticas</h1>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : screen.length === 0 ? (
        <p className="mt-8 text-center text-sm text-lavender">
          Cuando agregues películas, series o anime, acá vas a ver tus números.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile icon={Clock} label="Frente a la pantalla" value={stats.minutes ? hours(stats.minutes) : '—'} />
            <StatTile
              icon={Clapperboard}
              label="Películas vistas"
              value={String(stats.movies)}
              to={`${section.libraryPath}?estado=completed&tipo=movie`}
            />
            <StatTile icon={ListChecks} label="Episodios vistos" value={stats.episodes.toLocaleString('es')} />
            <StatTile
              icon={Trophy}
              label="Series y anime terminados"
              value={String(stats.finishedShows)}
              to={`${section.libraryPath}?estado=completed`}
            />
          </div>

          <MonthlyBars
            icon={Clock}
            title="Horas por mes"
            months={months?.minutes ?? null}
            format={hours}
            emptyText="Suma episodios o marca películas como vistas para ver tu ritmo mes a mes."
            detail={(i) =>
              months &&
              [
                months.episodes[i].value > 0 && plural(months.episodes[i].value, 'episodio'),
                months.movies[i].value > 0 && plural(months.movies[i].value, 'película'),
              ]
                .filter(Boolean)
                .join(' · ')
            }
            footnote="Según lo registrado en la app; lo que marcas como visto al agregarlo no suma tiempo."
          />

          {binge && (
            <div className="flex items-center gap-3 rounded-2xl bg-background-surface p-3.5 ring-1 ring-primary-dark/30">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Flame size={20} />
              </div>
              <div>
                <p className="text-xs text-lavender">Tu día más maratonero</p>
                <p className="font-semibold text-ink">
                  {plural(binge.episodes, 'episodio')} el {binge.date}
                </p>
              </div>
            </div>
          )}

          <SectionCard icon={Tv} title="Por tipo">
            <RankBars
              rows={stats.byType
                .filter((t) => t.count > 0)
                .map((t) => ({
                  label: mediaTypePlurals[t.type],
                  value: t.count,
                  display: t.minutes > 0 ? `${t.count} · ${hours(t.minutes)}` : String(t.count),
                  to: `${section.libraryPath}?tipo=${t.type}`,
                }))}
            />
          </SectionCard>

          {stats.genres.length > 0 && (
            <SectionCard icon={Tag} title="Géneros que más ves">
              <RankBars rows={stats.genres} />
            </SectionCard>
          )}

          <SectionCard icon={Layers} title="Por estado">
            <RankBars
              rows={stats.byStatus.map((r) => ({
                label: section.statusLabels[r.status],
                value: r.count,
                to: `${section.libraryPath}?estado=${r.status}`,
              }))}
            />
          </SectionCard>

          {highlights.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {highlights.map((h) => (
                <Highlight
                  key={h.label}
                  icon={h.icon}
                  label={h.label}
                  title={h.item.title}
                  detail={h.detail}
                  cover={h.item.cover_url}
                  to={section.detailPath(h.item.id)}
                />
              ))}
            </div>
          )}

          <YearRecap year={year} heading={`Mi ${year} en Shelf Life 🍿`} lines={recapLines} />
        </div>
      )}
    </PageContainer>
  )
}
